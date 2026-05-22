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

import React from 'react';
import { 
  IconHome, IconHubs, IconPeople, IconDatabase, IconSettings, IconZap, IconBoards, IconFile
} from '../../components/Icons';
import powerLogo from '../../assets/logo.svg';
import '../../components/Sidebar.css';

const MobileSidebar = ({
  isOpen,
  onClose,
  activeVertical,
  setActiveVertical,
  user,
  permissions = {},
  verticalList = [],
}) => {
  const isHydrating = !permissions || Object.keys(permissions).length === 0 || !permissions.scope;

  const filteredVerticals = verticalList.filter(vertical => {
    const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
    const isLocked = vertical.locked || !isAssigned;
    if (isHydrating) return vertical.locked;
    return isLocked;
  });

  const canSeeConfig = permissions?.canAccessConfig;
  const showUserMgmt = permissions?.scope === 'global' && permissions?.canManageRoles;

  const handleNavigate = (vId) => {
    setActiveVertical(vId);
    if (onClose) onClose();
  };

  const getIconForVertical = (id) => {
    if (id === 'CHARGING_HUBS') return IconHubs;
    if (id === 'CLIENTS') return IconDatabase;
    if (id === 'EMPLOYEES') return IconPeople;
    return IconFile;
  };

  return (
    <>
      {isOpen && <div className="sub-tray-backdrop" onClick={onClose} />}

      <aside className={`mobile-board-sub-tray mobile-sidebar-shell ${isOpen ? '' : 'tray-hidden'}`}>
        <div className="mobile-board-sub-tray-header">
          <h4>Menu</h4>
          <button className="sub-tray-close-btn" onClick={onClose} title="Close Menu">✕</button>
        </div>

        <div className="mobile-board-sub-tray-content custom-scrollbar">
          {/* Primary Apps */}
          <div className="tray-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h5 className="tray-section-title" style={{ margin: '4px 0 4px 4px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--brand-green)', opacity: 0.8, fontWeight: 700, letterSpacing: '0.5px' }}>Apps</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button 
                className={`sub-tray-option-btn ${activeVertical === null ? 'active' : ''}`}
                onClick={() => handleNavigate(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IconHome size={18} style={{ color: activeVertical === null ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                  <span>Dashboard</span>
                </div>
                {activeVertical === null && <span className="active-dot" />}
              </button>

              {!isHydrating && filteredVerticals.map(vertical => {
                const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
                const isLocked = vertical.locked || !isAssigned;
                const Icon = getIconForVertical(vertical.id);
                const isActive = activeVertical === vertical.id;

                return (
                  <button
                    key={vertical.id}
                    className={`sub-tray-option-btn ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    onClick={() => !isLocked && handleNavigate(vertical.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Icon size={18} style={{ color: isActive ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                      <span>{vertical.label}</span>
                    </div>
                    {isActive && <span className="active-dot" />}
                    {isLocked && <span style={{ fontSize: '11px', opacity: 0.5 }}>🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Management Modules (Sub-navs) */}
          {canSeeConfig && !isHydrating && (
            <div className="tray-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <h5 className="tray-section-title" style={{ margin: '4px 0 4px 4px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--brand-green)', opacity: 0.8, fontWeight: 700, letterSpacing: '0.5px' }}>Management</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Charging Hubs Managers */}
                {filteredVerticals.find(v => v.id === 'CHARGING_HUBS' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'hub_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('hub_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconZap size={18} style={{ color: activeVertical === 'hub_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Hub Admin</span>
                      </div>
                      {activeVertical === 'hub_management' && <span className="active-dot" />}
                    </button>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'hub_function_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('hub_function_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconBoards size={18} style={{ color: activeVertical === 'hub_function_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Functions</span>
                      </div>
                      {activeVertical === 'hub_function_management' && <span className="active-dot" />}
                    </button>
                  </>
                )}

                {/* Clients Managers */}
                {filteredVerticals.find(v => v.id === 'CLIENTS' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'client_category_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_category_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconDatabase size={18} style={{ color: activeVertical === 'client_category_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Categories</span>
                      </div>
                      {activeVertical === 'client_category_management' && <span className="active-dot" />}
                    </button>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'client_service_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_service_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconDatabase size={18} style={{ color: activeVertical === 'client_service_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Services</span>
                      </div>
                      {activeVertical === 'client_service_management' && <span className="active-dot" />}
                    </button>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'client_billing_model_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_billing_model_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconDatabase size={18} style={{ color: activeVertical === 'client_billing_model_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Billing</span>
                      </div>
                      {activeVertical === 'client_billing_model_management' && <span className="active-dot" />}
                    </button>
                  </>
                )}

                {/* Employees Managers */}
                {filteredVerticals.find(v => v.id === 'EMPLOYEES' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'department_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('department_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconPeople size={18} style={{ color: activeVertical === 'department_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Departments</span>
                      </div>
                      {activeVertical === 'department_management' && <span className="active-dot" />}
                    </button>
                    <button 
                      className={`sub-tray-option-btn ${activeVertical === 'employee_role_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('employee_role_management')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <IconPeople size={18} style={{ color: activeVertical === 'employee_role_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                        <span>Roles</span>
                      </div>
                      {activeVertical === 'employee_role_management' && <span className="active-dot" />}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* System */}
          {canSeeConfig && (
            <div className="tray-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <h5 className="tray-section-title" style={{ margin: '4px 0 4px 4px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--brand-green)', opacity: 0.8, fontWeight: 700, letterSpacing: '0.5px' }}>System</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {showUserMgmt && (
                  <button 
                    className={`sub-tray-option-btn ${activeVertical === 'user_management' ? 'active' : ''}`} 
                    onClick={() => handleNavigate('user_management')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <IconPeople size={18} style={{ color: activeVertical === 'user_management' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                      <span>Users</span>
                    </div>
                    {activeVertical === 'user_management' && <span className="active-dot" />}
                  </button>
                )}
                <button 
                  className={`sub-tray-option-btn ${activeVertical === 'configuration' ? 'active' : ''}`} 
                  onClick={() => handleNavigate('configuration')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <IconSettings size={18} style={{ color: activeVertical === 'configuration' ? 'var(--brand-green)' : 'rgba(255, 255, 255, 0.5)', transition: 'color 0.2s' }} />
                    <span>Config</span>
                  </div>
                  {activeVertical === 'configuration' && <span className="active-dot" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default MobileSidebar;
