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
    { id: 'canAccessEmployeeTasks', label: 'Employee Tasks Board' }
  ],
  CHARGING_HUBS: [
    { id: 'canAccessHubTasks', label: 'Hub Tasks Board' }
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
