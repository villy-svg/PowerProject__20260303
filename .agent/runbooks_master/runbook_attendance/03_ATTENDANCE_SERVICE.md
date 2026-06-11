# Phase 2.1 — Attendance Service (Check-In / Check-Out Logic)

## Skills Required (Read Before Starting)
- `development-best-practices` §10 (Zero raw fetching in components — Repository Pattern)
- `development-best-practices` §2 (Isolate business logic in hooks/services)
- `safe-code-modification` §1 (Additive imports, never remove existing logic)
- `hybrid-mobile-deployment` §4 (Platform guards for geolocation/device ID)

---

## Objective

Create `attendanceService.js` — the service layer for all attendance data access. This file handles:
1. Fetching attendance records for the Manager Board (date-range + join for pending indicators)
2. Employee check-in (start shift) logic
3. Employee check-out (end shift) logic

**No React component will call `supabase.from()` directly for attendance. All Supabase calls live here.**

---

## Architecture Decision: RPC vs Client-Side for Self-Service

Employee self-service check-in involves:
1. Checking if a record exists for today
2. Upserting the record
3. Updating the JSONB `session_logs_data` array

Because employees may not have `editor` RLS permissions, this MUST use a **Postgres RPC function** (`rpc()`) called from the client with the user's session — OR a service function that applies the logic through an Edge Function with the service role.

**Chosen approach for MVP**: Create a database RPC function (`rpc_employee_checkin` and `rpc_employee_checkout`) that runs as the calling user but with `SECURITY DEFINER` to bypass RLS restrictions specifically for self-service attendance. This is the safest MVP approach.

---

## Step 1: Create the RPC Migration File

**File to create:**
```
supabase/migrations/20260611000002_attendance_rpc_functions.sql
```

**Full SQL Content:**

