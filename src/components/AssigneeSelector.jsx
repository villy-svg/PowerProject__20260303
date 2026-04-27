import React, { useState, useRef, useEffect } from 'react';
import { useAssignees } from '../hooks/useAssignees';
import { taskUtils } from '../utils/taskUtils';
import './AssigneeSelector.css';

/**
 * AssigneeSelector
 * Standardized multi-select dropdown for selecting assignees.
 * Uses the centralized useAssignees hook to fetch data once.
 * Returns an array of UUIDs (uuid[]).
 */
const AssigneeSelector = ({ 
  value = [], // Expects an array of UUIDs
  onChange, 
  currentUser, 
  id,
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...'
}) => {
  const { assignees, loading } = useAssignees(true);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Ensure value is always an array for logic consistency
  const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

  // Removed document listener in favor of a local backdrop for better modal compatibility

  const toggleOption = (id) => {
    if (disabled) return;
    
    let newSelection;
    if (selectedIds.includes(id)) {
      newSelection = selectedIds.filter(item => item !== id);
    } else {
      newSelection = [...selectedIds, id];
    }
    onChange(newSelection);
  };

  const getLabel = () => {
    if (loading) return 'Loading...';
    if (selectedIds.length === 0) return 'N/A (Unassigned)';
    
    if (selectedIds.length === 1) {
      const emp = assignees.find(e => e.id === selectedIds[0]);
      return emp ? taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser) : 'Selected (1)';
    }

    // NEW: Primary Assignee Name + N format
    const primaryEmp = assignees.find(e => e.id === selectedIds[0]);
    if (primaryEmp) {
      const isMe = (currentUser?.employeeId && primaryEmp.id === currentUser.employeeId) ||
                   (currentUser?.id && primaryEmp.id === currentUser.id);
      const name = isMe ? 'You' : primaryEmp.full_name.split(' ')[0];
      return `${name} + ${selectedIds.length - 1}`;
    }

    return `Selected (${selectedIds.length})`;
  };

  return (
    <div 
      className={`assignee-selector-container ${isOpen ? 'open' : ''}`} 
      ref={containerRef}
    >
      <button 
        type="button"
        id={id}
        className={`assignee-selector-trigger ${disabled ? 'disabled' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="selected-count">{getLabel()}</span>
        <span className="dropdown-arrow">▼</span>
      </button>

      {isOpen && !disabled && (
        <>
          <div 
            className="selector-backdrop" 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsOpen(false);
            }}
          />
          <div className="assignee-dropdown-menu fade-in">
            {assignees.length === 0 ? (
              <div className="no-assignees">No employees found</div>
            ) : (
              assignees.map(emp => {
                const isSelected = selectedIds.includes(emp.id);
                return (
                  <div 
                    key={emp.id} 
                    id={`assignee-option-${emp.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`assignee-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleOption(emp.id);
                    }}
                  >
                    <div className="assignee-checkbox">
                      {isSelected && '✓'}
                    </div>
                    <span className="assignee-name">
                      {taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AssigneeSelector;
