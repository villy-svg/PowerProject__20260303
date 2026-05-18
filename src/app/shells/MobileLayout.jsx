/**
 * MobileLayout.jsx
 * 
 * Mobile-optimized shell. Renders:
 * - Sticky header with scroll-aware show/hide
 * - Mobile Action Tray (bottom pill bar)
 * - Bottom Nav (for primary vertical switching)
 * - Content area (children)
 * 
 * This shell is ONLY rendered on viewports ≤ 768px.
 * Overlays, backdrops, and blur effects are exclusive to this shell.
 * 
 * PHASE 3 HOOK:
 * - Accepts a `managementShell` prop that wraps children in a mobile management
 *   layout (card stacks, bottom sheets) when isManagementView is true.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 */

import React from 'react';
import './MobileLayout.css';

const MobileLayout = ({
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
  return (
    <div className="mobile-layout" data-shell="mobile">
      {/* 
        RB2-02 will add: <MobileHeader />
        RB2-03 will add: <BottomNav /> (fixed bottom)
        RB2-05 will wire the full content routing 
      */}
      <div className="mobile-content-area">
        {children}
      </div>
    </div>
  );
};

export default MobileLayout;
