import React from 'react';

/**
 * ClientTaskTile (Optional Customization)
 * 
 * Reuses the standard task layout but adds client-specific badges or decorations.
 * If you want a standard tile, you can just use the default.
 * For now, we'll create a customized one that could display the client name.
 */
const ClientTaskTile = ({ task, onClick }) => {
  const getPriorityColor = (p) => {
    switch (p) {
      case 'Urgent': return 'var(--priority-urgent)';
      case 'High': return 'var(--priority-high)';
      case 'Medium': return 'var(--priority-medium)';
      default: return 'var(--priority-low)';
    }
  };

  return (
    <div className="task-tile" onClick={onClick}>
      <div className="task-tile-priority" style={{ backgroundColor: getPriorityColor(task.priority) }} />
      <div className="task-tile-content">
        <h4 className="task-tile-title">{task.text}</h4>
        {task.description && <p className="task-tile-desc">{task.description}</p>}
        
        <div className="task-tile-footer u-mt-8 u-flex-between u-items-center">
          {/* If the task has a related client assigned, we can display it here in the future */}
          <span className="task-tile-date u-opacity-50" style={{ fontSize: '0.65rem' }}>
            {new Date(task.updated_at).toLocaleDateString()}
          </span>
          <span className="priority-label u-fw-800 u-text-upper" style={{ fontSize: '0.6rem', color: getPriorityColor(task.priority) }}>
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientTaskTile;
