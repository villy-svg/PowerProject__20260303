import React, { useState, useEffect } from 'react';
import TaskController from './TaskController';
import { taskUtils } from '../utils/taskUtils';
import { IconChevronLeft, IconChevronRight } from './Icons';
import './VerticalWorkspace.css';

/**
 * VerticalWorkspace Component
 * Acts as the layout wrapper for specific vertical content.
 * Updated: Now handles asynchronous task state from Supabase.
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
  setActiveVertical,
  onShowBottomNav,
  SidebarComponent, 
  onHeaderClick,
  TaskFormComponent, 
  TaskTileComponent, // New prop
  user = {}, 
  permissions = {},
  verticals = {}, // Passed from App.jsx
  boardLabel, // New prop
  children,
  isMainSidebarOpen
}) => {
  const [filters, setFilters] = React.useState({ 
    city: [], 
    hub: [], 
    priority: [], 
    role: [],
    function: [],
    assignee: [],
    duplicatesOnly: false 
  });
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isTrayVisible, setIsTrayVisible] = React.useState(true);

  // Sync state upward from MasterPageHeader (via TaskController)
  const handleTrayVisibilityChange = (visible) => {
    setIsTrayVisible(visible);
  };

  // Auto-populate filters on first load (Select All by default).
  // ADDITIVE MERGE: On subsequent task updates (e.g. after CSV import or add-task),
  // we union any newly-seen metadata values into the existing filter selections.
  // This prevents newly imported/created tasks from being silently hidden when they
  // carry a city, hub, function, or assignee not present in the original task set.
  React.useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const newCities    = [...new Set(tasks.map(t => t.city).filter(Boolean))];
    const newHubs      = [...new Set(tasks.map(t => t.hub_id).filter(Boolean))];
    const newPriorities = [...new Set(tasks.map(t => t.priority).filter(Boolean))];
    const newFunctions = [...new Set(tasks.map(t => t.function).filter(Boolean))];
    const newAssignees = [...new Set(tasks.map(t =>
      taskUtils.formatAssigneeForList(t.assigned_to, t.assigneeName, user)
    ).filter(Boolean))];

    if (!isInitialized) {
      // First load: select ALL values so nothing is hidden by default
      setFilters(prev => ({
        ...prev,
        city:     newCities,
        hub:      newHubs,
        priority: newPriorities,
        function: newFunctions,
        assignee: newAssignees,
      }));
      setIsInitialized(true);
    } else {
      // Subsequent updates: additive merge — add any new values so that
      // tasks imported or created after the initial load always pass the filter gate.
      setFilters(prev => ({
        ...prev,
        city:     [...new Set([...(prev.city     || []), ...newCities])],
        hub:      [...new Set([...(prev.hub      || []), ...newHubs])],
        priority: [...new Set([...(prev.priority || []), ...newPriorities])],
        function: [...new Set([...(prev.function || []), ...newFunctions])],
        assignee: [...new Set([...(prev.assignee || []), ...newAssignees])],
      }));
    }
  // FIX Issue-6: Added `user` to dep array — formatAssigneeForList uses user.id to label
  // the current user's tasks as "Me". Without it, the label is stale on first load.
  }, [tasks, user, isInitialized]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const current = prev[key];
      
      // Handle boolean toggles (like duplicatesOnly)
      if (typeof current === 'boolean') {
        return { ...prev, [key]: !current };
      }

      // Handle array-based filters
      const updated = (current || []).includes(value)
        ? current.filter(v => v !== value)
        : [...(current || []), value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = (newFilters) => {
    if (newFilters) {
      setFilters(newFilters);
    } else {
      // Default reset logic
      setIsInitialized(false); // Trigger re-init from tasks
    }
  };
  
  
  /**
   * LAYOUT GUARD
   * Determines if the user has permission to view this vertical or sub-feature.
   */
  const rootVerticalId = 
    (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'daily_task_templates') ? verticals.CHARGING_HUBS?.id :
    (activeVertical === verticals.CLIENTS?.id || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? verticals.CLIENTS?.id :
    (activeVertical === verticals.EMPLOYEES?.id || activeVertical === 'employee_tasks') ? verticals.EMPLOYEES?.id :
    // BUG-FIX: activeVertical can be null/undefined during initial render
    // before App state resolves. .toUpperCase() on null throws a blank screen crash.
    (activeVertical || '').toUpperCase();

  // FIX Issue-5: Use optional fallback to prevent crash if activeVertical is null/undefined
  const isFeatureView = (activeVertical || '').includes('_') && activeVertical !== verticals.CHARGING_HUBS?.id;
  const featureBaseName = activeVertical.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const featureAccessFlag = `canAccess${featureBaseName}`;

  // Mapping main vertical IDs to their primary feature access flags if they act as feature views
  const effectiveFeatureFlag = (activeVertical === verticals.CHARGING_HUBS?.id) ? 'canAccessHubTasks' : featureAccessFlag;
  const isFeatureAuthorized = permissions[effectiveFeatureFlag] && user?.assignedVerticals?.includes(rootVerticalId);

  // MAIN PERMISSION CHECK
  // Global scope users (Master Admin/Viewer) have access to everything.
  // Others need explicit assignment to the vertical AND feature-specific flags if applicable.
  const isAuthorized = permissions.scope === 'global' || (
    (isFeatureView || activeVertical === verticals.CHARGING_HUBS?.id)
      ? isFeatureAuthorized
      : (permissions.canRead && user?.assignedVerticals?.includes(rootVerticalId))
  );

  // Security Interception
  if (!isAuthorized) {
    return (
      <div className="workspace-container access-denied-layout">
        <div className="access-denied-content">
          <span className="lock-icon">🔒</span>
          <h2>Access Denied</h2>
          <p>You do not have permission to access the <strong>{label}</strong> {isFeatureView ? 'feature' : 'workspace'}.</p>
          <p>Please contact your administrator if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`workspace-container ${!isSubSidebarOpen ? 'sub-sidebar-collapsed' : ''}`}>
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
        
        {/* Render the specific SidebarComponent if provided, otherwise show generic placeholder */}
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

      {isSubSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSubSidebarOpen(false)} 
        />
      )}

      <main className="workspace-content">
        {React.Children.toArray(children).some(child => !!child) ? (
          React.Children.map(children, child => 
            React.isValidElement(child) 
              ? React.cloneElement(child, { 
                  filters, 
                  onFilterChange: handleFilterChange,
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
          /* The TaskController now receives the 'addTask' helper (as setTasks) 
              and the 'deleteTask'/'updateTaskStage' async functions.
          */
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
            setActiveVertical={setActiveVertical}
            onTrayVisibilityChange={handleTrayVisibilityChange}
          />
        )}
      </main>
    </div>
  );
};

export default VerticalWorkspace;