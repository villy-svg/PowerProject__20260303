/**
 * MobileSidebar.jsx
 *
 * Mobile-only sidebar component. Renders as an off-canvas slide-out drawer
 * for screens <= 768px.
 * Features:
 * - Dynamic sliding animations (.open / .close)
 * - Backdrop tapping area to dismiss the drawer
 * - Logo close button for touch optimization
 *
 * DOES NOT INCLUDE:
 * - Constant static inline layouts (that's desktop-only)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 * - adaptive-ui-strategy §5 Mobile Layout
 */

import React, { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '../../components/Icons';
import powerLogo from '../../assets/logo.svg';

const MobileSidebar = ({
  isOpen,
  onClose,
  activeVertical,
  setActiveVertical,
  user,
  permissions = {},
  verticalList = [],
}) => {
  const [expandedVerticals, setExpandedVerticals] = useState([]);

  const toggleVertical = (e, vId) => {
    e.stopPropagation();
    setExpandedVerticals(prev =>
      prev.includes(vId) ? prev.filter(id => id !== vId) : [...prev, vId]
    );
  };

  const isHydrating = !permissions || Object.keys(permissions).length === 0 || !permissions.scope;

  const filteredVerticals = verticalList.filter(vertical => {
    const isExplicitlyAssigned = user?.assignedVerticals?.includes(vertical.id);
    if (isHydrating) return isExplicitlyAssigned;
    if (permissions.scope === 'global') return true;
    return isExplicitlyAssigned;
  });

  const canSeeConfig = permissions?.canAccessConfig;
  const showUserMgmt = permissions?.scope === 'global' && permissions?.canManageRoles;

  const handleNavigate = (vId) => {
    setActiveVertical(vId);
    if (onClose) onClose(); // Auto-close drawer on navigation
  };

  return (
    <>
      {/* Backdrop overlay for off-canvas drawer */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside className={`sidebar mobile-sidebar-shell ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-content-wrapper">
          <div className="sidebar-top-section">
            <div className="sidebar-header">
              {/* Brand space wraps close button for easy tapping */}
              <button className="mobile-logo-btn" onClick={onClose} aria-label="Close Sidebar">
                <img src={powerLogo} alt="Logo" className="logo-svg" />
              </button>
            </div>

            <nav className="sidebar-nav">
              <ul>
                <li
                  className={activeVertical === null ? 'active' : ''}
                  onClick={() => handleNavigate(null)}
                >
                  Dashboard
                </li>

                <hr className="nav-divider" />

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
                          onClick={() => !isLocked && handleNavigate(vertical.id)}
                          title={isLocked ? "Coming Soon / No Access" : ""}
                        >
                          <span className="v-label-text">{vertical.label}</span>
                          <div className="v-actions-wrapper">
                            {isLocked && <span className="lock-icon">🔒</span>}
                            {!isLocked && canManage && verticalList.length > 0 && 
                              (vertical.id === 'CHARGING_HUBS' || vertical.id === 'CLIENTS' || vertical.id === 'EMPLOYEES') && (
                              <button
                                className={`v-toggle-btn ${isExpanded ? 'active' : ''}`}
                                onClick={(e) => toggleVertical(e, vertical.id)}
                              >
                                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                              </button>
                            )}
                          </div>
                        </li>

                        {!isLocked && isExpanded && canManage && (
                          <ul className="sub-nav-list">
                            {vertical.id === 'CHARGING_HUBS' && (
                              <>
                                <li className={activeVertical === 'hub_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('hub_management')}>Hub Administration</li>
                                <li className={activeVertical === 'hub_function_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('hub_function_management')}>Function Manager</li>
                              </>
                            )}
                            {vertical.id === 'CLIENTS' && (
                              <>
                                <li className={activeVertical === 'client_category_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('client_category_management')}>Category Manager</li>
                                <li className={activeVertical === 'client_service_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('client_service_management')}>Service Manager</li>
                                <li className={activeVertical === 'client_billing_model_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('client_billing_model_management')}>Billing Model Manager</li>
                              </>
                            )}
                            {vertical.id === 'EMPLOYEES' && (
                              <>
                                <li className={activeVertical === 'department_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('department_management')}>Department Manager</li>
                                <li className={activeVertical === 'employee_role_management' ? 'active sub-active' : ''} onClick={() => handleNavigate('employee_role_management')}>Role Manager</li>
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
                        onClick={() => handleNavigate('user_management')}
                      >
                        User Management
                      </li>
                    )}
                    <li
                      className={activeVertical === 'configuration' ? 'active' : ''}
                      onClick={() => handleNavigate('configuration')}
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
    </>
  );
};

export default MobileSidebar;
