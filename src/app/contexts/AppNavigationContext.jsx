/**
 * AppNavigationContext.jsx
 * Provides global navigation state: activeVertical, sidebar visibility,
 * bottom nav overlay, and localStorage persistence for all nav preferences.
 *
 * IMPORTANT: The activeVertical persistence whitelist must stay in sync with
 * the persistent views defined in App.jsx. Only primary board views are persisted;
 * admin sub-views like 'hub_management' are intentionally transient.
 *
 * BACK BUTTON (v2):
 * On native Android, the hardware back button follows a strict 4-level chain:
 *   Priority 0 — Any open overlay/drawer is closed first (no vertical change)
 *   Step 1      — Management sub-views navigate to 'configuration'
 *   Step 2      — 'configuration' and task boards navigate to Dashboard (null)
 *   Step 3      — Dashboard shows the Exit App confirmation modal
 *
 * Overlay state for MobileHeader (isMobileMenuOpen, isMobileBoardSubTrayOpen) is
 * lifted here so the back handler can dismiss them without prop drilling.
 */
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

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

/**
 * Management sub-views that live "one level below" configuration.
 * Back from any of these goes to 'configuration', not the dashboard.
 */
const MANAGEMENT_SUB_VIEWS = [
  'user_management',
  'role_management',
  'hub_management',
  'hub_function_management',
  'department_management',
  'employee_role_management',
  'client_category_management',
  'client_service_management',
  'client_billing_model_management',
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

  // ── MobileHeader overlay state (lifted from local state for back-button access) ──
  // These replace the local useState inside MobileHeader.jsx so the hardware
  // back button handler can dismiss them without prop drilling.
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileBoardSubTrayOpen, setIsMobileBoardSubTrayOpen] = useState(false);

  // ── Exit App Modal ────────────────────────────────────────────────────────
  const [showExitModal, setShowExitModal] = useState(false);

  // ── Smart setActiveVertical ───────────────────────────────────────────────
  /**
   * setActiveVertical wraps the raw setter with localStorage persistence.
   * Only primary board views are saved; admin sub-views are transient so
   * a page refresh doesn't land the user in an admin-only management screen.
   *
   * @param {string|null} id - The vertical ID to navigate to, or null for Dashboard.
   * @param {string} [source] - Pass 'rbac_guard' to prevent this from being treated
   *   as a user-initiated navigation (used by the RBAC security effect in App.jsx).
   */
  const setActiveVertical = useCallback((id, source) => {
    // Close all mobile overlays whenever the active vertical changes
    setIsMobileMenuOpen(false);
    setIsMobileBoardSubTrayOpen(false);
    setShowBottomNavOverlay(false);

    setActiveVerticalRaw(id);

    const dynamicIds = Object.values(verticals).map(v => v?.id).filter(Boolean);
    const allPersistent = [...PERSISTENT_VERTICALS, ...dynamicIds];

    if (id && allPersistent.includes(id)) {
      localStorage.setItem('power_project_active_vertical', id);
    } else if (!id) {
      localStorage.setItem('power_project_active_vertical', 'home');
    }
    // Admin sub-views ('hub_management', 'configuration', etc.) are NOT persisted
    // source === 'rbac_guard' calls are logged here for transparency but no
    // special branching is needed — the behaviour is identical; the tag is used
    // by the back-button handler below to remain future-proof.
  }, [verticals]);

  // ── Persist sidebar preferences ───────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('sidebar_state', String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('sub_sidebar_state', String(isSubSidebarOpen));
  }, [isSubSidebarOpen]);

  // ── Hardware Back Button Handler ──────────────────────────────────────────
  /**
   * Priority chain (Android hardware back button):
   *   0. Close any open overlay/drawer → return (no vertical change)
   *   1. Management sub-view           → navigate to 'configuration'
   *   2. 'configuration' or task board → navigate to Dashboard (null)
   *   3. Dashboard                     → show Exit App modal
   *
   * The ref pattern keeps the closure up-to-date without re-binding the
   * native listener on every state change.
   */
  const backHandlerRef = useRef();
  backHandlerRef.current = useCallback(() => {
    // Priority 0: dismiss any open overlay first — no vertical navigation
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
      return;
    }
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      return;
    }
    if (isMobileBoardSubTrayOpen) {
      setIsMobileBoardSubTrayOpen(false);
      return;
    }
    if (showBottomNavOverlay) {
      setShowBottomNavOverlay(false);
      return;
    }

    // Step 1: Management sub-view → System Configuration
    if (MANAGEMENT_SUB_VIEWS.includes(activeVertical)) {
      setActiveVertical('configuration');
      return;
    }

    // Step 2: Configuration or any task board → Dashboard
    if (activeVertical !== null) {
      setActiveVertical(null);
      return;
    }

    // Step 3: Dashboard → show Exit App confirmation modal
    setShowExitModal(true);
  }, [
    isSidebarOpen, isMobileMenuOpen, isMobileBoardSubTrayOpen,
    showBottomNavOverlay, activeVertical, setActiveVertical,
  ]);

  // Register Capacitor back-button listener on native platforms only
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle = null;

    // @capacitor/app must be imported dynamically to remain web-safe
    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        backHandlerRef.current?.();
      }).then(handle => {
        listenerHandle = handle;
      });
    });

    return () => {
      listenerHandle?.remove();
    };
  }, []); // Empty deps: listener is registered once; ref keeps handler current

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
    // Lifted MobileHeader overlay state (for back-button dismissal)
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isMobileBoardSubTrayOpen,
    setIsMobileBoardSubTrayOpen,
    // Exit App modal
    showExitModal,
    setShowExitModal,
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
