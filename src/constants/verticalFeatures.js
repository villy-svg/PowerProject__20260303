/**
 * src/constants/verticalFeatures.js
 * 
 * Defines the mapping of verticals to their specific set of features/buttons.
 * Used in User Management for granular RBAC.
 */

/**
 * Ordered navigation items for the Employees vertical sub-sidebar and mobile board switcher.
 * Kept in this neutral constants module to avoid circular imports with verticalRegistry.js.
 */
export const EMPLOYEE_NAV_ITEMS = [
  { id: 'attendance_self_service',   label: 'Current Attendance',  permissionKey: 'canAccessAttendanceSelfService' },
  { id: 'employee_attendance_board', label: 'Attendance Board',    permissionKey: 'canAccessEmployeeAttendanceBoard' },
  { id: 'employee_tasks',            label: 'Remarks Manager',     permissionKey: 'canAccessEmployeeTasks', requireTruthy: true },
  { id: 'employee_rules_board',      label: 'Rules & Regulations', permissionKey: 'canAccessEmployeeRulesBoard' },
  { id: 'employee_leave_wallet',     label: 'Leave Manager',       permissionKey: 'canAccessEmployeeLeaveWallet', locked: true },
];

/** Feature sub-views that are currently locked/disabled across Desktop, Mobile, and ContentRouter */
export const LOCKED_FEATURE_VIEWS = EMPLOYEE_NAV_ITEMS
  .filter(item => item.locked)
  .map(item => item.id);

export const VERTICAL_FEATURES = {
  CLIENTS: [
    { id: 'canAccessClients', label: 'Clients List' },
    { id: 'canAccessClientTasks', label: 'Client Tasks Board' },
    { id: 'canAccessLeadsFunnel', label: 'Leads Funnel' }
  ],
  EMPLOYEES: [
    { id: 'canAccessEmployees', label: 'Employees List' },
    { id: 'canAccessEmployeeTasks', label: 'Remarks Manager' },
    { id: 'canAccessEmployeeAttendanceBoard', label: 'Attendance Board' },
    { id: 'canAccessEmployeeRulesBoard', label: 'Rules & Regulations' },
    { id: 'canAccessAttendanceSelfService', label: 'Current Attendance' },
    { id: 'canAccessEmployeeLeaveWallet', label: 'Leave Manager' }
  ],
  CHARGING_HUBS: [
    { id: 'canAccessHubTasks', label: 'Hub Tasks Board' },
    { id: 'canAccessDailyHubTasks', label: 'Daily Task Board' },
    { id: 'canAccessDailyTaskTemplates', label: 'Daily Task Template' },
    { id: 'canAccessEscalationTasks', label: 'Escalation Task Board' }
  ],
  DATA_MANAGER: [
    { id: 'canAccessDataSheetBoard', label: 'Data Sheet Board' },
    { id: 'canAccessModelVerificationBoard', label: 'Model Verification Board' }
  ]
};

/**
 * Returns the default feature settings for a vertical.
 * By default, all are true to maintain existing access until explicitly disabled.
 */
export const getDefaultFeatures = (verticalId) => {
  const features = VERTICAL_FEATURES[verticalId] || [];
  const defaultMap = {};
  features.forEach(f => {
    defaultMap[f.id] = true;
  });
  return defaultMap;
};
