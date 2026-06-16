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

  // Apply optional employee filter for restricted visibility
  if (filters.employeeId) {
    query = query.eq('id', filters.employeeId);
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
