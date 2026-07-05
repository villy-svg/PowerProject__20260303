/**
 * DesktopHeader.jsx
 *
 * Desktop-only header component. Renders as an inline row within the
 * desktop shell. Features:
 * - Title + description
 * - MENU toggle button (when expandedLeft/expandedRight are provided)
 * - Left actions (view toggles, filters)
 * - Right actions (Add Task, CRUD buttons)
 * - Expanded menu row (view mode, import/export, etc.)
 *
 * DOES NOT INCLUDE:
 * - Scroll-aware sticky behavior (desktop has enough screen estate)
 * - Mobile action tray (BottomNav handles this on mobile)
 * - Body scroll lock (no overlays on desktop)
 * - Backdrop blur (desktop menu is inline, not an overlay)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Desktop Interactions
 * - adaptive-ui-strategy §5 Desktop Layout
 * - master-header-system §1-5
 */

import React from 'react';
import {
  IconChevronRight,
  IconChevronDown,
} from '../../components/ui/Icons';
import MasterHeaderMenu from '../../components/layout/MasterHeaderMenu';
import SearchBar from '../../components/ui/SearchBar';

const DesktopHeader = ({
  title,
  description,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isMenuOpen,
  setIsMenuOpen,
  hideMenuClose,
  // Optional records-mode props (for records managers)
  searchRecords,
  recordType,
  onSearchSelect,
  onSearchEdit,
  hideSearchBar,
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight);

  return (
    <header className="master-page-header desktop-header-shell">
      {/* Row 1: Title */}
      <div className="header-row-1">
        <h1>{title}</h1>
      </div>

      {/* Row 2: Description */}
      {description && (
        <div className="header-row-2">
          <p>{description}</p>
        </div>
      )}

      {/* Row 2.5: Search Bar — task-scoped or records-mode */}
      {!hideSearchBar && (
        <SearchBar
          context="board"
          records={searchRecords}
          recordType={recordType}
          onSelect={onSearchSelect}
          onEdit={onSearchEdit}
        />
      )}

      {/* Row 3: Actions */}
      <div className="header-actions-area">
        <div className="master-header-actions-row">
          <div className="master-header-left">
            {hasExpandedContent && (
              <button
                className={`halo-button menu-trigger-btn ${isMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <span className="menu-icon">
                  {isMenuOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                </span>
                MENU
              </button>
            )}
            {leftActions}
          </div>
          <div className="master-header-right">
            {rightActions}
          </div>
        </div>

        {/* Row 4: Expanded Menu (inline on desktop — no overlay) */}
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
  );
};

export default DesktopHeader;
