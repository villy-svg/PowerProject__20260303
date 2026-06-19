/**
 * WorkspaceSubSidebar.jsx
 * 
 * Extracted Sub-Sidebar component for VerticalWorkspace.
 * Responsible for displaying vertical-specific side navigation and column filters.
 *
 * SITS IN:
 * - Desktop: Rendered as an inline collapsible panel on the left of content.
 * - Mobile: Mounted within the off-canvas drawer / drawer components.
 * 
 * Skill compliance:
 * - development-best-practices §1 Strict Modularity
 * - development-best-practices §3 Component Extraction
 * - adaptive-ui-strategy §3 Shared Data vs Swapped Shells
 */

import React from 'react';
import { IconChevronLeft, IconChevronRight } from '../../components/ui/Icons';

const WorkspaceSubSidebar = ({
  label,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  isTrayVisible,
  onHeaderClick,
  SidebarComponent,
  user,
  permissions,
  activeVertical,
  setActiveVertical,
  handleFilterChange,
  resetFilters,
  filters,
  tasks,
  setFilters,
}) => {
  return (
    <aside className={`sub-sidebar ${!isSubSidebarOpen ? 'collapsed' : ''} ${isTrayVisible ? 'tray-visible' : ''}`}>
      <div className="sub-sidebar-header">
        <button
          className="sub-sidebar-toggle"
          onClick={() => setIsSubSidebarOpen(!isSubSidebarOpen)}
          title={isSubSidebarOpen ? "Collapse Menu" : "Expand Menu"}
        >
          {isSubSidebarOpen ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />}
        </button>

        <h3
          className={onHeaderClick ? 'navigable-header' : ''}
          onClick={onHeaderClick}
          title={onHeaderClick ? "Click to open Management View" : ""}
        >
          {label}
        </h3>
      </div>

      {SidebarComponent ? (
        <SidebarComponent
          user={user}
          permissions={permissions}
          activeVertical={activeVertical}
          setActiveVertical={setActiveVertical}
          onFilterChange={handleFilterChange}
          onReset={() => resetFilters()}
          onBatchFilter={(key, values) => {
            setFilters(prev => ({ ...prev, [key]: values }));
          }}
          filters={filters}
          tasks={tasks}
        />
      ) : (
        <div className="sub-sidebar-body">
          <div className="sub-nav-item">
            <div className="sub-nav-text">
              <p>{label} Workspace</p>
              <small>Session Role: {user?.roleId || 'User'}</small>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default WorkspaceSubSidebar;
