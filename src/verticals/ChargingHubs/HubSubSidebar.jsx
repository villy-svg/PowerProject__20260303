import React from 'react';

/**
 * HubSubSidebar
 * 
 * Vertical-specific sidebar content for Charging Hubs.
 * Contains the Master Admin administrative shortcut.
 */
const HubSubSidebar = ({ user, setActiveVertical }) => {
  const isMasterAdmin = user?.roleId === 'master_admin';

  return (
    <div className="sub-sidebar-body">
      <div 
        className={`sub-nav-item ${isMasterAdmin ? 'navigable' : ''}`}
        onClick={() => isMasterAdmin && setActiveVertical('hub_management')}
      >
        <div className="sub-nav-icon">🏢</div>
        <div className="sub-nav-text">
          <p>Hub Management</p>
          <small>{isMasterAdmin ? 'Open Admin View' : 'Workspace Active'}</small>
        </div>
        {isMasterAdmin && <span className="nav-arrow">→</span>}
      </div>
    </div>
  );
};

export default HubSubSidebar;
