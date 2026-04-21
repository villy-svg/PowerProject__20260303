import React, { useState, useEffect } from 'react';
import powerLogo from '../assets/logo.svg';
import { IconChevronDown, IconChevronRight, IconX } from './Icons';
import './Sidebar.css';

/**
 * Sidebar Component
 * Multi-Vertical Update: Refactored to support dynamic verticals from backend.
 */
const Sidebar = ({ isOpen, onClose, activeVertical, setActiveVertical, user, permissions = {}, verticalList = [] }) => {
  const [expandedVerticals, setExpandedVerticals] = React.useState([]);

  const toggleVertical = (e, vId) => {
    e.stopPropagation();
    setExpandedVerticals(prev =>
      prev.includes(vId) ? prev.filter(id => id !== vId) : [...prev, vId]
    );
  };

  const isHydrating = !permissions || Object.keys(permissions).length === 0 || !permissions.scope;

  /**
   * NAVIGATION FILTERING LOGIC
   * Refactored: Uses .includes() to support multiple assigned verticals.
   */
  const filteredVerticals = verticalList.filter(vertical => {
    // Check if the current vertical ID exists within the user's assigned array
    const isExplicitlyAssigned = user?.assignedVerticals?.includes(vertical.id);

    // If still loading credentials, only show what is explicitly assigned to the user
    if (isHydrating) {
      return isExplicitlyAssigned;
    }

    // Global scope (Master Admin/Viewer) sees all verticals
    if (permissions.scope === 'global') {
      return true;
    }

    // Default: Show any vertical included in the assigned array
    return isExplicitlyAssigned;
  });

  const canSeeConfig = permissions?.canAccessConfig;

  const handleDashboardNavigate = () => {
    setActiveVertical(null);
  };

  const handleConfigNavigate = () => {
    if (canSeeConfig) setActiveVertical('configuration');
  };

  const handleUserMgmtNavigate = () => {
    setActiveVertical('user_management');
  };

  const showUserMgmt = permissions?.scope === 'global' && permissions?.canManageRoles;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content-wrapper">

        <div className="sidebar-top-section">
          <div className="sidebar-header">
            {/* Header space maintained for alignment with external logo */}
            <button className="mobile-logo-btn" onClick={onClose} aria-label="Close Sidebar">
              <img src={powerLogo} alt="Logo" className="logo-svg" />
            </button>
          </div>

          <nav className="sidebar-nav">
            <ul>
              <li
                className={activeVertical === null ? 'active' : ''}
                onClick={handleDashboardNavigate}
              >
                Dashboard
              </li>

              <hr className="nav-divider" />

              {/* Multi-Vertical Render Logic */}
              {isHydrating ? (
                verticalList.map((v) => (
                  <li key={v.id} className="nav-loading-pulse">{v.label}</li>
                ))
              ) : filteredVerticals.length > 0 ? (
                filteredVerticals.map((vertical) => {
                  const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
                  const isLocked = vertical.locked || !isAssigned;
                  const isExpanded = expandedVerticals.includes(vertical.id);
                  const canManage = permissions?.canAccessConfig;

                  return (
                    <React.Fragment key={vertical.id}>
                      <li
                        className={`${activeVertical === vertical.id ? 'active' : ''} ${isLocked ? 'locked' : ''} nav-parent-item`}
                        onClick={() => !isLocked && setActiveVertical(vertical.id)}
                        title={isLocked ? "Coming Soon / No Access" : ""}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span className="v-label-text">{vertical.label}</span>
                        <div className="v-actions-wrapper">
                          {isLocked && <span className="lock-icon" style={{ fontSize: '12px', opacity: 0.5 }}>🔒</span>}
                          {!isLocked && canManage && verticalList.length > 0 && (vertical.id === verticalList.find(v=>v.id.includes('HUB'))?.id || vertical.id === 'CLIENTS' || vertical.id === 'EMPLOYEES') && (
                            <button
                              className={`v-toggle-btn ${isExpanded ? 'active' : ''}`}
                              onClick={(e) => toggleVertical(e, vertical.id)}
                            >
                              {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                            </button>
                          )}
                        </div>
                      </li>
                      
                      {/* Sub-navigation Items */}
                      {!isLocked && isExpanded && canManage && (
                        <ul className="sub-nav-list">
                          {(vertical.id === 'CHARGING_HUBS' || vertical.id === 'hub_tasks') && (
                            <>
                              <li className={(activeVertical === 'hub_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('hub_management')}>Hub Administration</li>
                              <li className={(activeVertical === 'hub_function_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('hub_function_management')}>Function Manager</li>
                            </>
                          )}
                          {(vertical.id === 'CLIENTS' || vertical.id === 'client_tasks') && (
                            <>
                              <li className={(activeVertical === 'client_category_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_category_management')}>Category Manager</li>
                              <li className={(activeVertical === 'client_service_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_service_management')}>Service Manager</li>
                              <li className={(activeVertical === 'client_billing_model_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_billing_model_management')}>Billing Model Manager</li>
                            </>
                          )}
                          {(vertical.id === 'EMPLOYEES' || vertical.id === 'employee_tasks') && (
                            <>
                              <li className={(activeVertical === 'department_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('department_management')}>Department Manager</li>
                              <li className={(activeVertical === 'employee_role_management') ? 'active sub-active' : ''} onClick={() => setActiveVertical('employee_role_management')}>Role Manager</li>
                            </>
                          )}
                        </ul>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <li className="nav-empty-state">No Access</li>
              )}
            </ul>
          </nav>
        </div>

        <div className="sidebar-bottom-section">
          <nav className="sidebar-nav">
            <ul>
              {canSeeConfig && (
                <>
                  <hr className="nav-divider" />
                  {showUserMgmt && (
                    <li 
                      className={activeVertical === 'user_management' ? 'active' : ''} 
                      onClick={handleUserMgmtNavigate}
                    >
                      User Management
                    </li>
                  )}
                  <li 
                    className={activeVertical === 'configuration' ? 'active' : ''} 
                    onClick={handleConfigNavigate}
                  >
                    Configuration
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;