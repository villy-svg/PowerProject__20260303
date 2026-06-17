/**
 * src/constants/verticalFeatures.js
 * 
 * Defines the mapping of verticals to their specific set of features/buttons.
 * Used in User Management for granular RBAC.
 */

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
    { id: 'canAccessAttendanceSelfService', label: 'Current Attendance' }
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
