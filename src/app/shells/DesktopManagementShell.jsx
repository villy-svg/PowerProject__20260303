import React from 'react';
import './DesktopManagementShell.css';

const DesktopManagementShell = ({ children, layout, user }) => {
  return (
    <div className="desktop-management-shell">
      <div className="management-content-full-width">
        {children}
      </div>
    </div>
  );
};

export default DesktopManagementShell;