```sql
-- =========================================================================
-- POWERPROJECT: Attendance Board — Phase 2.1: RPC Functions
--
-- These RPC functions allow employees to check in/out to their own
-- attendance records without needing 'editor' RLS access on daily_attendances.
-- They run as SECURITY DEFINER (elevated) but validate the caller's identity.
--
-- Skill compliance:
--   database-migration-policy §5 (PostgreSQL Kick)
--   rbac-security-system §3 (Access validation inside function)
-- =========================================================================

-- -------------------------------------------------------------------------
-- RPC: rpc_employee_checkin
--
-- Called when an employee taps "Start Shift".
-- Behavior:
--   1. Look up the calling user's employee_id from user_profiles.
--   2. Check if a daily_attendances record exists for today.
--   3. If none: insert with status='present', first_login_time=now().
--   4. If exists with status 'week-off' or 'leave': override to 'present'.
--   5. Append a new session object to session_logs_data JSONB array.
--   6. Return the upserted record.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkin(
  p_shift_type      text,         -- 'day' or 'night'
  p_hub_id          uuid,         -- Selected hub for this shift
  p_device_id       text,         -- Device identifier (from Capacitor)
  p_geolocation     jsonb         -- { lat, lng, accuracy }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as the function owner, bypassing RLS for self-service
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_employee_id   uuid;
  v_shift_date    date := CURRENT_DATE;
  v_existing_rec  public.daily_attendances;
  v_session_entry jsonb;
  v_result        jsonb;
BEGIN
  -- 1. Resolve employee_id from user_profiles
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  -- 2. Build the new session log entry
  v_session_entry := jsonb_build_object(
    'hub_id',              p_hub_id,
    'login_time',          now(),
    'logout_time',         NULL,
    'device_id',           p_device_id,
    'login_geolocation',   p_geolocation,
    'logout_geolocation',  NULL
  );

  -- 3. Upsert the daily attendance record
  INSERT INTO public.daily_attendances (
    employee_id,
    shift_date,
    attendance_status,
    shift_type,
    first_login_time,
    login_geolocation,
    session_logs_data
  )
  VALUES (
    v_employee_id,
    v_shift_date,
    'present',
    p_shift_type::public.shift_type_enum,
    now(),
    p_geolocation,
    jsonb_build_array(v_session_entry)  -- Init array with first session
  )
  ON CONFLICT (employee_id, shift_date)
  DO UPDATE SET
    -- Override 'week-off'/'leave'/'absent' to 'present' on physical check-in
    attendance_status = 'present',
    shift_type        = EXCLUDED.shift_type,
    -- Preserve first_login_time if already set (don't overwrite with re-login)
    first_login_time  = COALESCE(daily_attendances.first_login_time, now()),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation),
    -- Append new session to the JSONB array
    session_logs_data = daily_attendances.session_logs_data || jsonb_build_array(v_session_entry),
    updated_at        = now()
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- -------------------------------------------------------------------------
-- RPC: rpc_employee_checkout
--
-- Called when an employee taps "End Shift".
-- Behavior:
--   1. Resolve employee_id from user_profiles.
--   2. Find the open (active) session in session_logs_data (logout_time IS NULL).
--   3. Set main logout_time and update the open session object in JSONB.
--   4. Return the updated record.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkout(
  p_device_id       text,
  p_geolocation     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_employee_id   uuid;
  v_shift_date    date := CURRENT_DATE;
  v_rec           public.daily_attendances;
  v_sessions      jsonb;
  v_updated_sessions jsonb;
  v_session       jsonb;
  v_i             integer;
  v_result        jsonb;
BEGIN
  -- 1. Resolve employee_id
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  -- 2. Fetch the existing record for today
  SELECT * INTO v_rec
  FROM public.daily_attendances
  WHERE employee_id = v_employee_id
    AND shift_date = v_shift_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active attendance record found for today.';
  END IF;

  -- 3. Find the open session (logout_time IS NULL) and close it
  v_sessions := v_rec.session_logs_data;
  v_updated_sessions := '[]'::jsonb;

  FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_i;
    -- Close the most recent open session
    IF (v_session->>'logout_time') IS NULL THEN
      v_session := v_session
        || jsonb_build_object(
             'logout_time',        now(),
             'logout_geolocation', p_geolocation
           );
    END IF;
    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  -- 4. Update the record
  UPDATE public.daily_attendances
  SET
    logout_time          = now(),
    logout_geolocation   = p_geolocation,
    session_logs_data    = v_updated_sessions,
    updated_at           = now()
  WHERE employee_id = v_employee_id
    AND shift_date = v_shift_date
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users so they can call via supabase.rpc()
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkout(text, jsonb)
  TO authenticated;

-- -------------------------------------------------------------------------
-- PostgreSQL Kick
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
```

---

## Step 2: Create the Frontend Service File

**File to create:**
```
src/services/employees/attendanceService.js
```

**Full JS Content:**

