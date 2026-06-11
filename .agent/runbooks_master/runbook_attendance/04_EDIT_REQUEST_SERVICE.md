# Phase 2.2 — Edit Request Service (Maker-Checker Workflow)

## Skills Required (Read Before Starting)
- `development-best-practices` §10 (Repository Pattern — zero raw fetching in components)
- `rbac-security-system` §2 (Contributor = Maker, Editor = Checker)
- `safe-code-modification` §1C (Document all logic blocks)

---

## Objective

Create `editRequestService.js` — the service layer for the Maker-Checker approval workflow:
- **Contributor (Maker)**: Submits edit suggestions (creates a row in `attendance_edit_requests`)
- **Editor (Checker)**: Fetches pending requests, approves or rejects them

When an editor **approves**, the service performs an **upsert** into `daily_attendances` to apply the suggested change.

---

## Step 1: Create the Edit Request Service File

**File to create:**
```
src/services/employees/editRequestService.js
```

**Full JS Content:**

```javascript
/**
 * editRequestService.js
 *
 * Repository layer for the attendance Maker-Checker workflow.
 *
 * - Contributor (Maker): calls submitEditRequest()
 * - Editor (Checker):    calls fetchPendingRequests(), approveRequest(), rejectRequest()
 *
 * Skill compliance:
 *   development-best-practices §10 (Zero raw fetching in components)
 *   rbac-security-system §2 (Role-based access enforced by RLS; UI guards in components)
 *   safe-code-modification §1C (Documentation for all logic blocks)
 */

import { supabase } from '../core/supabaseClient';

// ---------------------------------------------------------------------------
// CONTRIBUTOR (MAKER): Submit a new edit request
//
// Creates a row in attendance_edit_requests with request_status='pending'.
// Does NOT modify daily_attendances. The editor approves before anything
// changes on the source of truth.
//
// @param {object} params
//   @param {string} params.employeeId                 - Employee UUID
//   @param {string} params.shiftDate                  - 'YYYY-MM-DD'
//   @param {string} params.suggestedStatus            - attendance_status_enum value
//   @param {string|null} params.suggestedShiftType    - shift_type_enum value or null
//   @param {string|null} params.suggestedFirstLoginTime - ISO timestamp or null
//   @param {string|null} params.suggestedLogoutTime   - ISO timestamp or null
//   @param {string|null} params.dailyAttendanceId     - UUID of existing record (null if future date)
//   @param {string} params.requestedBy                - user_profiles UUID (auth.uid())
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function submitEditRequest({
  employeeId,
  shiftDate,
  suggestedStatus,
  suggestedShiftType = null,
  suggestedFirstLoginTime = null,
  suggestedLogoutTime = null,
  dailyAttendanceId = null,
  requestedBy,
}) {
  const { data, error } = await supabase
    .from('attendance_edit_requests')
    .insert({
      employee_id:                   employeeId,
      shift_date:                    shiftDate,
      suggested_status:              suggestedStatus,
      suggested_shift_type:          suggestedShiftType,
      suggested_first_login_time:    suggestedFirstLoginTime,
      suggested_logout_time:         suggestedLogoutTime,
      daily_attendance_id:           dailyAttendanceId,
      requested_by:                  requestedBy,
      request_status:                'pending',   // Always starts as pending
    })
    .select()
    .single();

  if (error) {
    console.error('[editRequestService] submitEditRequest error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Fetch all pending edit requests
//
// Returns requests joined with employee and requester user profile data
// for the Approval Drawer UI.
//
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchPendingRequests() {
  const { data, error } = await supabase
    .from('attendance_edit_requests')
    .select(`
      id,
      shift_date,
      suggested_status,
      suggested_shift_type,
      suggested_first_login_time,
      suggested_logout_time,
      daily_attendance_id,
      request_status,
      created_at,
      employees (
        id,
        full_name,
        emp_code,
        hubs ( id, name, hub_code )
      ),
      requester:requested_by (
        id,
        name,
        email
      )
    `)
    .eq('request_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[editRequestService] fetchPendingRequests error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Approve a request
//
// Two-step atomic operation:
//   1. Update the edit request row: request_status='approved', set reviewed_by
//   2. Upsert into daily_attendances with the suggested values
//
// IMPORTANT: These are two separate Supabase calls. If step 2 fails, step 1
// has already committed. In a future iteration, wrap these in a DB transaction
// via an RPC function to ensure atomicity.
//
// @param {object} params
//   @param {string} params.requestId          - UUID of the attendance_edit_requests row
//   @param {string} params.reviewedBy         - user_profiles UUID (editor's auth.uid())
//   @param {object} params.request            - The full request object from fetchPendingRequests
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function approveRequest({ requestId, reviewedBy, request }) {
  // --- STEP 1: Mark the edit request as approved ---
  const { error: updateError } = await supabase
    .from('attendance_edit_requests')
    .update({
      request_status: 'approved',
      reviewed_by:    reviewedBy,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[editRequestService] approveRequest - update request error:', updateError);
    return { data: null, error: updateError };
  }

  // --- STEP 2: Upsert into daily_attendances (applying the approved change) ---
  // ON CONFLICT on (employee_id, shift_date) will UPDATE if record exists, INSERT if not.
  const upsertPayload = {
    employee_id:       request.employees?.id,
    shift_date:        request.shift_date,
    attendance_status: request.suggested_status,
    shift_type:        request.suggested_shift_type || null,
    first_login_time:  request.suggested_first_login_time || null,
    logout_time:       request.suggested_logout_time || null,
    updated_at:        new Date().toISOString(),
  };

  const { data: upsertData, error: upsertError } = await supabase
    .from('daily_attendances')
    .upsert(upsertPayload, {
      onConflict: 'employee_id,shift_date',  // Composite unique key
    })
    .select()
    .single();

  if (upsertError) {
    console.error('[editRequestService] approveRequest - upsert attendance error:', upsertError);
    // NOTE: The request was already marked approved above. Log this prominently.
    // TODO: In Phase 2+, convert to a single atomic RPC.
    return { data: null, error: upsertError };
  }

  return { data: upsertData, error: null };
}

// ---------------------------------------------------------------------------
// EDITOR (CHECKER): Reject a request
//
// Simply updates the edit request status without touching daily_attendances.
//
// @param {object} params
//   @param {string} params.requestId  - UUID of the attendance_edit_requests row
//   @param {string} params.reviewedBy - user_profiles UUID (editor's auth.uid())
//   @param {string} params.reviewNote - Optional rejection reason
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function rejectRequest({ requestId, reviewedBy, reviewNote = '' }) {
  const { data, error } = await supabase
    .from('attendance_edit_requests')
    .update({
      request_status: 'rejected',
      reviewed_by:    reviewedBy,
      review_note:    reviewNote,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) {
    console.error('[editRequestService] rejectRequest error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// MANAGER BOARD: Fetch requests for a specific attendance record
--
// Used to load the request history when an editor clicks a ⚠️ cell.
//
// @param {string} dailyAttendanceId - UUID of the daily_attendances row
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchRequestsForAttendance(dailyAttendanceId) {
  const { data, error } = await supabase
    .from('attendance_edit_requests')
    .select(`
      id,
      suggested_status,
      suggested_shift_type,
      suggested_first_login_time,
      suggested_logout_time,
      request_status,
      review_note,
      created_at,
      requester:requested_by ( id, name, email ),
      reviewer:reviewed_by ( id, name, email )
    `)
    .eq('daily_attendance_id', dailyAttendanceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[editRequestService] fetchRequestsForAttendance error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}
```

---

## Validation Checklist

- [ ] `editRequestService.js` is in `src/services/employees/` (alongside `attendanceService.js`)
- [ ] `submitEditRequest` inserts with `request_status: 'pending'`
- [ ] `approveRequest` performs both: (1) update request row AND (2) upsert to `daily_attendances`
- [ ] `rejectRequest` only updates the request row — does NOT touch `daily_attendances`
- [ ] The TODO comment about future atomic RPC is preserved for Phase 2+
- [ ] No direct `supabase.from()` calls in any component file

---

## DO NOT Proceed to Phase 2.3 Until All Items Above Are Checked.
