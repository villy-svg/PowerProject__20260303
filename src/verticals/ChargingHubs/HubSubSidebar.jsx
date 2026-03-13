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
      <div className="sub-nav-item">
        <div className="sub-nav-text">
          <p>Module Navigation</p>
          <small>Vertical Active</small>
        </div>
      </div>
    </div>

  );
};

export default HubSubSidebar;
