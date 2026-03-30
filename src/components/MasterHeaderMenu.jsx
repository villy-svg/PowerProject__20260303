import React from 'react';
import './MasterPageHeader.css';

/**
 * MasterHeaderMenu
 * 
 * The expandable sub-row for MasterPageHeader.
 * Handles the display of secondary actions like view toggles, filters, and bulk operations.
 */
const MasterHeaderMenu = ({ expandedLeft, expandedRight }) => {
  return (
    <div className="expanded-menu-row">
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
