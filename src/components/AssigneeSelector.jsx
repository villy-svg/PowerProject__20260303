import React from 'react';
import { useAssignees } from '../hooks/useAssignees';
import { taskUtils } from '../utils/taskUtils';

/**
 * AssigneeSelector
 * Standardized dropdown for selecting an assignee.
 * Uses the centralized useAssignees hook to fetch data once.
 */
const AssigneeSelector = ({ 
  value, 
  onChange, 
  currentUser, 
  className = 'master-dropdown', 
  disabled = false,
  required = false
}) => {
  const { assignees, loading } = useAssignees(true);

  return (
    <select 
      className={className}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      required={required}
    >
      <option value="">
        {loading ? 'Loading assignees...' : 'N/A (Unassigned)'}
      </option>
      {assignees.map(emp => (
        <option key={emp.id} value={emp.id}>
          {taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)}
        </option>
      ))}
    </select>
  );
};

export default AssigneeSelector;
