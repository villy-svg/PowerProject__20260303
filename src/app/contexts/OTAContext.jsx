/**
 * OTAContext.jsx
 *
 * Provides OTA update state to any component in the tree without prop drilling.
 * This solves the mobile header problem: UserProfile inside ExecutiveSummary
 * can consume updateAvailable / onUpdateClick directly via useOTAContext(),
 * without needing the props to be threaded through ContentRouter → ExecutiveSummary.
 *
 * The context is populated once in AppShell (App.jsx) and wraps the entire
 * authenticated UI via OTAContextProvider.
 *
 * Skill compliance:
 * - Runtime Stability: safe default context value prevents crashes if consumed
 *   outside the provider (no-op functions, false booleans)
 * - Dev Best Practices: context isolates cross-cutting concerns from UI props
 */

import React, { createContext, useContext } from 'react';

const OTAContext = createContext({
  // Default no-op values — safe if consumed outside provider (e.g., on web)
  updateAvailable: false,
  updateDetected: false,
  updateVersion: null,
  isApplying: false,
  showRestartModal: false,
  downloadComplete: false,
  dismissUpdateToast: () => {},
  dismissRestartModal: () => {},
  checkForUpdate: () => {},
});

/**
 * Provider — wrap the authenticated app shell with this.
 * @param {object} value - The full return value from useOTAUpdate()
 */
export const OTAContextProvider = ({ value, children }) => (
  <OTAContext.Provider value={value}>
    {children}
  </OTAContext.Provider>
);

/**
 * Hook — consume OTA state anywhere in the authenticated tree.
 * Safe to call on web: all values are falsy / no-ops by default.
 */
export const useOTAContext = () => useContext(OTAContext);
