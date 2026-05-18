/**
 * MobileHeader.jsx
 *
 * Mobile-only header component. Features:
 * - Sticky scroll-aware show/hide (Chrome-style)
 * - Mobile Action Tray (bottom pill bar with Home, Sidebar, Menu, Add)
 * - Body scroll lock when menu is open
 * - Full-screen overlay menu (slides down from top)
 *
 * DOES NOT INCLUDE:
 * - Inline menu row (that's desktop-only)
 * - Description text (hidden on mobile for space)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 * - adaptive-ui-strategy §5 Mobile Layout
 * - master-header-system §1-5
 */

import React, { useEffect, useRef } from 'react';
import {
  IconHome,
  IconMenu,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
} from '../../components/Icons';
import MasterHeaderMenu from '../../components/MasterHeaderMenu';

const MobileHeader = ({
  title,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isMenuOpen,
  setIsMenuOpen,
  isScrollVisible,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  isTaskModalOpen,
  onShowBottomNav,
  hideMenuClose,
  isSidebarOpen,
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight);

  // ─── Body scroll lock for mobile menu ─────────────────────────────
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [isMenuOpen]);

  // ─── Compute header visibility ────────────────────────────────────
  const isHeaderHidden = !isScrollVisible && !isMenuOpen && !isSubSidebarOpen && !isSidebarOpen;

  return (
    <>
      <header className={`master-page-header mobile-header-shell ${isMenuOpen ? 'is-sticky' : ''} ${isHeaderHidden ? 'header-hidden' : ''}`}>
        {/* Row 1: Title (compact on mobile) */}
        <div className="header-row-1">
          <h1>{title}</h1>
        </div>

        {/* Row 2: Description — HIDDEN on mobile (adaptive-ui-strategy §6) */}

        {/* Expanded Menu Overlay (slides down from top on mobile) */}
        <div className="header-actions-area">
          {hasExpandedContent && isMenuOpen && (
            <MasterHeaderMenu
              expandedLeft={expandedLeft}
              expandedRight={expandedRight}
              onClose={() => setIsMenuOpen(false)}
              hideCloseButton={hideMenuClose}
            />
          )}
        </div>
      </header>

      {/* MOBILE ACTION TRAY (bottom pill bar) */}
      <div className={`mobile-action-tray ${(isScrollVisible || isMenuOpen || isSubSidebarOpen || isSidebarOpen) ? '' : 'tray-hidden'}`}>
        <div className="mobile-action-tray-container">
          {/* Home / Switch Vertical */}
          <button
            className="halo-button mobile-tray-btn"
            title="Switch Vertical"
            onClick={() => { if (onShowBottomNav) onShowBottomNav(); }}
          >
            <IconHome size={22} />
          </button>

          {/* Sidebar Toggle */}
          {onSidebarToggle && (
            <button
              className={`halo-button mobile-tray-btn ${isSubSidebarOpen ? 'active' : ''}`}
              onClick={() => {
                const nextSidebarState = !isSubSidebarOpen;
                if (nextSidebarState) setIsMenuOpen(false);
                onSidebarToggle(nextSidebarState);
              }}
              title="Toggle Sidebar"
            >
              {isSubSidebarOpen ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
            </button>
          )}

          {/* Menu Toggle */}
          {hasExpandedContent && (
            <button
              className={`halo-button mobile-tray-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => {
                const nextMenuState = !isMenuOpen;
                setIsMenuOpen(nextMenuState);
                if (nextMenuState && onSidebarToggle) onSidebarToggle(false);
              }}
              title="Toggle Menu"
            >
              <IconMenu size={20} />
            </button>
          )}

          {/* Add Button */}
          {canAdd && (
            <button
              className={`halo-button mobile-tray-btn mobile-add-btn ${isTaskModalOpen ? 'active' : ''}`}
              onClick={onAddClick}
              title="Add New"
            >
              <IconPlus size={24} />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileHeader;
