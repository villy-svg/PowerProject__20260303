import React from 'react';
import TaskController from './TaskController';
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
  setTasks, // This now receives the 'addTask' async helper from App.jsx
  actualSetTasks,
  refreshTasks,
  deleteTask,
  updateTask,
  bulkUpdateTasks,
  updateTaskStage,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  setActiveVertical,
  SidebarComponent, 
  onHeaderClick,
  TaskFormComponent, 
  TaskTileComponent, // New prop
  user = {}, 
  permissions = {},
  children
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

  // Auto-populate filters on first load (Select All by default)
  React.useEffect(() => {
    if (Array.isArray(tasks) && tasks.length > 0 && !isInitialized) {
      const allCities = [...new Set(tasks.map(t => t.city).filter(Boolean))];
      const allHubs = [...new Set(tasks.map(t => t.hub_id).filter(Boolean))];
      const allPriorities = [...new Set(tasks.map(t => t.priority).filter(Boolean))]; // Dynamically get priorities
      const allFunctions = [...new Set(tasks.map(t => t.function).filter(Boolean))];
      const allAssignees = [...new Set(tasks.map(t => t.assigneeName).filter(Boolean))];

      setFilters(prev => ({
        ...prev,
        city: allCities,
        hub: allHubs,
        priority: allPriorities,
        function: allFunctions,
        assignee: allAssignees
      }));
      setIsInitialized(true);
    }
  }, [tasks, isInitialized]);

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
  const featureBaseName = activeVertical.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const featureAccessFlag = `canAccess${featureBaseName}`;
  const isFeatureView = activeVertical.includes('_');

  const hasAccess = permissions.scope === 'global' || (
    isFeatureView 
      ? (permissions[featureAccessFlag] && user?.assignedVerticals?.some(v => activeVertical.toUpperCase().includes(v)))
      : (permissions.canRead && user?.assignedVerticals?.includes(activeVertical))
  );

  // Security Interception
  if (!hasAccess) {
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
      <aside className="sub-sidebar">
        <div className="sub-sidebar-header">
          <button 
            className="sub-sidebar-toggle" 
            onClick={() => setIsSubSidebarOpen(!isSubSidebarOpen)}
            title={isSubSidebarOpen ? "Collapse Menu" : "Expand Menu"}
          >
            {isSubSidebarOpen ? '«' : '»'}
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


      <main className="workspace-content">
        {React.Children.toArray(children).some(child => !!child) ? (
          React.Children.map(children, child => 
            React.isValidElement(child) 
              ? React.cloneElement(child, { filters, onFilterChange: handleFilterChange })
              : child
          )
        ) : (
          /* The TaskController now receives the 'addTask' helper (as setTasks) 
              and the 'deleteTask'/'updateTaskStage' async functions.
          */
          <TaskController 
            activeVertical={activeVertical}
            tasks={tasks}
            filters={filters}
            setTasks={setTasks} 
            actualSetTasks={actualSetTasks}
            refreshTasks={refreshTasks}
            updateTask={updateTask}
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
          />
        )}
      </main>
    </div>
  );
};

export default VerticalWorkspace;