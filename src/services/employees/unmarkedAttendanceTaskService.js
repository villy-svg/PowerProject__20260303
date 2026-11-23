/**
 * Unmarked Attendance & Consecutive Week-Off Task Service
 * Shared frontend helpers & SECURITY DEFINER RPC wrappers for attendance
 * closure Maker-Checker tasks (Phase 2 Consecutive Week-Off Escalations and
 * Phase 3 Unmarked Attendance Manager Tasks).
 *
 * Board Placement Rule (see .agent/rules/verticals-and-boards-architecture.md):
 *   - Created in Charging Hubs -> Escalations Task Board
 *     (vertical_id = 'CHARGING_HUBS', task_board = ['Escalations']).
 *   - NEVER placed in Employees -> Remarks Manager (which is strictly for
 *     personal employee remarks/mistakes assigned to the employee themselves).
 *   - Also surfaced read-only to the subject employee in Home -> Track Requests
 *     so they are aware an attendance alert has been sent to their manager.
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
 * Formats an ISO YYYY-MM-DD shift_date for consistent display across cards & modals.
 */
export const formatAttendanceShiftDate = (isoDate) => {
  if (!isoDate) return '—';
  const parts = String(isoDate).split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return dt.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/**
 * True when the logged-in user is the subject employee whose attendance is
 * unmarked or escalated on this task.
 */
export const isSubjectEmployeeOfAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  const userEmpId = user.employeeId || user.employee_id;
  const subjectEmpId = task.metadata?.employee_id;
  if (!userEmpId || !subjectEmpId) return false;
  return String(userEmpId) === String(subjectEmpId);
};

/**
 * Builds the read-only awareness warning text shown to the subject employee
 * in Home -> Track Requests and the task detail panel.
 */
export const getSubjectAttendanceWarningText = (task) => {
  const meta = task?.metadata || {};
  const dateLabel = formatAttendanceShiftDate(meta.shift_date);
  const isConsecutiveWO = meta.type === ATTENDANCE_TASK_TYPES.CONSECUTIVE_WEEKOFF;
  if (isConsecutiveWO) {
    return `Alert sent to your manager — your consecutive Week-Off request for ${dateLabel} is under review.`;
  }
  return `Alert sent to your manager — your attendance for ${dateLabel} was unmarked. If you were Present, submit an Attendance Edit Request on the Attendance Board.`;
};

/**
 * True when the user can act as Maker (submit non-present status) on a
 * BACKLOG attendance closure task. Blocks subject-employee self-marking
 * (unless master_admin).
 */
export const canMarkAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (task.stageId !== 'BACKLOG') return false;
  if (user.roleId === 'master_admin') return true;
  if (isSubjectEmployeeOfAttendanceTask(task, user)) return false;
  if (user.verticalPermissions?.EMPLOYEES?.level === 'admin') return true;
  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  if (task.assignedTo === userEmpId || task.assigned_to === userEmpId) return true;
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userEmpId)) return true;
  return false;
};

/**
 * True when the user can act as Checker (approve/reject) on a REVIEW
 * attendance closure task. Blocks non-master self-approval and subject-employee
 * self-review.
 */
export const canReviewAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (task.stageId !== 'REVIEW') return false;

  const isMasterAdmin = user.roleId === 'master_admin';
  if (!isMasterAdmin && isSubjectEmployeeOfAttendanceTask(task, user)) {
    return false;
  }
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
 * True when an attendance closure task (UNMARKED_ATTENDANCE or
 * CONSECUTIVE_WEEKOFF_ESCALATION) should appear in Home -> Track Requests
 * (HomeEscalationsBoard):
 *   1. Subject employee (read-only warning awareness)
 *   2. Master Admin (org-wide visibility)
 *   3. Assigned Checker / Employees Editor+ (for REVIEW tasks)
 *   4. Upward reporting manager (when assigned manager or subject employee is in reportees)
 */
export const isAttendanceClosureVisibleToUser = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (isSubjectEmployeeOfAttendanceTask(task, user)) return true;
  if (user.roleId === 'master_admin') return true;
  if (canReviewAttendanceTask(task, user)) return true;

  const reporteeEmpIds = user.reporteeEmployeeIds || [];
  if (reporteeEmpIds.length > 0) {
    const subjectEmpId = task.metadata?.employee_id;
    const assignees = Array.isArray(task.assigned_to)
      ? task.assigned_to
      : (task.assigned_to ? [task.assigned_to] : (task.assignedTo ? [task.assignedTo] : []));
    if (
      (subjectEmpId && reporteeEmpIds.includes(subjectEmpId)) ||
      assignees.some((id) => reporteeEmpIds.includes(id))
    ) {
      return true;
    }
  }
  return false;
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
