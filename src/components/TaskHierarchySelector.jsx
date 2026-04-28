import React from 'react';
import CustomSelect from './CustomSelect';

/**
 * TaskHierarchySelector
 * A standardized dropdown for selecting a Parent Task.
 * Uses the new CustomSelect for premium UI consistency.
 */
const TaskHierarchySelector = ({ id, value, onChange, availableTasks = [], disabled = false }) => {
  const options = [
    { label: 'None (Root)', value: '' },
    ...availableTasks.map(task => ({ label: task.text, value: task.id }))
  ];

  return (
    <>
      <CustomSelect
        id={id}
        value={value || ''}
        onChange={onChange}
        options={options}
        placeholder="Select Parent Task..."
        disabled={disabled}
        fullWidthDropdown={true}
      />
      {availableTasks.length === 0 && !disabled && (
        <small style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', display: 'block', marginTop: '4px' }}>
          No other tasks available to nest under.
        </small>
      )}
    </>
  );
};

export default TaskHierarchySelector;
