/**
 * DesktopSidebar.jsx
 *
 * Desktop-only sidebar component. Renders as a static, inline panel on the left side
 * of the screen for screen widths > 768px.
 * Features:
 * - Direct vertical switching
 * - Nested list administration views (Hub Administration, Service Manager, etc.)
 *
 * DOES NOT INCLUDE:
 * - Backdrop overlays or close buttons (desktop has no drawer behavior)
 * - Mobile logo close triggers (desktop uses standard brand space)
 * - Open/Close state triggers (always visible unless explicitly collapsed)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Desktop Interactions
 * - adaptive-ui-strategy §5 Desktop Layout
 */

import React, { useState } from 'react';
import { IconChevronDown, IconChevronRight, IconLock, IconShield } from '../../components/ui/Icons';
import powerLogo from '../../assets/logo.svg';
import BoardRBACModal from '../../components/modals/BoardRBACModal';
import '../../components/Sidebar.css';

const DesktopSidebar = ({
  isOpen,
  activeVertical,
  setActiveVertical,
  user,
  permissions = {},
  verticalList = [],
}) => {
  const [expandedVerticals, setExpandedVerticals] = useState([]);
  const [rbacModalVertical, setRbacModalVertical] = useState(null);

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

  return (
    <aside className={`sidebar desktop-sidebar-shell ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-content-wrapper">
        <div className="sidebar-top-section">
          <div className="sidebar-header">
            <div className="desktop-logo-wrapper">
              <img src={powerLogo} alt="Logo" className="logo-svg" />
            </div>
          </div>

          <nav className="sidebar-nav">
            <ul>
              <li
                className={activeVertical === null ? 'active' : ''}
                onClick={() => setActiveVertical(null)}
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
                        onClick={() => !isLocked && setActiveVertical(vertical.id)}
                        title={isLocked ? "Coming Soon / No Access" : ""}
                      >
                        <span className="v-label-text">{vertical.label}</span>
                        <div className="v-actions-wrapper">
                          {isLocked && <IconLock className="lock-icon" size={14} />}
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
                              <li className={activeVertical === 'hub_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('hub_management')}>Hub Administration</li>
                              <li className={activeVertical === 'hub_function_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('hub_function_management')}>Function Manager</li>
                              {user?.roleId === 'master_admin' && (
                                <li className="sub-active" onClick={() => setRbacModalVertical(vertical)}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <IconShield size={14} /> Manage Access
                                  </span>
                                </li>
                              )}
                            </>
                          )}
                          {vertical.id === 'CLIENTS' && (
                            <>
                              <li className={activeVertical === 'client_category_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_category_management')}>Category Manager</li>
                              <li className={activeVertical === 'client_service_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_service_management')}>Service Manager</li>
                              <li className={activeVertical === 'client_billing_model_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('client_billing_model_management')}>Billing Model Manager</li>
                              {user?.roleId === 'master_admin' && (
                                <li className="sub-active" onClick={() => setRbacModalVertical(vertical)}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <IconShield size={14} /> Manage Access
                                  </span>
                                </li>
                              )}
                            </>
                          )}
                          {vertical.id === 'EMPLOYEES' && (
                            <>
                              <li className={activeVertical === 'department_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('department_management')}>Department Manager</li>
                              <li className={activeVertical === 'employee_role_management' ? 'active sub-active' : ''} onClick={() => setActiveVertical('employee_role_management')}>Role Manager</li>
                              {user?.roleId === 'master_admin' && (
                                <li className="sub-active" onClick={() => setRbacModalVertical(vertical)}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <IconShield size={14} /> Manage Access
                                  </span>
                                </li>
                              )}
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
                      onClick={() => setActiveVertical('user_management')}
                    >
                      User Management
                    </li>
                  )}
                  <li
                    className={activeVertical === 'configuration' ? 'active' : ''}
                    onClick={() => setActiveVertical('configuration')}
                  >
                    Configuration
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </div>
      
      {rbacModalVertical && (
        <BoardRBACModal
          isOpen={true}
          onClose={() => setRbacModalVertical(null)}
          verticalId={rbacModalVertical.id?.toLowerCase()}
          titleLabel={rbacModalVertical.label}
        />
      )}
    </aside>
  );
};

export default DesktopSidebar;
