import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { VERTICAL_LIST } from '../constants/verticals';
import './Configuration.css';

const Configuration = ({ tasks, setTasks, user = {}, setActiveVertical }) => {
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('config_view_mode') || 'grid');
  
  const isMasterAdmin = user?.roleId === 'master_admin';

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('config_view_mode', mode);
  };

  const handleClearAllTasks = async () => {
    if (!isMasterAdmin) return;
    const confirmed = window.confirm("CRITICAL: Delete ALL tasks across ALL verticals?");
    if (confirmed) {
      try {
        const { error } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
        if (error) throw error;
        setTasks([]);
        alert("Cloud database cleared.");
      } catch (err) {
        alert("Failed to clear cloud data.");
      }
    }
  };

  // Define config items for each vertical
  const verticalConfigs = {
    CHARGING_HUBS: [
      {
        id: 'manage_hubs',
        title: 'Hub Administration',
        desc: 'Add, edit or remove global charging hub locations.',
        icon: '',
        action: () => setActiveVertical('hub_management'),
        adminOnly: true,
        buttonLabel: 'Manage Hubs'
      },
      {
        id: 'manage_functions',
        title: 'Hub Function Management',
        desc: 'Define functional categories like Maintenance, Cleaning, and Inspection.',
        icon: '',
        action: () => setActiveVertical('hub_function_management'),
        adminOnly: true,
        buttonLabel: 'Manage Functions'
      }
    ],
    // Placeholders for other verticals
    CLIENTS: [],
    EMPLOYEES: [
      {
        id: 'manage_departments',
        title: 'Department Management',
        desc: 'Define and manage organization departments.',
        icon: '',
        action: () => setActiveVertical('department_management'),
        adminOnly: true,
        buttonLabel: 'Manage Departments'
      },
      {
        id: 'manage_employee_roles',
        title: 'Role Management',
        desc: 'Define functional roles within the employee manager.',
        icon: '',
        action: () => setActiveVertical('employee_role_management'),
        adminOnly: true,
        buttonLabel: 'Manage Roles'
      }
    ],
    PARTNERS: [],
    VENDORS: []
  };

  return (
    <div className={`configuration-view ${viewMode}-view`}>
      <div className="config-inner-wrap">
        <header className="config-header">
          <div className="header-text">
            <h2>System Configuration</h2>
            <p>Manage groupings and global application settings.</p>
          </div>
          <div className="view-toggle">
            <button 
              className={viewMode === 'grid' ? 'active' : ''} 
              onClick={() => toggleViewMode('grid')}
              title="Grid View"
            >
              田
            </button>
            <button 
              className={viewMode === 'horizontal' ? 'active' : ''} 
              onClick={() => toggleViewMode('horizontal')}
              title="List View"
            >
              ☰
            </button>
          </div>
        </header>

        <div className="config-content">
          {/* Render Sections by Vertical Order */}
          {VERTICAL_LIST.map(vertical => {
            const items = verticalConfigs[vertical.id] || [];
            if (items.length === 0) return null;

            return (
              <div key={vertical.id} className="config-group">
                <h3 className="group-label">{vertical.label}</h3>
                <div className="config-items-container">
                  {items.map(item => {
                    if (item.adminOnly && !isMasterAdmin) return null;
                    return (
                      <div key={item.id} className="config-tile" onClick={item.action}>
                        {item.icon && <div className="tile-icon">{item.icon}</div>}
                        <div className="tile-info">
                          <h4>{item.title}</h4>
                          <p>{item.desc}</p>
                          {item.buttonLabel && (
                            <button className="halo-button" style={{ marginTop: '16px', width: '100%' }}>
                              {item.buttonLabel}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Global Settings (Accessible to all) */}
          <div className="config-group">
            <h3 className="group-label">General Settings</h3>
            <div className="config-items-container">
              <div className="config-tile non-clickable">
                <div className="tile-info">
                  <h4>Display Preferences</h4>
                  <p>Theme and UI scaling are managed via the header.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Master Admin Controls at the Bottom */}
          {isMasterAdmin && (
            <div className="config-group master-controls">
              <h3 className="group-label master-label">🔒 Master Admin Controls</h3>
              <div className="config-items-container">
                <div className="config-tile" onClick={() => setActiveVertical('user_management')}>
                  <div className="tile-info">
                    <h4>User Management</h4>
                    <p>Assign roles and vertical access to specific team members.</p>
                    <button className="halo-button" style={{ marginTop: '16px', width: '100%' }}>
                      Manage Team
                    </button>
                  </div>
                </div>
                <div className="config-tile" onClick={() => setActiveVertical('role_management')}>
                  <div className="tile-info">
                    <h4>Access Control Matrix</h4>
                    <p>Define permissions for all roles globally.</p>
                    <button className="halo-button" style={{ marginTop: '16px', width: '100%' }}>
                      Manage Role Permissions
                    </button>
                  </div>
                </div>
                <div className="config-tile destructive" onClick={handleClearAllTasks}>
                  <div className="tile-info">
                    <h4>Factory Reset Tasks</h4>
                    <p>Wipe all task data across all verticals. (Caution!)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Configuration;