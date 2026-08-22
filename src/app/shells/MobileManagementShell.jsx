import React from 'react';
import './MobileManagementShell.css';

const MobileManagementShell = ({ children, layout }) => {
  return (
    <div className="mobile-management-shell">
      <div className="management-content-cards">
        {children}
      </div>
    </div>
  );
};

export default MobileManagementShell;
