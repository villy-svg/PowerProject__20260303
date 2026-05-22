/**
 * MobileLayout.jsx
 *
 * Mobile-optimized shell. Renders:
 * - Sidebar (off-canvas drawer with backdrop)
 * - Content area (children)
 * - BottomNav (fixed bottom bar)
 *
 * Logo and brand title are hidden on mobile when in a vertical.
 * The mobile header is handled by MasterPageHeader's delegation (RB2-02).
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout
 */

import React from 'react';
import MobileSidebar from './MobileSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import powerLogo from '../../assets/logo.svg';
import ExitAppModal from '../../components/ExitAppModal';
import './MobileLayout.css';

const MobileLayout = ({
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
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  return (
    <div
      className="mobile-layout"
      data-shell="mobile"
      data-theme={darkMode ? 'dark' : 'light'}
      data-view-state={activeVertical ? 'vertical' : 'home'}
    >
      {/* Logo — hidden when in a vertical */}
      <button
        className={`logo-button ${activeVertical ? 'mobile-hidden' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <img src={powerLogo} alt="Logo" className="logo-svg" />
      </button>

      {/* Brand Title — hidden when in a vertical */}
      <h1 className={`brand-title-centered ${activeVertical ? 'mobile-hidden' : ''}`}>PowerProject</h1>

      {/* Sidebar Drawer */}
      <MobileSidebar
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
        {/* Mobile header bar — only shown on dashboard (no vertical active) */}
        <header className={`app-header ${activeVertical ? 'mobile-hidden' : ''}`}>
          <div className="header-left"></div>
          <div className="header-center"></div>
          <div className="header-right">
            {/* Impersonation controls are desktop-only — too complex for mobile header */}
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Bottom Nav — mobile only */}
      <MobileBottomNav
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        onMenuClick={() => setIsSidebarOpen(true)}
        verticals={verticals}
        showOverlay={showBottomNavOverlay}
        onCloseOverlay={() => setShowBottomNavOverlay(false)}
      />

      {/* Exit App Confirmation Modal — shown on dashboard back press */}
      <ExitAppModal />
    </div>
  );
};

export default MobileLayout;
