/**
 * Verticals Registry
 * Initially contains hardcoded defaults for safety.
 * Can be updated dynamically via updateStaticVerticals() once backend data is loaded.
 */
export const VERTICALS = {
  CHARGING_HUBS: { id: 'CHARGING_HUBS', label: 'Hub Manager' },
  CLIENTS: { id: 'CLIENTS', label: 'Client Manager' },
  EMPLOYEES: { id: 'EMPLOYEES', label: 'Employee Manager' },
  PARTNERS: { id: 'PARTNERS', label: 'Partner Manager', locked: true },
  VENDORS: { id: 'VENDORS', label: 'Vendor Manager', locked: true },
  DATA_MANAGER: { id: 'DATA_MANAGER', label: 'Data Manager', locked: true }
};

export const VERTICAL_LIST = Object.values(VERTICALS);

/**
 * Synchronizes the static constants with dynamic backend data.
 * Used to ensure non-React services (like dailyTaskService) see the latest IDs.
 */
export const updateStaticVerticals = (newList) => {
  if (!Array.isArray(newList) || newList.length === 0) return;

  // Clear and update the registry without breaking references
  Object.keys(VERTICALS).forEach(key => delete VERTICALS[key]);
  newList.forEach(v => {
    VERTICALS[v.id] = v;
  });

  // Update the list reference
  VERTICAL_LIST.length = 0;
  VERTICAL_LIST.push(...newList);
};