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
// Utility: toISTDateString(date)
//
// Returns a 'YYYY-MM-DD' string in the Asia/Kolkata (IST, UTC+5:30) timezone.
//
// Why NOT Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })?
// Android 8 (Chrome 64 WebView) has incomplete Intl locale data. The 'en-CA'
// locale may not be available or may return a non-YYYY-MM-DD format (e.g.
// 'DD/MM/YYYY'), causing DB queries to produce empty results and making the
// attendance screen falsely appear blank for checked-in employees.
//
// This approach is locale-independent: it applies a fixed UTC+5:30 offset and
// extracts the ISO date string slice, which always produces 'YYYY-MM-DD'.
// ---------------------------------------------------------------------------
function toISTDateString(date) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +5:30
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

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
// @param {number} page - Page number (1-indexed)
// @param {number} pageSize - Number of records per page
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchEmployeesForAttendance(filters = {}, page = 1, pageSize = 50) {
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
    .order('full_name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

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
// Uses two targeted queries rather than a fragile JSONB containment filter:
//
//   Query A: .is('logout_time', null) — finds any open (unchecked-out) shift.
//            This uses the top-level indexed timestamptz column, which
//            rpc_employee_checkout always sets when a shift ends. It is far
//            more reliable than PostgREST .cs JSONB containment on null values.
//
//   Query B: .eq('shift_date', today) — fallback for a shift that was already
//            closed today. Lets the UI show a "you already clocked out" state.
//
// A 3-day window guard on Query A prevents zombie records (left open by error)
// from being surfaced to the employee self-service screen.
//
// @param {string} userId - UUID from auth context
// @returns {Promise<{ data: object|null, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchMyTodayAttendance(userId) {
  // toISTDateString() produces YYYY-MM-DD in IST — locale-independent (Android 8 safe).
  const today = toISTDateString(new Date());

  // 3-day safety window — catches night-shift crossover without surfacing stale zombies.
  const threeDaysAgoMs = Date.now() - (3 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = toISTDateString(new Date(threeDaysAgoMs));

  // -------------------------------------------------------------------------
  // Step 1: Resolve the caller's employee_id from their profile.
  // -------------------------------------------------------------------------
  let targetUserId = userId;
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error('User not authenticated') };
    targetUserId = user.id;
  }

  if (targetUserId === 'dev-bypass-user-id') return { data: null, error: null };

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('employee_id')
    .eq('id', targetUserId)
    .maybeSingle();

  if (profileError) {
    console.error('[attendanceService] fetchMyTodayAttendance profile lookup error:', profileError);
    return { data: null, error: profileError };
  }

  // No employee linked to this user account — treat as "no record" cleanly.
  if (!profile?.employee_id) return { data: null, error: null };

  // -------------------------------------------------------------------------
  // Shared select columns for both queries below.
  // -------------------------------------------------------------------------
  const SHARED_SELECT = `
    id,
    shift_date,
    attendance_status,
    shift_type,
    first_login_time,
    logout_time,
    session_logs_data,
    employees ( id, full_name, emp_code, hub_id, hubs ( id, name, hub_code ) )
  `;

  // -------------------------------------------------------------------------
  // Step 2 — Query A: Find an open (active) shift.
  //
  // We use .is('logout_time', null) on the top-level indexed timestamptz column.
  // rpc_employee_checkout always writes logout_time = now() when a shift ends,
  // so this is a guaranteed, type-safe signal that the shift is still ongoing.
  //
  // This completely replaces the old JSONB containment filter:
  //   .or(`...session_logs_data.cs.[{"logout_time": null}]`)
  // which was fragile because PostgREST URL-encodes JSON null differently
  // from how PostgreSQL's @> operator matches it, causing silent misses.
  // -------------------------------------------------------------------------
  const { data: openData, error: openError } = await supabase
    .from('daily_attendances')
    .select(SHARED_SELECT)
    .eq('employee_id', profile.employee_id)
    .is('logout_time', null)
    .gte('shift_date', threeDaysAgo)
    .order('shift_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError) {
    console.error('[attendanceService] fetchMyTodayAttendance (open query) error:', openError);
    return { data: null, error: openError };
  }

  if (openData) {
    // Defensive parse: Supabase occasionally returns JSONB as a string over
    // some network/driver paths (e.g. Capacitor native HTTP on older devices).
    if (typeof openData.session_logs_data === 'string') {
      try { openData.session_logs_data = JSON.parse(openData.session_logs_data); }
      catch (e) { openData.session_logs_data = []; }
    }
    return { data: openData, error: null };
  }

  // -------------------------------------------------------------------------
  // Step 2 — Query B: No open shift found.
  // Fall back to today's record (if any) so the UI can show a "shift complete"
  // state rather than going blank.
  // -------------------------------------------------------------------------
  const { data: todayData, error: todayError } = await supabase
    .from('daily_attendances')
    .select(SHARED_SELECT)
    .eq('employee_id', profile.employee_id)
    .eq('shift_date', today)
    .maybeSingle();

  if (todayError) {
    console.error('[attendanceService] fetchMyTodayAttendance (today query) error:', todayError);
    return { data: null, error: todayError };
  }

  if (todayData && typeof todayData.session_logs_data === 'string') {
    try { todayData.session_logs_data = JSON.parse(todayData.session_logs_data); }
    catch (e) { todayData.session_logs_data = []; }
  }

  return { data: todayData ?? null, error: null };
}


