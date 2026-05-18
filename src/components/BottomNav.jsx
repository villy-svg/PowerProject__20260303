import React from 'react';
import { useLayoutShell } from '../app/shells/useLayoutShell';
import MobileBottomNav from '../app/shells/MobileBottomNav';
import './BottomNav.css';

/**
 * BottomNav Component
 * Provides "Seamless" mobile navigation tray (<= 768px).
 * Phase 2 Shell Delegation: Delegates to MobileBottomNav on mobile, returns null on desktop.
 */
const BottomNav = ({ 
  activeVertical, 
  setActiveVertical, 
  onMenuClick, 
  verticals = {}, 
  showOverlay = false, 
  onCloseOverlay = null 
}) => {
  const { shellType } = useLayoutShell();

  // Bottom navigation belongs strictly to mobile.
  // It is completely unmounted on desktop.
  if (shellType === 'desktop') {
    return null;
  }

  return (
    <MobileBottomNav
      activeVertical={activeVertical}
      setActiveVertical={setActiveVertical}
      onMenuClick={onMenuClick}
      verticals={verticals}
      showOverlay={showOverlay}
      onCloseOverlay={onCloseOverlay}
    />
  );
};

export default BottomNav;

