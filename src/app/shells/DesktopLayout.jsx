/**
 * DesktopLayout.jsx
 *
 * Desktop-optimized shell. Renders:
 * - Logo button (toggles sidebar)
 * - Sidebar (inline panel, left)
 * - Brand title
 * - Top header bar with impersonation controls
 * - Main content area (children)
 *
 * NO backdrop overlays, NO bottom nav, NO blur effects.
 * Those are mobile-exclusive behaviors.
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Desktop Layout
 */

import React from 'react';
import DesktopSidebar from './DesktopSidebar';
import UserProfile from '../../components/UserProfile';
import CustomSelect from '../../components/CustomSelect';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import powerLogo from '../../assets/logo.svg';
import SearchBar from '../../components/SearchBar';
import NotificationBell from '../../components/NotificationBell';
import './DesktopLayout.css';

const DesktopLayout = ({
  user,
  permissions,
  verticals,
  verticalList,
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
  layout,
  children,
}) => {
  const { darkMode } = useTheme();
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen, setIsSidebarOpen,
  } = useAppNavigation();

  return (
    <div className="desktop-layout" data-shell="desktop" data-theme={darkMode ? 'dark' : 'light'}>
      {/* Logo Button */}
      <button
        className="logo-button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <img src={powerLogo} alt="Logo" className="logo-svg" />
      </button>

      {/* Sidebar — inline panel on desktop */}
      <DesktopSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        user={user}
        permissions={permissions}
        verticalList={verticalList}
      />

      {/* Brand Title */}
      <h1 className="brand-title-centered">PowerProject</h1>

      {/* Main Content Area */}
      <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
        {/* Desktop Header Bar */}
        <header className="app-header">
          <div className="header-left"></div>
          <div className="header-center"></div>
          <div className="header-right">
            <button 
              className={`halo-button header-tutorial-btn ${activeVertical === 'tutorial' ? 'active' : ''}`}
              onClick={() => setActiveVertical('tutorial')}
            >
              💡 Tutorials
            </button>
            {realUser?.roleId === 'master_admin' && (
              <div className="impersonation-header-wrapper">
                {impersonatedUser ? (
                  <div className="impersonation-active-container">
                    <span className="impersonation-active-label">
                      View: <strong>{impersonatedUser.name}</strong>
                      <span className="neutral-badge impersonation-role-badge">
                        {impersonatedUser.roleId}
                      </span>
                    </span>
                    <button className="halo-button impersonation-stop-btn" onClick={() => onImpersonate(null)}>
                      Stop
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="impersonation-select"
                    placeholder="Simulate User..."
                    options={impersonationUsers.map(u => ({
                      value: u.id,
                      label: `${u.name} (${u.role_id})`
                    }))}
                    onChange={(val) => onImpersonate(val)}
                  />
                )}
              </div>
            )}
            <NotificationBell user={user} />
            <UserProfile user={user} onConfigClick={() => setActiveVertical('configuration')} onLogout={onLogout} />
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DesktopLayout;