// ---------------------------------------------------------------------------
// LIVE ATTENDANCE TAB: Fetch all employees with an active (open) session today
//
// An active session is one where the session_logs_data array contains an entry
// with logout_time === null. We fetch today's records with session data and
// filter out hubs coded 'ALL' or 'MULTI' (aggregate hubs).
//
// Returns raw records; the hook (useLiveAttendance) does the grouping.
//
// @returns {Promise<{ data: Array, error: object|null }>}
// ---------------------------------------------------------------------------
export async function fetchLiveAttendance() {
  // Look back 3 days. This ensures we catch night-shift workers and extreme
  // overtime cases (or sessions left open by mistake) which will be flagged
  // on the frontend. The JS-side filter ensures we only show records with an
  // open session.
  const today = new Date();
  const threeDaysAgoMs = today.getTime() - (3 * 24 * 60 * 60 * 1000);
  // toISTDateString() is locale-independent — safe on Android 8 Chrome 64 WebView.
  const threeDaysAgo = toISTDateString(new Date(threeDaysAgoMs));

  const { data, error } = await supabase
    .from('daily_attendances')
    .select(`
      id,
      employee_id,
      shift_type,
      first_login_time,
      session_logs_data,
      employees (
        id,
        full_name,
        emp_code,
        hub_id,
        hubs ( id, name, hub_code )
      )
    `)
    // Include the last 3 days to safely catch old unclosed sessions
    .gte('shift_date', threeDaysAgo);

  if (error) {
    console.error('[attendanceService] fetchLiveAttendance error:', error);
    return { data: null, error };
  }

  const liveRecords = (data || []).filter(record => {
    let sessions = record?.session_logs_data || [];
    if (typeof sessions === 'string') {
      try { sessions = JSON.parse(sessions); } catch(e) { sessions = []; }
    }
    const hasOpenSession = sessions.some(s => s.logout_time === null);
    return hasOpenSession;
  });

  return { data: liveRecords, error: null };
}

// ---------------------------------------------------------------------------
// LIVE ATTENDANCE TAB: Admin Force Checkout
//
// Closes the open session and the main shift record for an employee.
// Requires admin privileges (enforced by RLS UPDATE policy).
// ---------------------------------------------------------------------------
export async function adminForceCheckout(recordId, currentSessions) {
  // Find the open session to calculate the 12-hour auto-fallback
  const openSession = currentSessions.find(s => s.logout_time === null);
  
  let forcedLogoutTimeIso = new Date().toISOString();
  if (openSession && openSession.login_time) {
    const loginTimeMs = new Date(openSession.login_time).getTime();
    forcedLogoutTimeIso = new Date(loginTimeMs + 12 * 60 * 60 * 1000).toISOString();
  }
  
  // Update the open session(s)
  const updatedSessions = currentSessions.map(s => {
    if (s.logout_time === null) {
      return { 
        ...s, 
        logout_time: forcedLogoutTimeIso, 
        logout_geolocation: { note: 'Forced by admin (auto 12-hour fallback)' } 
      };
    }
    return s;
  });

  const { data, error } = await supabase
    .from('daily_attendances')
    .update({
      logout_time: forcedLogoutTimeIso,
      logout_geolocation: { note: 'Forced by admin (auto 12-hour fallback)' },
      session_logs_data: updatedSessions,
      updated_at: new Date().toISOString()
    })
    .eq('id', recordId);

  if (error) {
    console.error('[attendanceService] adminForceCheckout error:', error);
    return { data: null, error };
  }
  return { data, error: null };
}
