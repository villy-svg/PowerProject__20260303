/**
 * Frontend-only vertical lock overrides (UI lock without DB migration).
 * Remove a vertical ID from this set and set locked: false below to unlock it.
 */
export const LOCKED_VERTICAL_OVERRIDES = new Set(['CLIENTS', 'DATA_MANAGER']);

/**
 * Returns true if the given vertical ID is force-locked at the frontend layer.
 */
export const isVerticalForceLocked = (verticalId) => LOCKED_VERTICAL_OVERRIDES.has(verticalId);

/**
 * Verticals Registry
 * Initially contains hardcoded defaults for safety.
 * Can be updated dynamically via updateStaticVerticals() once backend data is loaded.
 */
export const VERTICALS = {
  CHARGING_HUBS: { id: 'CHARGING_HUBS', label: 'Hubs' },
  // Ordered above CLIENTS to match public.verticals."order" and prevent pre-hydration flicker
  EMPLOYEES: { id: 'EMPLOYEES', label: 'Employees' },
  CLIENTS: { id: 'CLIENTS', label: 'Clients', locked: true },
  PARTNERS: { id: 'PARTNERS', label: 'Partners', locked: true },
  VENDORS: { id: 'VENDORS', label: 'Vendors', locked: true },
  DATA_MANAGER: { id: 'DATA_MANAGER', label: 'Data', locked: true }
};

export const VERTICAL_LIST = Object.values(VERTICALS);

/**
 * Synchronizes the static constants with dynamic backend data.
 * Used to ensure non-React services (like dailyTaskService) see the latest IDs.
 */
export const updateStaticVerticals = (newList) => {
  if (!Array.isArray(newList) || newList.length === 0) return;

  const normalizedList = newList.map(v => ({
    ...v,
    locked: !!v.locked || isVerticalForceLocked(v.id),
  }));

  // Clear and update the registry without breaking references
  Object.keys(VERTICALS).forEach(key => delete VERTICALS[key]);
  normalizedList.forEach(v => {
    VERTICALS[v.id] = v;
  });

  // Update the list reference
  VERTICAL_LIST.length = 0;
  VERTICAL_LIST.push(...normalizedList);
};