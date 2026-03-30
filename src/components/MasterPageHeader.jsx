import React, { useState, useEffect } from 'react';
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
const MasterPageHeader = ({ title, description, leftActions, rightActions, expandedLeft, expandedRight }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(() => {
    const saved = localStorage.getItem('master-header-menu-open');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('master-header-menu-open', isMenuOpen);
  }, [isMenuOpen]);

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
    </header>
  );
};

export default MasterPageHeader;
