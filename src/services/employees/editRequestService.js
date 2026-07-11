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
  makerNote = null,
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
      maker_note:                    makerNote,
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
// Single atomic operation via RPC:
//   1. Lock and mark the edit request as approved
//   2. Upsert into daily_attendances
//   3. If 'leave', deduct from Leave Wallet
//
// @param {object} params
//   @param {string} params.requestId          - UUID of the attendance_edit_requests row
//   @param {string} params.reviewedBy         - user_profiles UUID (editor's auth.uid())
//   @param {object} params.request            - The full request object from fetchPendingRequests
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function approveRequest({ requestId, reviewedBy, request }) {
  const { data, error } = await supabase.rpc('approve_attendance_edit_request', {
    p_request_id: requestId,
    p_reviewer_id: reviewedBy
  });

  if (error) {
    console.error('[editRequestService] approveRequest error:', error);
    return { data: null, error };
  }

  return { data, error: null };
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
//
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
