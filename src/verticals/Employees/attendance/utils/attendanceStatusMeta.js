/**
 * attendanceStatusMeta.js
 *
 * Single source of truth for Attendance Board status metadata, labels,
 * select options, and CSS modifier classes across Desktop Grid, Mobile List,
 * Legend, Suggest Edit Modal, Single-Employee Multi-Day Updater, and Approval Queue.
 */

export const ATTENDANCE_STATUS_META = {
  'present': {
    label: 'Present',
    shortCode: 'P',
    gridClass: 'attendance-cell--present',
    mobileClass: 'attendance-list-item--present',
  },
  'week-off': {
    label: 'Week-Off',
    shortCode: 'WO',
    gridClass: 'attendance-cell--week-off',
    mobileClass: 'attendance-list-item--week-off',
  },
  'leave': {
    label: 'Leave',
    shortCode: 'L',
    gridClass: 'attendance-cell--leave',
    mobileClass: 'attendance-list-item--leave',
  },
  'absent': {
    label: 'Absent',
    shortCode: 'ABS',
    gridClass: 'attendance-cell--absent',
    mobileClass: 'attendance-list-item--absent',
  },
  'no-show': {
    label: 'No Show',
    shortCode: 'X',
    gridClass: 'attendance-cell--no-show',
    mobileClass: 'attendance-list-item--no-show',
  },
  'no-call-no-show': {
    label: 'No Call No Show',
    shortCode: 'XX',
    gridClass: 'attendance-cell--no-call-no-show',
    mobileClass: 'attendance-list-item--no-call-no-show',
  },
  'null': {
    label: 'Not Marked',
    shortCode: 'NULL',
    gridClass: 'attendance-cell--null',
    mobileClass: 'attendance-list-item--null',
  },
};

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'week-off', label: 'Week-Off' },
  { value: 'leave', label: 'Leave' },
  { value: 'absent', label: 'Absent' },
  { value: 'no-show', label: 'No Show' },
  { value: 'no-call-no-show', label: 'No Call No Show' },
];

export const SHIFT_TYPE_OPTIONS = [
  { value: '', label: '— None —' },
  { value: 'day', label: '☀ Day' },
  { value: 'night', label: '🌙 Night' },
];

/**
 * Returns a human-readable status label (including Day/Night suffix for present).
 */
export function formatAttendanceStatusLabel(status, shiftType = null) {
  const key = status || 'null';
  const meta = ATTENDANCE_STATUS_META[key];
  if (!meta) return key;
  if (key === 'present' && shiftType === 'day') return 'Present (Day)';
  if (key === 'present' && shiftType === 'night') return 'Present (Night)';
  return meta.label;
}
