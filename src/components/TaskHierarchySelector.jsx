import React from 'react';

/**
 * TaskHierarchySelector
 * A standardized dropdown for selecting a Parent Task.
 * Used across all vertical task forms to ensure consistency.
 */
const TaskHierarchySelector = ({ id, value, onChange, availableTasks = [], disabled = false }) => {
  return (
    <div className="form-group">
      <label htmlFor={id}>Parent Task</label>
      <select 
        id={id}
        name="parentTask"
        className="master-dropdown"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">None (Top-level task)</option>
        {availableTasks.map(task => (
          <option key={task.id} value={task.id}>
            {task.text}
          </option>
        ))}
      </select>
      {availableTasks.length === 0 && !disabled && (
        <small style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
          No other tasks available to nest under.
        </small>
      )}
    </div>
  );
};

export default TaskHierarchySelector;
