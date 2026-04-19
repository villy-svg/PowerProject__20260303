import React, { useState, useEffect, useRef } from 'react';
import { useScrollDirection } from '../hooks/useScrollDirection';
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
  setActiveVertical
}) => {
  const isScrollVisible = useScrollDirection(10, 100);
  const pressTimer = useRef(null);

  const [isMenuOpen, setIsMenuOpen] = useState(() => {
    const saved = localStorage.getItem('master-header-menu-open');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('master-header-menu-open', isMenuOpen);
  }, [isMenuOpen]);

  // MUTUAL EXCLUSIVITY: Add Task Modal closes other overlays
  useEffect(() => {
    if (isTaskModalOpen) {
      setIsMenuOpen(false);
      if (isSubSidebarOpen && onSidebarToggle) onSidebarToggle(false);
    }
  }, [isTaskModalOpen, isSubSidebarOpen, onSidebarToggle]);

  const hasExpandedContent = !!(expandedLeft || expandedRight);

  return (
    <header className="master-page-header">
      <div className="header-row-1">
        <h1>{title}</h1>
      </div>
      
      {description && (
        <div className="header-row-2">
          <p>{description}</p>
        </div>
      )}
      
      <div className="master-header-actions-row">
        <div className="master-header-left">
          {hasExpandedContent && (
            <button 
              className={`halo-button menu-trigger-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="menu-icon">{isMenuOpen ? '▼' : '▶'}</span>
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
        />
      )}

      {/* MOBILE ACTION TRAY (Only visible on small screens) */}
      <div className={`mobile-action-tray ${!isScrollVisible ? 'tray-hidden' : ''}`}>
        <button 
          className="halo-button mobile-tray-btn" 
          title="Home"
          onPointerDown={(e) => {
            // Start a timer for long-press
            pressTimer.current = setTimeout(() => {
              pressTimer.current = null;
              if (onShowBottomNav) onShowBottomNav();
            }, 500);
          }}
          onPointerUp={(e) => {
            // If timer is still running, it was a short tap. Go home.
            if (pressTimer.current) {
              clearTimeout(pressTimer.current);
              pressTimer.current = null;
              if (setActiveVertical) setActiveVertical(null);
            }
          }}
          onPointerLeave={(e) => {
            // Cancel if they drag their finger away
            if (pressTimer.current) {
              clearTimeout(pressTimer.current);
              pressTimer.current = null;
            }
          }}
        >
          <span className="menu-icon" style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🏠</span>
        </button>

        {onSidebarToggle && (
          <button 
            className={`halo-button mobile-tray-btn ${isSubSidebarOpen ? 'active' : ''}`} 
            onClick={() => {
              const nextSidebarState = !isSubSidebarOpen;
              if (nextSidebarState) setIsMenuOpen(false); // Close menu if opening sidebar
              onSidebarToggle(nextSidebarState);
            }} 
            title="Toggle Sidebar"
          >
            {isSubSidebarOpen ? '«' : '»'}
          </button>
        )}
        
        {hasExpandedContent && (
          <button 
            className={`halo-button mobile-tray-btn ${isMenuOpen ? 'active' : ''}`}
            onClick={() => {
              const nextMenuState = !isMenuOpen;
              setIsMenuOpen(nextMenuState);
              if (nextMenuState) onSidebarToggle(false); // Force close sidebar if opening menu
            }}
            title="Toggle Menu"
          >
            <span className="menu-icon">{isMenuOpen ? '▼' : '☰'}</span>
          </button>
        )}

        {canAdd && (
          <button 
            className={`halo-button mobile-tray-btn mobile-add-btn ${isTaskModalOpen ? 'active' : ''}`} 
            onClick={onAddClick} 
            title="Add Task"
          >
            +
          </button>
        )}
      </div>
    </header>
  );
};

export default MasterPageHeader;
