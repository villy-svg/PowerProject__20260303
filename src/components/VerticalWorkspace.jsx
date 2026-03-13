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
  deleteTask,
  updateTaskStage,
  isSubSidebarOpen,
  setActiveVertical,
  SidebarComponent, 
  onHeaderClick,
  TaskFormComponent, 
  TaskTileComponent, // New prop
  user = {}, 
  permissions = {} 
}) => {
  
  // 🚩 RESTORE TRACE LOG:
  console.log(`🚩 TRACE 2: Workspace [${label}] received tasks. Count: ${tasks?.length}`);
  
  /**
   * LAYOUT GUARD
   * Determines if the user has permission to view this vertical.
   */
  const hasAccess = 
    permissions.canRead && (
      permissions.scope === 'global' || 
      user?.assignedVerticals?.includes(activeVertical)
    );

  // Security Interception
  if (!hasAccess) {
    return (
      <div className="workspace-container access-denied-layout">
        <div className="access-denied-content">
          <span className="lock-icon">🔒</span>
          <h2>Access Denied</h2>
          <p>You do not have permission to access the <strong>{label}</strong> workspace.</p>
          <p>This area is restricted to authorized personnel only.</p>
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
          <SidebarComponent user={user} setActiveVertical={setActiveVertical} />

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
        {/* The TaskController now receives the 'addTask' helper (as setTasks) 
            and the 'deleteTask'/'updateTaskStage' async functions.
        */}
        <TaskController 
          activeVertical={activeVertical}
          tasks={tasks}
          setTasks={setTasks} 
          deleteTask={deleteTask}
          updateTaskStage={updateTaskStage}
          TaskFormComponent={TaskFormComponent}
          TaskTileComponent={TaskTileComponent}
          user={user} 
          permissions={permissions} 
        />
      </main>
    </div>
  );
};

export default VerticalWorkspace;