/**
 * remarksBoard.js
 * Column + grouping config for the Remarks Manager kanban.
 * Columns are driven by the remark grade (task.priority) instead of workflow stage,
 * and cards are grouped by employee (active first, inactive below).
 */
import { REMARK_GRADE_MAP } from './remarksMapping';

export const REMARKS_VERTICAL_ID = 'employee_tasks';

// Left → right order. `id` is the stored priority value.
export const REMARK_COLUMNS = [
  { id: 'Urgent', label: REMARK_GRADE_MAP.Urgent, color: 'var(--priority-urgent)', badgeClass: 'priority-urgent' },
  { id: 'High', label: REMARK_GRADE_MAP.High, color: 'var(--priority-high)', badgeClass: 'priority-high' },
  { id: 'Medium', label: REMARK_GRADE_MAP.Medium, color: 'var(--priority-medium)', badgeClass: 'priority-medium' },
  { id: 'Low', label: REMARK_GRADE_MAP.Low, color: 'var(--priority-low)', badgeClass: 'priority-low' },
];

/**
 * Counts how many remarks fall into each REMARK_COLUMNS grade.
 * Returns only columns with count > 0 when `nonZeroOnly` is true.
 */
export const getRemarkGradeCounts = (tasks = [], nonZeroOnly = true) => {
  const counts = { Urgent: 0, High: 0, Medium: 0, Low: 0 };
  (tasks || []).forEach((t) => {
    const grade = normalizeRemarkGrade(t?.priority);
    counts[grade] = (counts[grade] || 0) + 1;
  });
  const list = REMARK_COLUMNS.map((col) => ({
    ...col,
    count: counts[col.id] || 0,
  }));
  return nonZeroOnly ? list.filter((item) => item.count > 0) : list;
};

/** Normalises any stored priority (case/numeric) into a REMARK_COLUMNS id. */
export const normalizeRemarkGrade = (priority) => {
  const p = String(priority ?? '').toLowerCase();
  if (p === 'urgent' || p === '4') return 'Urgent';
  if (p === 'high' || p === '3') return 'High';
  if (p === 'medium' || p === '2') return 'Medium';
  return 'Low';
};

/** Primary employee of a remark = first assignee. */
export const getRemarkEmployeeId = (task) => {
  const a = task?.assigned_to;
  return (Array.isArray(a) ? a[0] : a) || null;
};

export const getRemarkEmployeeName = (task, statusMap = {}) => {
  const id = getRemarkEmployeeId(task);
  if (!id) return 'Unassigned';
  return statusMap[id]?.name || (task.assigneeName || '').split(',')[0].trim() || 'Unknown Employee';
};

/**
 * Builds ordered employee groups: active (A→Z), unassigned, then inactive (A→Z).
 * @param {Array} tasks - Filtered remarks/tasks
 * @param {Object} statusMap - Map of { [employeeId]: { name, isActive } }
 * @param {Object} options - { activeNamedOnly: boolean }
 * @returns {Array<{key:string,label:string,isActive:boolean,isUnassigned:boolean,tasks:Array,gradeCounts:Array}>}
 */
export const groupRemarksByEmployee = (tasks = [], statusMap = {}, options = {}) => {
  const { activeNamedOnly = false } = options;
  const groups = new Map();
  tasks.forEach((t) => {
    const key = getRemarkEmployeeId(t) || 'unassigned';
    if (!groups.has(key)) {
      const info = statusMap[key];
      const isUnassigned = key === 'unassigned';
      // Unknown status (not yet loaded) is treated as active unless it is unassigned.
      const isActive = isUnassigned ? false : (info ? info.isActive : true);
      groups.set(key, {
        key,
        label: getRemarkEmployeeName(t, statusMap),
        isActive,
        isUnassigned,
        tasks: [],
      });
    }
    groups.get(key).tasks.push(t);
  });

  const sorted = [...groups.values()]
    .map((g) => ({
      ...g,
      gradeCounts: getRemarkGradeCounts(g.tasks, true),
    }))
    .filter((g) => g.tasks.length > 0)
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
      return a.label.localeCompare(b.label);
    });

  if (activeNamedOnly) {
    return sorted.filter((g) => g.isActive && !g.isUnassigned);
  }
  return sorted;
};
