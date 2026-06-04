import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/core/supabaseClient';
import { IconHome, IconMenu } from './Icons';
import ConfigBottomNav from './ConfigBottomNav';
import { useIsMobile } from '../hooks/useIsMobile';
import './Configuration.css';

const Configuration = ({ tasks, setTasks, user = {}, permissions = {}, setActiveVertical, onShowBottomNav, verticals = {}, verticalList = [] }) => {
  const { isMobile } = useIsMobile();
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('config_view_mode') || 'grid');
  const [testRunning, setTestRunning] = useState(false);
  
  // Determine first available configuration section based on permissions and assignment
  const getFirstAvailableSection = () => {
    if (!permissions || !permissions.scope) return 'hubs';
    const hasHubs = permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.CHARGING_HUBS?.id);
    if (hasHubs) return 'hubs';
    const hasTeam = permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.EMPLOYEES?.id);
    if (hasTeam) return 'team';
    const hasClients = permissions.scope === 'global' || user.assignedVerticals?.includes(verticals.CLIENTS?.id);
    if (hasClients) return 'clients';
    return 'general';
  };

  const [activeSection, setActiveSection] = useState(() => getFirstAvailableSection());
  
  const canManageSystem = permissions.canManageRoles;
  const canClearAll = permissions.canDelete && permissions.scope === 'global';

  // Keep activeSection in sync with permission changes
  useEffect(() => {
    setActiveSection(getFirstAvailableSection());
  }, [permissions.scope, user.assignedVerticals, verticals]);

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('config_view_mode', mode);
  };

  const handleTestRun = async () => {
    if (user?.roleId !== 'master_admin') {
      alert("Unauthorized: Only Master Admins can execute test runs.");
      return;
    }

    const confirmed = window.confirm("Dev Tool: Run script to strip 'ALL : ' prefixes from all tasks in the database?");
    if (!confirmed) return;

    setTestRunning(true);
    try {
      // Fetch all tasks where text starts with 'ALL : ' or 'ALL:' (case-insensitive)
      const { data: matchedTasks, error: fetchError } = await supabase
        .from('tasks')
        .select('id, text')
        .or('text.ilike.all : %,text.ilike.all:%');

      if (fetchError) throw fetchError;

      if (!matchedTasks || matchedTasks.length === 0) {
        alert("No tasks found starting with 'ALL : ' or 'ALL:' prefix in the database.");
        return;
      }

      // Loop over matched tasks, strip the prefix, and perform individual updates
      let successCount = 0;
      const updatePromises = matchedTasks.map(async (task) => {
        if (!task.text) return;
        const cleanText = task.text.replace(/^[aA][lL][lL]\s*:\s*/, '');
        const { error: updateError } = await supabase
          .from('tasks')
          .update({ text: cleanText })
          .eq('id', task.id);
        
        if (!updateError) successCount++;
      });

      await Promise.all(updatePromises);

      // Update the local state so the UI reflects changes immediately
      setTasks(prev => prev.map(t => {
        if (t.text && t.text.toLowerCase().replace(/^[aA][lL][lL]\s*:\s*/, '') !== t.text.toLowerCase()) {
          return { ...t, text: t.text.replace(/^[aA][lL][lL]\s*:\s*/, '') };
        }
        return t;
      }));

      alert(`Success! Removed 'ALL' prefix from ${successCount} tasks in the database.`);
    } catch (err) {
      console.error('Test run execution failed:', err);
      alert(`Execution failed: ${err.message || err}`);
    } finally {
      setTestRunning(false);
    }
  };

  const handleClearAllTasks = async () => {
    if (!canClearAll) return;
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
    [verticals.CHARGING_HUBS?.id]: [
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
    [verticals.CLIENTS?.id]: [
      {
        id: 'manage_client_categories',
        title: 'Client Category Management',
        desc: 'Define and manage client categories (Vehicle types, Operations, etc.)',
        icon: '',
        action: () => setActiveVertical('client_category_management'),
        adminOnly: true,
        buttonLabel: 'Manage Categories'
      },
      {
        id: 'manage_service_categories',
        title: 'Client Service Management',
        desc: 'Define and manage service categories (Maintenance, AMC, etc.)',
        icon: '',
        action: () => setActiveVertical('client_service_management'),
        adminOnly: true,
        buttonLabel: 'Manage Services'
      },
      {
        id: 'manage_billing_models',
        title: 'Billing Models Management',
        desc: 'Define global billing models for client contracts.',
        icon: '',
        action: () => setActiveVertical('client_billing_model_management'),
        adminOnly: true,
        buttonLabel: 'Manage Models'
      }
    ],
    [verticals.EMPLOYEES?.id]: [
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
      },
      {
        id: 'manage_rules',
        title: 'Rule Management',
        desc: 'Create and manage employee rules, regulations, categories, and sub-categories.',
        icon: '📋',
        action: () => setActiveVertical('rule_management'),
        adminOnly: true,
        buttonLabel: 'Manage Rules'
      }
    ],
    [verticals.PARTNERS?.id]: [],
    [verticals.VENDORS?.id]: []
  };

  return (
    <div className={`configuration-view ${viewMode}-view`}>
      <div className="config-inner-wrap">
        <header className="config-header">
          <div className="header-text">
            <h2>System Configuration</h2>
            <p>Manage groupings and global application settings.</p>
          </div>
          {!isMobile && (
            <div className="view-toggle">
              <button 
                className={viewMode === 'grid' ? 'active' : ''} 
                onClick={() => toggleViewMode('grid')}
                title="Grid View"
              >
                <IconHome size={18} />
              </button>
              <button 
                className={viewMode === 'horizontal' ? 'active' : ''} 
                onClick={() => toggleViewMode('horizontal')}
                title="List View"
              >
                <IconMenu size={18} />
              </button>
            </div>
          )}
        </header>

        <div className="config-content">
          {/* Render Sections by Vertical Order */}
          {verticalList.map(vertical => {
            const items = verticalConfigs[vertical.id] || [];
            if (items.length === 0) return null;

            // Filter items based on whether user has access to this specific vertical (if scope is assigned)
            const hasVerticalAccess = permissions.scope === 'global' || user.assignedVerticals?.includes(vertical.id);
            if (!hasVerticalAccess) return null;

            let sectionId = '';
            let groupSectionKey = '';
            if (vertical.id === verticals.CHARGING_HUBS?.id) {
              sectionId = 'config-section-hubs';
              groupSectionKey = 'hubs';
            } else if (vertical.id === verticals.EMPLOYEES?.id) {
              sectionId = 'config-section-team';
              groupSectionKey = 'team';
            } else if (vertical.id === verticals.CLIENTS?.id) {
              sectionId = 'config-section-clients';
              groupSectionKey = 'clients';
            }

            // On mobile, only render the active sub-page section
            if (isMobile && activeSection !== groupSectionKey) return null;

            return (
              <div key={vertical.id} id={sectionId} className="config-group">
                <h3 className="group-label">{vertical.label}</h3>
                <div className="config-items-container">
                  {items.map(item => {
                    // Vertical admin sections are visible to anyone with canAccessConfig and vertical access
                    if (item.adminOnly && !permissions.canAccessConfig) return null;
                    
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
          {(!isMobile || activeSection === 'general') && (
            <div id="config-section-general" className="config-group">
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
          )}

          {/* Master Admin Controls at the Bottom */}
          {canManageSystem && (!isMobile || activeSection === 'general') && (
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
                {user?.roleId === 'master_admin' && (
                  <div className="config-tile" onClick={handleTestRun}>
                    <div className="tile-info">
                      <h4>🛠️ Dev: Test Run</h4>
                      <p>Execute custom one-time database scripts (Master Admin only).</p>
                      <button className="halo-button" style={{ marginTop: '16px', width: '100%', borderColor: 'var(--brand-green)', color: 'var(--brand-green)' }} disabled={testRunning}>
                        {testRunning ? 'Running Script...' : 'Execute Test Run'}
                      </button>
                    </div>
                  </div>
                )}
                {canClearAll && (
                  <div className="config-tile destructive" onClick={handleClearAllTasks}>
                    <div className="tile-info">
                      <h4>Factory Reset Tasks</h4>
                      <p>Wipe all task data across all verticals. (Caution!)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfigBottomNav 
        activeSection={activeSection} 
        setActiveSection={setActiveSection}
        permissions={permissions}
        user={user}
        verticals={verticals}
      />
    </div>
  );
};

export default Configuration;