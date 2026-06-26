import React from 'react';
import './MasterPageHeader.css';

/**
 * MasterHeaderMenu
 * 
 * The expandable sub-row for MasterPageHeader.
 * Handles the display of secondary actions like view toggles, filters, and bulk operations.
 */
const MasterHeaderMenu = ({ 
  expandedLeft, 
  expandedRight, 
  onClose, 
  isVisible, 
  hideCloseButton,
  SidebarComponent,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  tasks,
  permissions,
  user,
  activeVertical,
  setActiveVertical
}) => {
  return (
    <div className={`expanded-menu-row ${isVisible ? 'visible' : ''}`}>
      {!hideCloseButton && (
        <div className="mobile-menu-header">
          <button 
            className="halo-button mobile-menu-close" 
            onClick={onClose}
          >
            CLOSE
          </button>
        </div>
      )}
      <div className="master-header-left">
        {expandedLeft}
      </div>
      {expandedRight && (
        <div className="master-header-right">
          {expandedRight}
        </div>
      )}
      
      {SidebarComponent && (
        <div className="mobile-menu-sidebar-filters">
          <SidebarComponent
            hideNavigation={true}
            onFilterChange={onFilterChange}
            onReset={onReset}
            onBatchFilter={onBatchFilter}
            filters={filters}
            tasks={tasks}
            permissions={permissions}
            user={user}
            activeVertical={activeVertical}
            setActiveVertical={setActiveVertical}
          />
        </div>
      )}
    </div>
  );
};

export default MasterHeaderMenu;
