/**
 * LayoutShell.jsx
 * 
 * Orchestrator that conditionally renders the Desktop or Mobile shell.
 * This component sits between the Context Providers and the actual UI content.
 * 
 * KEY DESIGN DECISIONS:
 * 1. Children are passed through — the LayoutShell never owns content logic.
 * 2. Both shells receive identical data props (user, permissions, verticals, etc.).
 * 3. The shell only controls chrome: sidebar, header, navigation, and layout CSS.
 * 
 * PHASE 3 HOOK: The `managementShell` prop slot is reserved for Phase 3.
 *   When Phase 3 is implemented, LayoutShell will check isManagementView
 *   and wrap content in DesktopManagementShell / MobileManagementShell.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §3A Component Swapping
 * - development-best-practices §4 Component Architecture
 */

import React from 'react';
import { useLayoutShell } from './useLayoutShell';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';

const LayoutShell = ({
  // Data props (passed through to content and shells)
  user,
  permissions,
  verticals,
  verticalList,

  // Navigation handlers
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,

  // Content (React children — the actual page being viewed)
  children,

  // PHASE 3 SLOT — not used yet, but the interface is ready
  managementShell: ManagementShellOverride,
}) => {
  const layout = useLayoutShell();

  // Common props shared by both shells
  const shellProps = {
    user,
    permissions,
    verticals,
    verticalList,
    onLogout,
    realUser,
    impersonatedUser,
    impersonationUsers,
    onImpersonate,
    layout, // Pass the full layout context down
  };

  if (layout.shellType === 'desktop') {
    return (
      <DesktopLayout {...shellProps}>
        {children}
      </DesktopLayout>
    );
  }

  return (
    <MobileLayout {...shellProps}>
      {children}
    </MobileLayout>
  );
};

export default LayoutShell;