```javascript
/**
 * attendanceService.js
 *
 * Repository layer for all attendance-related data access.
 * NO React component should call supabase.from('daily_attendances') directly.
 * All Supabase calls for attendance live here.
 *
 * Skill compliance:
 *   development-best-practices §10 (Zero raw fetching in components)
 *   development-best-practices §6 (Strict equality, camelCase/snake_case matching)
 *   safe-code-modification §1C (Documentation for all logic blocks)
 */

import { supabase } from '../core/supabaseClient';

// ---------------------------------------------------------------------------
// MANAGER BOARD: Fetch attendance records for a date range
//
// Joins with attendance_edit_requests to include a `has_pending_edit` flag
// per record so the UI can render the ⚠️ indicator on grid cells.
//
// @param {string} startDate - 'YYYY-MM-DD'
// @param {string} endDate   - 'YYYY-MM-DD'
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchAttendanceForDateRange(startDate, endDate) {
  const { data, error } = await supabase
    .from('daily_attendances')
    .select(`
      id,
      employee_id,
      shift_date,
      attendance_status,
      shift_type,
      first_login_time,
      logout_time,
      login_geolocation,
      logout_geolocation,
      session_logs_data,
      updated_at,
      employees (
        id,
        full_name,
        emp_code,
        hub_id,
        hubs ( id, name, hub_code )
      ),
      attendance_edit_requests (
        id,
        request_status
      )
    `)
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)
    .order('shift_date', { ascending: true });

  if (error) {
    console.error('[attendanceService] fetchAttendanceForDateRange error:', error);
    return { data: null, error };
  }

  // Annotate each record with `has_pending_edit` for the UI badge indicator
  const annotated = (data || []).map(record => ({
    ...record,
    has_pending_edit: (record.attendance_edit_requests || []).some(
      req => req.request_status === 'pending'
    ),
  }));

  return { data: annotated, error: null };
}

// ---------------------------------------------------------------------------
// MANAGER BOARD: Fetch all employees (for grid Y-axis — ensures employees
// with NO attendance records still appear as rows with 'absent' status)
//
// @param {object} filters - { hubIds: [], departmentIds: [] }
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchEmployeesForAttendance(filters = {}) {
  let query = supabase
    .from('employees')
    .select(`
      id,
      full_name,
      emp_code,
      status,
      hub_id,
      hubs ( id, name, hub_code ),
      departments ( id, name, dept_code )
    `)
    .eq('status', 'Active')
    .order('full_name', { ascending: true });

  // Apply optional hub filter
  if (filters.hubIds && filters.hubIds.length > 0) {
    query = query.in('hub_id', filters.hubIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[attendanceService] fetchEmployeesForAttendance error:', error);
    return { data: null, error };
  }

  return { data: data || [], error: null };
}

// ---------------------------------------------------------------------------
// EMPLOYEE SELF-SERVICE: Check In (Start Shift)
//
// Calls the `rpc_employee_checkin` database function (SECURITY DEFINER).
// This allows employees without 'editor' RLS access to create their record.
//
// @param {object} params
//   @param {string} params.shiftType     - 'day' | 'night'
//   @param {string} params.hubId         - UUID of selected hub
//   @param {string} params.deviceId      - Device identifier string
//   @param {object} params.geolocation   - { lat, lng, accuracy }
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function employeeCheckIn({ shiftType, hubId, deviceId, geolocation }) {
  const { data, error } = await supabase.rpc('rpc_employee_checkin', {
    p_shift_type:   shiftType,
    p_hub_id:       hubId,
    p_device_id:    deviceId,
    p_geolocation:  geolocation,
  });

  if (error) {
    console.error('[attendanceService] employeeCheckIn error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// EMPLOYEE SELF-SERVICE: Check Out (End Shift)
//
// @param {object} params
//   @param {string} params.deviceId      - Device identifier string
//   @param {object} params.geolocation   - { lat, lng, accuracy }
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function employeeCheckOut({ deviceId, geolocation }) {
  const { data, error } = await supabase.rpc('rpc_employee_checkout', {
    p_device_id:    deviceId,
    p_geolocation:  geolocation,
  });

  if (error) {
    console.error('[attendanceService] employeeCheckOut error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}

// ---------------------------------------------------------------------------
// EMPLOYEE SELF-SERVICE: Fetch current day's record for the logged-in employee
//
// Used to determine if the "Start Shift" or "End Shift" button shows.
//
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchMyTodayAttendance() {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  const { data, error } = await supabase
    .from('daily_attendances')
    .select(`
      id,
      attendance_status,
      shift_type,
      first_login_time,
      logout_time,
      session_logs_data,
      employees ( id, full_name, emp_code, hub_id, hubs ( id, name, hub_code ) )
    `)
    .eq('shift_date', today)
    // Filter by the linked employee via user_profiles
    // Note: This relies on RLS to scope to the user's own employee record.
    // The service uses the authenticated user's session.
    .maybeSingle(); // Returns null (not error) if no record exists

  if (error) {
    console.error('[attendanceService] fetchMyTodayAttendance error:', error);
    return { data: null, error };
  }

  return { data, error: null };
}
```

---

## Validation Checklist

- [ ] `attendanceService.js` is in `src/services/employees/` (alongside `employeeService.js`)
- [ ] No `supabase.from()` calls exist in any component — only service functions
- [ ] `rpc_employee_checkin` and `rpc_employee_checkout` functions created in DB
- [ ] GRANT EXECUTE on both RPCs to `authenticated` role
- [ ] `fetchAttendanceForDateRange` returns `has_pending_edit` flag
- [ ] Migration file contains `NOTIFY pgrst` at end

---

## DO NOT Proceed to Phase 2.2 Until All Items Above Are Checked.
