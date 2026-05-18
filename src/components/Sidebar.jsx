import React from 'react';
import { useLayoutShell } from '../app/shells/useLayoutShell';
import DesktopSidebar from '../app/shells/DesktopSidebar';
import MobileSidebar from '../app/shells/MobileSidebar';
import './Sidebar.css';

/**
 * Sidebar Component
 * Multi-Vertical Update: Refactored to support dynamic verticals from backend.
 * Phase 2 Shell Delegation: Swaps DesktopSidebar and MobileSidebar.
 */
const Sidebar = ({ 
  isOpen, 
  onClose, 
  activeVertical, 
  setActiveVertical, 
  user, 
  permissions = {}, 
  verticalList = [] 
}) => {
  const { shellType } = useLayoutShell();

  if (shellType === 'desktop') {
    return (
      <DesktopSidebar
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        user={user}
        permissions={permissions}
        verticalList={verticalList}
      />
    );
  }

  return (
    <MobileSidebar
      isOpen={isOpen}
      onClose={onClose}
      activeVertical={activeVertical}
      setActiveVertical={setActiveVertical}
      user={user}
      permissions={permissions}
      verticalList={verticalList}
    />
  );
};

export default Sidebar;