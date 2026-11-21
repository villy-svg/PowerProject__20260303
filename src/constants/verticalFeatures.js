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

/**
 * Ordered navigation items for the Charging Hubs vertical sub-sidebar and mobile board switcher.
 * Daily Task Board & Daily Task Templates are locked until unlocked for build.
 */
export const HUB_NAV_ITEMS = [
  { id: 'hub_tasks',            label: 'Hubs Task Board',       permissionKey: 'canAccessHubTasks' },
  { id: 'escalation_tasks',     label: 'Escalation Task Board', permissionKey: 'canAccessEscalationTasks', buttonId: 'btn-nav-escalation' },
  { id: 'daily_hub_tasks',      label: 'Daily Task Board',      permissionKey: 'canAccessDailyHubTasks',      locked: true },
  { id: 'daily_task_templates', label: 'Daily Task Templates',  permissionKey: 'canAccessDailyTaskTemplates', locked: true },
];

/** Feature sub-views that are currently locked/disabled across Desktop, Mobile, and ContentRouter */
export const LOCKED_FEATURE_VIEWS = [
  ...EMPLOYEE_NAV_ITEMS,
  ...HUB_NAV_ITEMS,
]
  .filter(item => item.locked)
  .map(item => item.id);

export const VERTICAL_FEATURES = {
  CLIENTS: [
    { id: 'canAccessClients', label: 'Clients List', locked: true },
    { id: 'canAccessClientTasks', label: 'Client Tasks Board', locked: true },
    { id: 'canAccessLeadsFunnel', label: 'Leads Funnel', locked: true }
  ],
  EMPLOYEES: [
    { id: 'canAccessEmployees', label: 'Employees List' },
    { id: 'canAccessEmployeeTasks', label: 'Remarks Manager' },
    { id: 'canAccessEmployeeAttendanceBoard', label: 'Attendance Board' },
    { id: 'canAccessEmployeeRulesBoard', label: 'Rules & Regulations' },
    { id: 'canAccessAttendanceSelfService', label: 'Current Attendance' },
    { id: 'canAccessEmployeeLeaveWallet', label: 'Leave Manager', locked: true }
  ],
  CHARGING_HUBS: [
    { id: 'canAccessHubTasks', label: 'Hub Tasks Board' },
    { id: 'canAccessDailyHubTasks', label: 'Daily Task Board', locked: true },
    { id: 'canAccessDailyTaskTemplates', label: 'Daily Task Template', locked: true },
    { id: 'canAccessEscalationTasks', label: 'Escalation Task Board' }
  ],
  DATA_MANAGER: [
    { id: 'canAccessDataSheetBoard', label: 'Data Sheet Board', locked: true },
    { id: 'canAccessModelVerificationBoard', label: 'Model Verification Board', locked: true }
  ]
};

/** Set of feature permission IDs that are currently locked (hidden from User Management & forced to 'none') */
export const LOCKED_FEATURE_IDS = new Set(
  Object.values(VERTICAL_FEATURES)
    .flat()
    .filter(f => f.locked)
    .map(f => f.id)
);

export const isFeatureLocked = (featureId) => LOCKED_FEATURE_IDS.has(featureId);

/**
 * Returns default feature-level overrides for a vertical when newly assigned.
 * Locked features are explicitly forced to 'none'; unlocked features are left
 * undefined so they inherit the vertical's access level cleanly.
 */
export const getDefaultFeatures = (verticalId) => {
  const features = VERTICAL_FEATURES[verticalId] || [];
  const defaultMap = {};
  features.forEach(f => {
    if (f.locked) {
      defaultMap[f.id] = 'none';
    }
  });
  return defaultMap;
};
