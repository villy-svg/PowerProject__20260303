import React from 'react';
import BaseDropdown from './BaseDropdown';
import { useAssignees } from '../hooks/useAssignees';
import { taskUtils } from '../utils/taskUtils';
import './AssigneeSelector.css';

const AssigneeSelector = ({
  value = [],
  onChange,
  currentUser = null,
  id = '',
  isSingle = false,
  limitToIds = null,
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...',
}) => {
  const { assignees, loading } = useAssignees(true);

  const options = assignees.map(emp => ({
    label: emp.full_name,
    value: emp.id,
  }));

  const getLabel = (selectedValues, options) => {
    if (loading) return 'Loading...';
    if (selectedValues.length === 0) return 'N/A (Unassigned)';

    if (selectedValues.length === 1) {
      const emp = assignees.find(e => e.id === selectedValues[0]);
      return emp
        ? taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)
        : 'Selected (1)';
    }

    const primary = assignees.find(e => e.id === selectedValues[0]);
    if (primary) {
      const isMe = currentUser?.employeeId === primary.id || currentUser?.id === primary.id;
      const name = isMe ? 'You' : primary.full_name.split(' ')[0];
      return `${name} + ${selectedValues.length - 1}`;
    }

    return `Selected (${selectedValues.length})`;
  };

  const renderItem = (opt, isSelected, mode) => (
    <>
      <div className="custom-dropdown-checkbox">
        {isSelected && (mode === 'single' ? <div className="radio-dot" /> : '✓')}
      </div>
      <span className="custom-dropdown-text">
        {taskUtils.formatAssigneeForList(opt.value, opt.label, currentUser)}
      </span>
    </>
  );

  return (
    <BaseDropdown
      id={id}
      value={isSingle && Array.isArray(value) ? value[0] : value}
      onChange={(val) => {
        if (isSingle) {
          onChange(Array.isArray(val) ? val : [val]);
        } else {
          onChange(val);
        }
      }}
      options={options}
      mode={isSingle ? 'single' : 'multi'}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      loading={loading}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label']}
      getLabel={getLabel}
      renderItem={renderItem}
      limitToIds={limitToIds}
      loadMoreLabel="+ Load other employees"
      displayMode="compact"
      currentUser={currentUser}
    />
  );
};

export default AssigneeSelector;
