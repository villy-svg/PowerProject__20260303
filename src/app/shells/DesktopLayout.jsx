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

import React, { useState } from 'react';
import DesktopSidebar from './DesktopSidebar';
import UserProfile from '../../components/UserProfile';
import CustomSelect from '../../components/CustomSelect';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import powerLogo from '../../assets/logo.svg';
import SearchBar from '../../components/SearchBar';
import NotificationBell from '../../components/NotificationBell';
import SandboxManagerModal from '../../components/SandboxManagerModal';
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

  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const isBypassActive = import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';

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

      {/* Main Content Area */}
      <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
        {/* Desktop Header Bar */}
        <header className="app-header">
          <div className="header-left">
            <h1 className="brand-title-centered">PowerProject</h1>
          </div>
          <div className="header-right">
            <button 
              className={`halo-button header-tutorial-btn ${activeVertical === 'tutorial' ? 'active' : ''}`}
              onClick={() => setActiveVertical('tutorial')}
            >
              💡 Tutorials
            </button>
            {isBypassActive && (
              <button 
                className="halo-button header-sandbox-btn"
                onClick={() => setIsSandboxOpen(true)}
              >
                ⚠️ Sandbox Active
              </button>
            )}
            <NotificationBell user={user} />
            <UserProfile 
              user={user} 
              onConfigClick={() => setActiveVertical('configuration')} 
              onLogout={onLogout} 
              realUser={realUser}
              impersonatedUser={impersonatedUser}
              impersonationUsers={impersonationUsers}
              onImpersonate={onImpersonate}
            />
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Dev-Only Sandbox Management Portal */}
      <SandboxManagerModal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />
    </div>
  );
};

export default DesktopLayout;
