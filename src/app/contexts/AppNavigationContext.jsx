/**
 * AppNavigationContext.jsx
 * Provides global navigation state: activeVertical, sidebar visibility,
 * bottom nav overlay, and localStorage persistence for all nav preferences.
 *
 * IMPORTANT: The activeVertical persistence whitelist must stay in sync with
 * the persistent views defined in App.jsx. Only primary board views are persisted;
 * admin sub-views like 'hub_management' are intentionally transient.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AppNavigationContext = createContext(null);

/** Views that should be remembered across page refresh */
const PERSISTENT_VERTICALS = [
  'home',
  'hub_tasks',
  'daily_hub_tasks',
  'daily_task_templates',
  'escalation_tasks',
  'employee_tasks',
  'client_tasks',
  'leads_funnel',
];

export function AppNavigationProvider({ verticals = {}, children }) {
  // ── Active Vertical ───────────────────────────────────────────────────────
  const [activeVertical, setActiveVerticalRaw] = useState(() => {
    const saved = localStorage.getItem('power_project_active_vertical');
    return (saved === 'home' || !saved) ? null : saved;
  });

  // ── Sidebar Visibility ────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => localStorage.getItem('sidebar_state') === 'true'
  );

  const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sub_sidebar_state');
    return saved !== null ? saved === 'true' : true;
  });

  // ── Mobile Bottom Nav Overlay ─────────────────────────────────────────────
  const [showBottomNavOverlay, setShowBottomNavOverlay] = useState(false);

  // ── Smart setActiveVertical ───────────────────────────────────────────────
  /**
   * setActiveVertical wraps the raw setter with localStorage persistence.
   * Only primary board views are saved; admin sub-views are transient so
   * a page refresh doesn't land the user in an admin-only management screen.
   *
   * Also dynamically includes the DB-driven vertical IDs (e.g. 'CHARGING_HUBS')
   * from the verticals prop passed to the provider.
   */
  const setActiveVertical = (id) => {
    setActiveVerticalRaw(id);

    const dynamicIds = Object.values(verticals).map(v => v?.id).filter(Boolean);
    const allPersistent = [...PERSISTENT_VERTICALS, ...dynamicIds];

    if (id && allPersistent.includes(id)) {
      localStorage.setItem('power_project_active_vertical', id);
    } else if (!id) {
      localStorage.setItem('power_project_active_vertical', 'home');
    }
    // Admin sub-views ('hub_management', 'configuration', etc.) are NOT persisted
  };

  // ── Persist sidebar preferences ───────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('sidebar_state', String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('sub_sidebar_state', String(isSubSidebarOpen));
  }, [isSubSidebarOpen]);

  // ── Context Value ─────────────────────────────────────────────────────────
  const value = {
    activeVertical,
    setActiveVertical,
    isSidebarOpen,
    setIsSidebarOpen,
    isSubSidebarOpen,
    setIsSubSidebarOpen,
    showBottomNavOverlay,
    setShowBottomNavOverlay,
  };

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  );
}

/**
 * useAppNavigation — Consume navigation context from any component.
 * Throws if called outside AppNavigationProvider.
 */
export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error('[useAppNavigation] Must be used inside <AppNavigationProvider>.');
  }
  return ctx;
}
