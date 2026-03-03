import React from 'react';
import TaskController from './TaskController';
import './VerticalWorkspace.css';

/**
 * VerticalWorkspace Component
 * Acts as the layout wrapper for specific vertical content.
 * Multi-Vertical Update: Refactored to support the 'assignedVerticals' array.
 */
const VerticalWorkspace = ({ 
  label, 
  activeVertical, 
  tasks, 
  setTasks, 
  deleteTask,
  updateTaskStage,
  isSubSidebarOpen,
  setIsSubSidebarOpen,
  user = {}, 
  permissions = {} 
}) => {
  
  /**
   * REFACTORED LAYOUT GUARD logic
   * Master/Global roles enter any room; 
   * Restricted roles must have the activeVertical ID in their assigned list.
   */
  const hasAccess = 
    permissions.canRead && (
      permissions.scope === 'global' || 
      user?.assignedVerticals?.includes(activeVertical) // Refactored check
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

          <h3>{label}</h3>
        </div>
        
        <div className="sub-sidebar-body">
          <div className="sub-sidebar-placeholder">
            <p>Module Navigation</p>
            <small>Session Role: {user?.role}</small>
          </div>
        </div>
      </aside>

      <main className="workspace-content">
        <TaskController 
          activeVertical={activeVertical}
          tasks={tasks}
          setTasks={setTasks}
          deleteTask={deleteTask}
          updateTaskStage={updateTaskStage}
          user={user} 
          permissions={permissions} 
        />
      </main>
    </div>
  );
};

export default VerticalWorkspace;