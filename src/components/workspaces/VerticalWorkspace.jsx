import React, { useState, useEffect } from 'react';
import TaskController from '../tasks/TaskController';
import { taskUtils } from '../../utils/taskUtils';
import { resolveVerticalRootId } from '../../registry/verticalRegistry';
import { useAppNavigation } from '../../app/contexts/AppNavigationContext';
import { useLayoutShell } from '../../app/shells/useLayoutShell';
import { useWorkspaceFilter } from '../../app/contexts/WorkspaceFilterContext';
import WorkspaceSubSidebar from '../../app/shells/WorkspaceSubSidebar';
import { IconLock } from '../ui/Icons';

import './VerticalWorkspace.css';

/**
 * VerticalWorkspace Component
 * Refactored: Pure data and task board container post-Phase 2.
 * Renders the primary TaskController board and encapsulates search filters.
 */
const VerticalWorkspace = ({ 
  label, 
  activeVertical, 
  tasks, 
  setTasks, 
  addTask,
  actualSetTasks,
  refreshTasks,
  deleteTask,
  updateTask,
  bulkUpdateTasks,
  updateTaskStage,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  onShowBottomNav,
  SidebarComponent, 
  onHeaderClick,
  TaskFormComponent, 
  TaskTileComponent,
  user = {}, 
  permissions = {},
  verticals = {},
  boardLabel,
  children,
  isMainSidebarOpen
}) => {
  const { setActiveVertical } = useAppNavigation();
  const { isDesktop } = useLayoutShell();

  const { filters, setFilters, handleFilterChange, handleBatchFilter, resetFilters } = useWorkspaceFilter();
  const [isTrayVisible, setIsTrayVisible] = React.useState(true);

  // Sync state upward from MasterPageHeader (via TaskController)
  const handleTrayVisibilityChange = React.useCallback((visible) => {
    setIsTrayVisible(visible);
  }, []);
  
  const rootVerticalId = resolveVerticalRootId(activeVertical, verticals);

  const isFeatureView = (activeVertical || '').includes('_') && !verticals[activeVertical] && activeVertical !== 'DATA_MANAGER' && activeVertical !== verticals.CHARGING_HUBS?.id;
  const featureBaseName = (activeVertical || '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const featureAccessFlag = `canAccess${featureBaseName}`;

  const effectiveFeatureFlag = (activeVertical === verticals.CHARGING_HUBS?.id) ? 'canAccessHubTasks' : featureAccessFlag;
  const isFeatureAuthorized = permissions[effectiveFeatureFlag] && user?.assignedVerticals?.includes(rootVerticalId);

  const isAuthorized = permissions.scope === 'global' || (
    (isFeatureView || activeVertical === verticals.CHARGING_HUBS?.id)
      ? isFeatureAuthorized
      : (permissions.canRead && user?.assignedVerticals?.includes(rootVerticalId))
  );

  if (!isAuthorized) {
    return (
      <div className="workspace-container access-denied-layout">
        <div className="access-denied-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <IconLock className="lock-icon" size={48} style={{ opacity: 0.5, color: 'var(--brand-red)' }} />
          <h2>Access Denied</h2>
          <p>You do not have permission to access the <strong>{label}</strong> {isFeatureView ? 'feature' : 'workspace'}.</p>
          <p>Please contact your administrator if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`workspace-container ${(!isDesktop || !isSubSidebarOpen) ? 'sub-sidebar-collapsed' : ''}`}>
      {isDesktop && (
        <WorkspaceSubSidebar
          label={label}
          isSubSidebarOpen={isSubSidebarOpen}
          setIsSubSidebarOpen={setIsSubSidebarOpen}
          isTrayVisible={isTrayVisible}
          onHeaderClick={onHeaderClick}
          SidebarComponent={SidebarComponent}
          user={user}
          permissions={permissions}
          activeVertical={activeVertical}
          setActiveVertical={setActiveVertical}
          handleFilterChange={handleFilterChange}
          resetFilters={resetFilters}
          filters={filters}
          tasks={tasks}
          setFilters={setFilters}
        />
      )}

      <main className="workspace-content">
        {React.Children.toArray(children).some(child => !!child) ? (
          React.Children.map(children, child => 
            React.isValidElement(child) 
              ? React.cloneElement(child, { 
                  filters, 
                  onFilterChange: handleFilterChange,
                  onReset: resetFilters,
                  onBatchFilter: handleBatchFilter,
                  SidebarComponent,
                  tasks,
                  user,
                  permissions,
                  verticals,
                  activeVertical,
                  setActiveVertical,
                  onShowBottomNav,
                  isSubSidebarOpen,
                  setIsSubSidebarOpen,
                  isMainSidebarOpen,
                  onTrayVisibilityChange: handleTrayVisibilityChange
                })
              : child
          )
        ) : (
          <TaskController 
            activeVertical={activeVertical}
            rootVerticalId={rootVerticalId}
            tasks={tasks}
            filters={filters}
            setTasks={setTasks} 
            actualSetTasks={actualSetTasks}
            refreshTasks={refreshTasks}
            updateTask={updateTask}
            addTask={addTask}
            bulkUpdateTasks={bulkUpdateTasks}
            deleteTask={deleteTask}
            updateTaskStage={updateTaskStage}
            handleFilterChange={handleFilterChange}
            resetFilters={resetFilters}
            setFilters={setFilters}
            onBatchFilter={handleBatchFilter}
            SidebarComponent={SidebarComponent}
            setActiveVertical={setActiveVertical}
            label={label}
            TaskFormComponent={TaskFormComponent}
            TaskTileComponent={TaskTileComponent}
            user={user} 
            permissions={permissions} 
            verticals={verticals}
            boardLabel={boardLabel}
            isSubSidebarOpen={isSubSidebarOpen}
            setIsSubSidebarOpen={setIsSubSidebarOpen}
            isMainSidebarOpen={isMainSidebarOpen}
            onShowBottomNav={onShowBottomNav}
            onTrayVisibilityChange={handleTrayVisibilityChange}
          />
        )}
      </main>
    </div>
  );
};

export default VerticalWorkspace;