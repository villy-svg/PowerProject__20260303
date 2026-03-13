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
      {isMasterAdmin && (
        <div className="sub-sidebar-actions" style={{ padding: '0 12px', marginBottom: '12px' }}>
          <button 
            className="halo-button" 
            style={{ width: '100%', marginTop: '12px' }}
            onClick={() => setActiveVertical('hub_function_management')}
          >
            Function Manager
          </button>
        </div>
      )}

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
