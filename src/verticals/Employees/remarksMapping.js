/**
 * remarksMapping.js
 * Centralized mappings for the Remarks Manager (Employee Tasks).
 */

export const REMARK_GRADE_MAP = {
  Low: 'Level 0',
  Medium: 'Level 1',
  High: 'Level 2',
  Urgent: 'Special Conditions',
};

// Reusable list of options for Select dropdowns
export const REMARK_GRADE_OPTIONS = [
  { label: REMARK_GRADE_MAP.Low, value: 'Low' },
  { label: REMARK_GRADE_MAP.Medium, value: 'Medium' },
  { label: REMARK_GRADE_MAP.High, value: 'High' },
  { label: REMARK_GRADE_MAP.Urgent, value: 'Urgent' },
];
