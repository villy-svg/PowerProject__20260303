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
  { id: 'Urgent', label: REMARK_GRADE_MAP.Urgent, color: '#ef4444' },
  { id: 'High', label: REMARK_GRADE_MAP.High, color: '#f97316' },
  { id: 'Medium', label: REMARK_GRADE_MAP.Medium, color: '#f59e0b' },
  { id: 'Low', label: REMARK_GRADE_MAP.Low, color: '#10b981' },
];

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
 * @returns {Array<{key:string,label:string,isActive:boolean,tasks:Array}>}
 */
export const groupRemarksByEmployee = (tasks, statusMap = {}) => {
  const groups = new Map();
  tasks.forEach((t) => {
    const key = getRemarkEmployeeId(t) || 'unassigned';
    if (!groups.has(key)) {
      const info = statusMap[key];
      groups.set(key, {
        key,
        label: getRemarkEmployeeName(t, statusMap),
        // Unknown status (not yet loaded) is treated as active.
        isActive: key === 'unassigned' ? true : (info ? info.isActive : true),
        isUnassigned: key === 'unassigned',
        tasks: [],
      });
    }
    groups.get(key).tasks.push(t);
  });

  return [...groups.values()].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (a.isUnassigned !== b.isUnassigned) return a.isUnassigned ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
};
