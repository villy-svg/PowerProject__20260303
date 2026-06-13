/**
 * Verticals Registry
 * Initially contains hardcoded defaults for safety.
 * Can be updated dynamically via updateStaticVerticals() once backend data is loaded.
 */
export const VERTICALS = {
  CHARGING_HUBS: { id: 'CHARGING_HUBS', label: 'Hubs' },
  CLIENTS: { id: 'CLIENTS', label: 'Clients' },
  EMPLOYEES: { id: 'EMPLOYEES', label: 'Employees' },
  PARTNERS: { id: 'PARTNERS', label: 'Partners', locked: true },
  VENDORS: { id: 'VENDORS', label: 'Vendors', locked: true },
  DATA_MANAGER: { id: 'DATA_MANAGER', label: 'Data', locked: false }
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