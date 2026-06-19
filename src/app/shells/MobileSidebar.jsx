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
  IconHome, IconHubs, IconPeople, IconDatabase, IconSettings, IconZap, IconBoards, IconFile, IconLock, IconShield
} from '../../components/ui/Icons';
import powerLogo from '../../assets/logo.svg';
import BoardRBACModal from '../../components/modals/BoardRBACModal';
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
  const [rbacModalVertical, setRbacModalVertical] = React.useState(null);

  const filteredVerticals = verticalList.filter(vertical => {
    const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
    const isLocked = vertical.locked || !isAssigned;
    if (isHydrating) return vertical.locked;
    
    // Show locked verticals (coming soon) or verticals that are not in the persistent bottom navigation bar (e.g. DATA_MANAGER)
    const isBottomNavVertical = ['CHARGING_HUBS', 'CLIENTS', 'EMPLOYEES'].includes(vertical.id);
    return isLocked || !isBottomNavVertical;
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
    if (id === 'DATA_MANAGER') return IconDatabase;
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

        <div className="mobile-board-sub-tray-content custom-scrollbar tray-layout">
          {/* Primary Apps */}
          <div className="tray-section">
            <h5 className="tray-section-title">Apps</h5>
            <div className="tray-grid">
              <button 
                className={`tray-card ${activeVertical === null ? 'active' : ''}`}
                onClick={() => handleNavigate(null)}
              >
                <div className="tray-icon">
                  <IconHome size={20} />
                </div>
                <span>Dashboard</span>
              </button>

              {!isHydrating && filteredVerticals.map(vertical => {
                const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
                const isLocked = vertical.locked || !isAssigned;
                const Icon = getIconForVertical(vertical.id);
                const isActive = activeVertical === vertical.id;

                return (
                  <button
                    key={vertical.id}
                    className={`tray-card ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                    onClick={() => !isLocked && handleNavigate(vertical.id)}
                    disabled={isLocked}
                  >
                    <div className="tray-icon">
                      <Icon size={20} />
                      {isLocked && <IconLock className="tray-lock" size={16} />}
                    </div>
                    <span>{vertical.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Management Modules (Sub-navs) */}
          {canSeeConfig && !isHydrating && (
            <div className="tray-section">
              <h5 className="tray-section-title">Management</h5>
              <div className="tray-grid">
                {/* Charging Hubs Managers */}
                {filteredVerticals.find(v => v.id === 'CHARGING_HUBS' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`tray-card ${activeVertical === 'hub_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('hub_management')}
                    >
                      <div className="tray-icon">
                        <IconZap size={20} />
                      </div>
                      <span>Hub Admin</span>
                    </button>
                    <button 
                      className={`tray-card ${activeVertical === 'hub_function_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('hub_function_management')}
                    >
                      <div className="tray-icon">
                        <IconBoards size={20} />
                      </div>
                      <span>Functions</span>
                    </button>
                    {user?.roleId === 'master_admin' && (
                      <button 
                        className="tray-card" 
                        onClick={() => setRbacModalVertical({ id: 'CHARGING_HUBS', label: 'Charging Hubs' })}
                      >
                        <div className="tray-icon">
                          <IconShield size={20} />
                        </div>
                        <span>Access</span>
                      </button>
                    )}
                  </>
                )}

                {/* Clients Managers */}
                {filteredVerticals.find(v => v.id === 'CLIENTS' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`tray-card ${activeVertical === 'client_category_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_category_management')}
                    >
                      <div className="tray-icon">
                        <IconDatabase size={20} />
                      </div>
                      <span>Categories</span>
                    </button>
                    <button 
                      className={`tray-card ${activeVertical === 'client_service_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_service_management')}
                    >
                      <div className="tray-icon">
                        <IconDatabase size={20} />
                      </div>
                      <span>Services</span>
                    </button>
                    <button 
                      className={`tray-card ${activeVertical === 'client_billing_model_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('client_billing_model_management')}
                    >
                      <div className="tray-icon">
                        <IconDatabase size={20} />
                      </div>
                      <span>Billing</span>
                    </button>
                    {user?.roleId === 'master_admin' && (
                      <button 
                        className="tray-card" 
                        onClick={() => setRbacModalVertical({ id: 'CLIENTS', label: 'Clients' })}
                      >
                        <div className="tray-icon">
                          <IconShield size={20} />
                        </div>
                        <span>Access</span>
                      </button>
                    )}
                  </>
                )}

                {/* Employees Managers */}
                {filteredVerticals.find(v => v.id === 'EMPLOYEES' && (!v.locked && (user?.assignedVerticals?.includes(v.id) || permissions?.scope === 'global'))) && (
                  <>
                    <button 
                      className={`tray-card ${activeVertical === 'department_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('department_management')}
                    >
                      <div className="tray-icon">
                        <IconPeople size={20} />
                      </div>
                      <span>Departments</span>
                    </button>
                    <button 
                      className={`tray-card ${activeVertical === 'employee_role_management' ? 'active' : ''}`} 
                      onClick={() => handleNavigate('employee_role_management')}
                    >
                      <div className="tray-icon">
                        <IconPeople size={20} />
                      </div>
                      <span>Roles</span>
                    </button>
                    {user?.roleId === 'master_admin' && (
                      <button 
                        className="tray-card" 
                        onClick={() => setRbacModalVertical({ id: 'EMPLOYEES', label: 'Employees' })}
                      >
                        <div className="tray-icon">
                          <IconShield size={20} />
                        </div>
                        <span>Access</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* System */}
          {canSeeConfig && (
            <div className="tray-section">
              <h5 className="tray-section-title">System</h5>
              <div className="tray-grid">
                {showUserMgmt && (
                  <button 
                    className={`tray-card ${activeVertical === 'user_management' ? 'active' : ''}`} 
                    onClick={() => handleNavigate('user_management')}
                  >
                    <div className="tray-icon">
                      <IconPeople size={20} />
                    </div>
                    <span>Users</span>
                  </button>
                )}
                <button 
                  className={`tray-card ${activeVertical === 'configuration' ? 'active' : ''}`} 
                  onClick={() => handleNavigate('configuration')}
                >
                  <div className="tray-icon">
                    <IconSettings size={20} />
                  </div>
                  <span>Config</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {rbacModalVertical && (
        <BoardRBACModal
          isOpen={true}
          onClose={() => setRbacModalVertical(null)}
          verticalId={rbacModalVertical.id?.toLowerCase()}
          titleLabel={rbacModalVertical.label}
        />
      )}
    </>
  );
};

export default MobileSidebar;
