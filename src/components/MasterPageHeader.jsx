import React from 'react';
import './MasterPageHeader.css';

/**
 * MasterPageHeader
 * 
 * Standardized 3-row layout for all vertical management pages.
 * 
 * Props:
 *   title          {string}    - Row 1: Main page title
 *   description    {string}    - Row 2: Short description/info
 *   leftActions    {node}      - Row 3 Left: Contextual tools (e.g. view toggles)
 *   rightActions   {node}      - Row 3 Right: Action buttons (e.g. Create, Import, Export)
 */
const MasterPageHeader = ({ title, description, leftActions, rightActions }) => {
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
      
      {(leftActions || rightActions) && (
        <div className="master-header-actions-row">
          <div className="master-header-left">
            {leftActions}
          </div>
          <div className="master-header-right">
            {rightActions}
          </div>
        </div>
      )}
    </header>
  );
};

export default MasterPageHeader;
