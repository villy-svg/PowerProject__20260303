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
import { getMinLevel } from '../../constants/roles';

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
 * Computes the user's effective Attendance Board permission level as the
 * intersection (minimum) of the EMPLOYEES vertical level and the
 * canAccessEmployeeAttendanceBoard feature override.
 * Master roles resolve directly to their global tier.
 */
export const getEffectiveAttendanceBoardLevel = (user) => {
  if (!user) return 'none';
  if (user.roleId === 'master_admin') return 'admin';
  if (user.roleId === 'master_editor') return 'editor';
  if (user.roleId === 'master_contributor') return 'contributor';
  if (user.roleId === 'master_viewer') return 'viewer';
  const empPerm = user.verticalPermissions?.EMPLOYEES;
  const verticalLevel = empPerm?.level || 'none';
  // Nullish coalesce respects explicit 'none' overrides while allowing inherited access
  const rawFeatureLevel = empPerm?.features?.canAccessEmployeeAttendanceBoard ?? verticalLevel;
  return getMinLevel(verticalLevel, rawFeatureLevel);
};

/**
 * True when the user holds effective Contributor, Editor, or Admin access on
 * Employees -> Attendance Board (blocks Viewer and None roles).
 */
export const hasAttendanceBoardContributorAccess = (user) => {
  const effectiveLevel = getEffectiveAttendanceBoardLevel(user);
  return effectiveLevel === 'contributor' || effectiveLevel === 'editor' || effectiveLevel === 'admin';
};

/**
 * True when the user holds effective Editor or Admin access on
 * Employees -> Attendance Board (intersection of EMPLOYEES vertical level
 * and canAccessEmployeeAttendanceBoard feature override).
 * Blocks Viewer, Contributor, and None roles.
 */
export const hasAttendanceBoardEditorAccess = (user) => {
  const effectiveLevel = getEffectiveAttendanceBoardLevel(user);
  return effectiveLevel === 'editor' || effectiveLevel === 'admin';
};

/**
 * True when the logged-in user is a strict upward reporting manager
 * (ancestor in the employees.manager_id hierarchy) of either the subject
 * employee or a current assignee on this attendance closure task.
 * Excludes the user's own employeeId (which profileService includes in reporteeEmployeeIds).
 */
export const isUpwardManagerOfAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  const reporteeEmpIds = user.reporteeEmployeeIds || [];
  if (reporteeEmpIds.length === 0) return false;

  const userEmpIdStr = String(userEmpId);
  const descendantSet = new Set(
    reporteeEmpIds.map((id) => String(id)).filter((id) => id !== userEmpIdStr)
  );
  if (descendantSet.size === 0) return false;

  const subjectEmpId = task.metadata?.employee_id;
  if (subjectEmpId && descendantSet.has(String(subjectEmpId))) return true;

  const assignees = [];
  if (Array.isArray(task.assigned_to)) assignees.push(...task.assigned_to);
  else if (task.assigned_to) assignees.push(task.assigned_to);
  if (task.assignedTo) assignees.push(task.assignedTo);
  if (Array.isArray(task.assigneeIds)) assignees.push(...task.assigneeIds);

  return assignees.some((id) => id && descendantSet.has(String(id)));
};

/**
 * True when the user can act as Maker (submit non-present status) on a
 * BACKLOG attendance closure task. Blocks subject-employee self-marking
 * (unless master_admin).
 * - All non-master_admin Maker paths (direct reporting manager, EMPLOYEES admin,
 *   upward reporting manager) require at least Contributor access on
 *   Employees -> Attendance Board (blocking Viewer/None and downgraded admins).
 * - Upward reporting managers (within MAX_HIERARCHY_DEPTH = 10 hops) may act
 *   as Maker ONLY if they hold effective Editor+ access on Attendance Board.
 */
export const canMarkAttendanceTask = (task, user) => {
  if (!task || !user || !isAttendanceClosureTask(task)) return false;
  if (task.stageId !== 'BACKLOG') return false;
  if (user.roleId === 'master_admin') return true;
  if (isSubjectEmployeeOfAttendanceTask(task, user)) return false;

  // All non-master_admin Maker paths require effective Attendance Board Contributor+
  const attendanceLevel = getEffectiveAttendanceBoardLevel(user);
  if (attendanceLevel !== 'contributor' && attendanceLevel !== 'editor' && attendanceLevel !== 'admin') {
    return false;
  }

  if (user.verticalPermissions?.EMPLOYEES?.level === 'admin') return true;
  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  const userEmpIdStr = String(userEmpId);
  if (
    (task.assignedTo && String(task.assignedTo) === userEmpIdStr) ||
    (task.assigned_to && String(task.assigned_to) === userEmpIdStr)
  ) {
    return true;
  }
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.some((id) => String(id) === userEmpIdStr)) {
    return true;
  }
  // Upward reporting manager with effective Attendance Board Editor+ access
  if ((attendanceLevel === 'editor' || attendanceLevel === 'admin') && isUpwardManagerOfAttendanceTask(task, user)) {
    return true;
  }
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
  if (isUpwardManagerOfAttendanceTask(task, user)) return true;

  // Direct assignee visibility fallback (matches pre-refactor behavior when reporteeEmployeeIds included self)
  const userEmpId = user.employeeId || user.employee_id;
  if (!userEmpId) return false;
  const userEmpIdStr = String(userEmpId);
  const assignees = [];
  if (Array.isArray(task.assigned_to)) assignees.push(...task.assigned_to);
  else if (task.assigned_to) assignees.push(task.assigned_to);
  if (task.assignedTo) assignees.push(task.assignedTo);
  if (Array.isArray(task.assigneeIds)) assignees.push(...task.assigneeIds);
  return assignees.some((id) => id && String(id) === userEmpIdStr);
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
