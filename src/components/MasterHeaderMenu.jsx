import React from 'react';
import './MasterPageHeader.css';

/**
 * MasterHeaderMenu
 * 
 * The expandable sub-row for MasterPageHeader.
 * Handles the display of secondary actions like view toggles, filters, and bulk operations.
 */
const MasterHeaderMenu = ({ expandedLeft, expandedRight, onClose, isVisible, hideCloseButton }) => {
  return (
    <div className={`expanded-menu-row ${isVisible ? 'visible' : ''}`}>
      <div className="mobile-menu-header">
        {!hideCloseButton && (
          <button 
            className="halo-button mobile-menu-close" 
            onClick={onClose}
          >
            CLOSE
          </button>
        )}
      </div>
      <div className="master-header-left">
        {expandedLeft}
      </div>
      <div className="master-header-right">
        {expandedRight}
      </div>
    </div>
  );
};

export default MasterHeaderMenu;
