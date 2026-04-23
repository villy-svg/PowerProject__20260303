import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { 
  IconHome, 
  IconMenu, 
  IconPlus, 
  IconChevronLeft, 
  IconChevronRight, 
  IconChevronDown 
} from './Icons';
import './MasterPageHeader.css';
import MasterHeaderMenu from './MasterHeaderMenu';

/**
 * MasterPageHeader
 * 
 * Standardized 3-row (+ expanded Menu) layout for all vertical management pages.
 * 
 * Props:
 *   title          {string}    - Row 1: Main page title
 *   description    {string}    - Row 2: Short description/info
 *   leftActions    {node}      - Row 3 Left: Contextual tools (now usually the Menu button)
 *   rightActions   {node}      - Row 3 Right: Primary action buttons (e.g. + Add Task)
 *   expandedLeft   {node}      - Row 4 Left: Menu Row content (View toggles, filters)
 *   expandedRight  {node}      - Row 4 Right: Menu Row content (Import/Export/Bulk)
 */
const MasterPageHeader = ({ 
  title, 
  description, 
  leftActions, 
  rightActions, 
  expandedLeft, 
  expandedRight,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  isTaskModalOpen,
  onShowBottomNav,
  setActiveVertical,
  onTrayVisibilityChange,
  isMenuOpen: controlledIsMenuOpen,
  setIsMenuOpen: controlledSetIsMenuOpen,
  hideMenuClose,
  isSidebarOpen
}) => {
  const isScrollVisible = useScrollDirection(10, 100);
  const pressTimer = useRef(null);

  // Internal state fallback if not controlled by parent
  const [internalIsMenuOpen, setInternalIsMenuOpen] = useState(() => {
    const saved = localStorage.getItem('master-header-menu-open');
    return saved === 'true';
  });

  const isMenuOpen = controlledIsMenuOpen !== undefined ? controlledIsMenuOpen : internalIsMenuOpen;
  const setIsMenuOpen = controlledSetIsMenuOpen !== undefined ? controlledSetIsMenuOpen : setInternalIsMenuOpen;

  useEffect(() => {
    localStorage.setItem('master-header-menu-open', isMenuOpen);

    // Body scroll lock for mobile menu
    if (isMenuOpen && window.innerWidth <= 1024) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }

    return () => document.body.classList.remove('no-scroll');
  }, [isMenuOpen]);

  // Notify parent whenever tray visibility changes, so they can sync
  // the bulk-action-bar without running a separate hook instance.
  useEffect(() => {
    if (onTrayVisibilityChange) onTrayVisibilityChange(isScrollVisible);
  }, [isScrollVisible, onTrayVisibilityChange]);

  // MUTUAL EXCLUSIVITY: Add Task Modal closes other overlays
  useEffect(() => {
    if (isTaskModalOpen) {
      setIsMenuOpen(false);
      if (isSubSidebarOpen && onSidebarToggle) onSidebarToggle(false);
    }
  }, [isTaskModalOpen, isSubSidebarOpen, onSidebarToggle]);

  const hasExpandedContent = !!(expandedLeft || expandedRight);

  return (
    <>
      <header className={`master-page-header ${isMenuOpen ? 'is-sticky' : ''} ${(!isScrollVisible && !isMenuOpen && !isSubSidebarOpen && !isSidebarOpen) ? 'header-hidden' : ''}`}>
        <div className="header-row-1">
        <h1>{title}</h1>
      </div>
      
      {description && (
        <div className="header-row-2">
          <p>{description}</p>
        </div>
      )}
      
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

      {/* MOBILE ACTION TRAY (Only visible on small screens) */}
      <div className={`mobile-action-tray ${(isScrollVisible || isMenuOpen || isSubSidebarOpen || isSidebarOpen) ? '' : 'tray-hidden'}`}>
        <div className="mobile-action-tray-container">
          <button 
            className="halo-button mobile-tray-btn" 
            title="Switch Vertical"
            onClick={() => {
              if (onShowBottomNav) onShowBottomNav();
            }}
          >
            <IconHome size={22} />
          </button>

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

export default MasterPageHeader;
