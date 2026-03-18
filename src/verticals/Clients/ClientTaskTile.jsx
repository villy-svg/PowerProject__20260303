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
      case 'Urgent': return '#ff4444';
      case 'High': return '#ff8800';
      case 'Medium': return '#007aff';
      default: return 'var(--brand-green)';
    }
  };

  return (
    <div className="task-tile" onClick={onClick}>
      <div className="task-tile-priority" style={{ backgroundColor: getPriorityColor(task.priority) }} />
      <div className="task-tile-content">
        <h4 className="task-tile-title">{task.text}</h4>
        {task.description && <p className="task-tile-desc">{task.description}</p>}
        
        <div className="task-tile-footer" style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* If the task has a related client assigned, we can display it here in the future */}
          <span className="task-tile-date" style={{ fontSize: '0.65rem', opacity: 0.5 }}>
            {new Date(task.updated_at).toLocaleDateString()}
          </span>
          <span className="priority-label" style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: getPriorityColor(task.priority) }}>
            {task.priority}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ClientTaskTile;
