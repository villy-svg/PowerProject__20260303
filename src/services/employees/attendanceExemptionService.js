/**
 * Employee Attendance Exemption Service
 * Future-ready repository layer for reading and toggling `employees.attendance_exempt`.
 *
 * When `attendance_exempt = true`, an active employee is excluded from:
 * - Phase 2 self-service "Was yesterday your Week-Off?" prompts
 * - Phase 3/4 automated daily Unmarked Attendance manager tasks
 *
 * Intentionally has NO UI mounted yet — ready to be imported into EmployeeForm
 * or an Admin Exemptions view whenever needed.
 *
 * Canonical location: src/services/employees/attendanceExemptionService.js
 */
import { supabase } from '../core/supabaseClient';

/**
 * Pure RBAC guard mirroring `rpc_set_employee_attendance_exempt`.
 * Only Master Admin or Employees Admin can change attendance exemptions.
 */
export const canManageAttendanceExemptions = (user) => {
  if (!user) return false;
  if (user.roleId === 'master_admin') return true;
  return user.verticalPermissions?.EMPLOYEES?.level === 'admin';
};

/**
 * Fetch all active employees currently marked `attendance_exempt = true`.
 * Returns an array of `{ id, full_name, emp_code, hub_id, attendance_exempt }`.
 */
export const fetchAttendanceExemptEmployees = async () => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, emp_code, hub_id, attendance_exempt')
    .eq('status', 'Active')
    .eq('attendance_exempt', true)
    .order('full_name', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

/**
 * Fetch the `attendance_exempt` flag for a single employee.
 * Returns `boolean`.
 */
export const fetchEmployeeAttendanceExemption = async (employeeId) => {
  if (!employeeId) return false;

  const { data, error } = await supabase
    .from('employees')
    .select('attendance_exempt')
    .eq('id', employeeId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.attendance_exempt);
};

/**
 * Toggle `employees.attendance_exempt` via the admin-guarded SECURITY DEFINER RPC.
 * Returns `{ id, full_name, emp_code, attendance_exempt }`.
 */
export const setEmployeeAttendanceExempt = async (employeeId, exempt) => {
  if (!employeeId) {
    throw new Error('employeeId is required.');
  }

  const { data, error } = await supabase.rpc('rpc_set_employee_attendance_exempt', {
    p_employee_id: employeeId,
    p_exempt: Boolean(exempt),
  });

  if (error) throw error;
  return data;
};
