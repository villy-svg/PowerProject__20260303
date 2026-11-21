/**
 * Unmarked Attendance & Consecutive Week-Off Task Service
 * Shared frontend helpers & SECURITY DEFINER RPC wrappers for attendance
 * closure Maker-Checker tasks (Phase 2 Consecutive Week-Off Escalations and
 * Phase 3 Unmarked Attendance Manager Tasks).
 *
 * Canonical location: src/services/employees/unmarkedAttendanceTaskService.js
 * Mirrors: src/services/employees/employeeRequestService.js
 */
import { supabase } from '../core/supabaseClient';

export const ATTENDANCE_TASK_TYPES = {
  CONSECUTIVE_WEEKOFF: 'CONSECUTIVE_WEEKOFF_ESCALATION',
  UNMARKED: 'UNMARKED_ATTENDANCE',
};

/**
 * The 5 allowed non-present attendance statuses.
 * 'present' is intentionally excluded (enforced at both UI and DB layers).
 */
export const UNMARKED_ATTENDANCE_OPTIONS = [
  { value: 'week-off', label: 'Week-Off' },
  { value: 'leave', label: 'Leave' },
  { value: 'absent', label: 'Absent' },
  { value: 'no-show', label: 'No Show' },
  { value: 'no-call-no-show', label: 'No Call No Show' },
];

export const getAttendanceOptionLabel = (statusValue) => {
  if (!statusValue) return '—';
  const match = UNMARKED_ATTENDANCE_OPTIONS.find((opt) => opt.value === statusValue);
  return match ? match.label : statusValue;
};

/**
 * True when a task row is a Phase 2 Consecutive Week-Off Escalation or
 * Phase 3 Unmarked Attendance Maker-Checker task.
 */
export const isAttendanceClosureTask = (task) => {
  const type = task?.metadata?.type;
  return (
    type === ATTENDANCE_TASK_TYPES.CONSECUTIVE_WEEKOFF ||
    type === ATTENDANCE_TASK_TYPES.UNMARKED
  );
};

/**
 * True when the user can act as Maker (submit non-present status) on a
 * BACKLOG attendance closure task.
 */
export const canMarkAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (task.stageId !== 'BACKLOG') return false;
  if (user.roleId === 'master_admin') return true;
  if (user.verticalPermissions?.EMPLOYEES?.level === 'admin') return true;
  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  if (task.assignedTo === userEmpId || task.assigned_to === userEmpId) return true;
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userEmpId)) return true;
  return false;
};

/**
 * True when the user can act as Checker (approve/reject) on a REVIEW
 * attendance closure task. Blocks non-master self-approval.
 */
export const canReviewAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (task.stageId !== 'REVIEW') return false;

  const isMasterAdmin = user.roleId === 'master_admin';
  const makerUserId = task.metadata?.maker_user_id;
  if (!isMasterAdmin && makerUserId && makerUserId === user.id) {
    return false;
  }

  if (isMasterAdmin || user.roleId === 'master_editor') return true;
  const empLevel = user.verticalPermissions?.EMPLOYEES?.level;
  if (empLevel === 'editor' || empLevel === 'admin') return true;

  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  if (task.assignedTo === userEmpId || task.assigned_to === userEmpId) return true;
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userEmpId)) return true;
  return false;
};

/**
 * True when a master_admin / Employees Editor+ should see orphan attendance
 * tasks on Centralised Task Board even when assigned_to is NULL.
 */
export const isAttendanceOrphanVisibleToUser = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (user.roleId !== 'master_admin') return false;
  return Boolean(task.metadata?.is_orphan_employee || task.metadata?.is_orphan_manager);
};

/**
 * Maker submits one of the 5 non-present statuses (moves task BACKLOG -> REVIEW).
 */
export const submitAttendanceTaskChoice = async (taskId, status, note = null) => {
  const { data, error } = await supabase.rpc('rpc_submit_attendance_task_choice', {
    p_task_id: taskId,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
  return data;
};

/**
 * Checker approves the submitted attendance status (writes daily_attendances -> COMPLETED).
 */
export const approveAttendanceTask = async (taskId, reviewNote = null) => {
  const { data, error } = await supabase.rpc('rpc_approve_attendance_task', {
    p_task_id: taskId,
    p_review_note: reviewNote,
  });
  if (error) throw error;
  return data;
};

/**
 * Checker rejects the submitted status (returns task REVIEW -> BACKLOG for Maker).
 */
export const rejectAttendanceTask = async (taskId, reviewNote = null) => {
  const { data, error } = await supabase.rpc('rpc_reject_attendance_task', {
    p_task_id: taskId,
    p_review_note: reviewNote,
  });
  if (error) throw error;
  return data;
};
