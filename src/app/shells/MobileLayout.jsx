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

import React, { useState, useRef, useCallback } from 'react';
import MobileSidebar from './MobileSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import { useVisualViewport } from '../../hooks/useVisualViewport';
import powerLogo from '../../assets/logo.svg';
import SearchBar from '../../components/SearchBar';
import ExitAppModal from '../../components/ExitAppModal';
import SandboxManagerModal from '../../components/SandboxManagerModal';
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
    searchProps, isSearchOpen
  } = useAppNavigation();

  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const isBypassActive = import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';

  // ── Soft Keyboard & Viewport Tracking ─────────────────────────────────
  // Syncs --visual-viewport-height / --keyboard-height CSS vars and
  // body[data-keyboard] attribute so CSS can adapt when the soft keyboard opens.
  useVisualViewport();

  // ── Double-Tap to Reveal Bottom Nav ────────────────────────────────────
  // Detects two touchend events on the main content area within 300ms.
  // On detection, force-shows the bottom nav (which hides on scroll-down).
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback((e) => {
    // Only trigger on bare taps — not if the user is interacting with
    // an interactive element (button, input, a, select).
    const tag = e.target?.tagName?.toUpperCase();
    const isInteractive = ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A', 'LABEL'].includes(tag);
    if (isInteractive) return;

    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current;
    if (timeSinceLast < 300 && timeSinceLast > 30) {
      // Double tap confirmed — reveal bottom nav
      setShowBottomNavOverlay(true);
      e.preventDefault();
    }
    lastTapRef.current = now;
  }, [setShowBottomNavOverlay]);

  return (
    <div
      className="mobile-layout"
      data-shell="mobile"
      data-theme={darkMode ? 'dark' : 'light'}
      data-view-state={activeVertical ? 'vertical' : 'home'}
      data-has-search={(!searchProps?.hideSearchBar && isSearchOpen) ? 'true' : 'false'}
    >
      {/* Mobile Top Header Bar — removed to be rendered inside the scrollable ExecutiveSummary */}

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
      {/* onTouchEnd: double-tap detection to reveal the hidden bottom nav */}
      <div
        className={`app-main-area ${activeVertical ? 'no-padding' : ''}`}
        data-view-state={activeVertical ? 'vertical' : 'home'}
        onTouchEnd={handleDoubleTap}
      >
        {/* NOTE: app-header is intentionally omitted on mobile dashboard —
             it has no content and would create blank space below the fixed brand title.
             The brand title (position:fixed) already serves as the dashboard header. */}



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
        user={user}
        permissions={permissions}
      />

      {/* Exit App Confirmation Modal — shown on dashboard back press */}
      <ExitAppModal />

      {/* Dev-Only Sandbox Management Portal */}
      <SandboxManagerModal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />
    </div>
  );
};

export default MobileLayout;
