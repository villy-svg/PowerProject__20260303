/**
 * useLayoutShell.js
 * 
 * Central hook that determines which layout shell (Desktop vs Mobile)
 * should be rendered. Also classifies the current view type for
 * Phase 3 management shell compatibility.
 * 
 * PHASE 3 FORWARD COMPAT:
 * - isManagementView will be used to swap in DesktopManagementShell / MobileManagementShell
 * - isDashboard separates the executive summary view from vertical workspaces
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §2 Breakpoint Standards
 * - development-best-practices §2 Isolated hooks
 */

import { useIsMobile } from '../../hooks/useIsMobile';
import { useAppNavigation } from '../contexts/AppNavigationContext';

/** 
 * Management views are admin pages that show tables/forms, not task boards.
 * This list MUST stay in sync with App.jsx's ternary chain.
 */
const MANAGEMENT_VIEWS = [
  'configuration',
  'role_management',
  'user_management',
  'hub_management',
  'hub_function_management',
  'department_management',
  'employee_role_management',
  'client_category_management',
  'client_service_management',
  'client_billing_model_management',
  'tutorial',
  'employee_attendance_board',  // Manager board is a management view, not a task board
  'attendance_self_service',    // Employee self-service check-in/out screen
];

export function useLayoutShell() {
  const { isPhone, isTablet, isMobile, isDesktop, viewportWidth } = useIsMobile();
  const { activeVertical } = useAppNavigation();

  // View classification
  const isDashboard = activeVertical === null;
  const isManagementView = MANAGEMENT_VIEWS.includes(activeVertical);
  const isTaskBoard = !isDashboard && !isManagementView;

  return {
    // Breakpoint flags (pass-through from useIsMobile)
    isPhone,
    isTablet,
    isMobile,
    isDesktop,
    viewportWidth,

    // View classification
    isDashboard,
    isManagementView,
    isTaskBoard,

    // Shell selection (the main decision)
    shellType: isDesktop ? 'desktop' : 'mobile',
  };
}
