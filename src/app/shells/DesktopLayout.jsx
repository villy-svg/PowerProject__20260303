/**
 * DesktopLayout.jsx
 * 
 * Desktop-optimized shell. Renders:
 * - Sidebar (inline panel, left)
 * - Top header bar with impersonation controls
 * - Main content area (children)
 * 
 * This shell is ONLY rendered on viewports > 768px.
 * The Sidebar and Header are inline — no overlays, no backdrops, no blur.
 * 
 * PHASE 3 HOOK:
 * - Accepts a `managementShell` prop that wraps children in a management-specific
 *   layout (full-width tables, admin-oriented chrome) when isManagementView is true.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §5 Desktop Layout
 * - adaptive-ui-strategy §4 Desktop Interactions
 */

import React from 'react';
import './DesktopLayout.css';

const DesktopLayout = ({
  user,
  permissions,
  verticals,
  verticalList,
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
  layout,
  children,
}) => {
  // SKELETON — Full wiring happens in RB2-02 through RB2-05.
  // For now, this is a pass-through wrapper that renders children.
  return (
    <div className="desktop-layout" data-shell="desktop">
      {/* 
        RB2-02 will add: <DesktopHeader />
        RB2-03 will add: <Sidebar /> (inline)
        RB2-05 will wire the full content routing 
      */}
      <div className="desktop-content-area">
        {children}
      </div>
    </div>
  );
};

export default DesktopLayout;
