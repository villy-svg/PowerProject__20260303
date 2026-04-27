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
  isSingle = false,
  limitToIds = null, // Optional array of IDs to show first
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...'
}) => {
  const { assignees, loading } = useAssignees(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(!limitToIds); // Default to all if no limit provided
  const containerRef = useRef(null);

  // Ensure value is always an array for logic consistency
  const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

  // Split assignees into visible (limited) and hidden (rest)
  const visibleAssignees = limitToIds 
    ? assignees.filter(e => limitToIds.includes(e.id))
    : assignees;
  
  const hiddenAssignees = limitToIds
    ? assignees.filter(e => !limitToIds.includes(e.id))
    : [];

  const toggleOption = (id) => {
    if (disabled) return;
    
    let newSelection;
    if (isSingle) {
      newSelection = [id];
    } else {
      if (selectedIds.includes(id)) {
        newSelection = selectedIds.filter(item => item !== id);
      } else {
        newSelection = [...selectedIds, id];
      }
    }
    onChange(newSelection);
    if (isSingle) setIsOpen(false); // Close dropdown immediately for single select
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

  const renderOption = (emp) => {
    const isSelected = selectedIds.includes(emp.id);
    return (
      <div 
        key={emp.id} 
        id={`assignee-option-${emp.id}`}
        role="option"
        aria-selected={isSelected}
        className={`custom-dropdown-option ${isSelected ? 'selected' : ''} ${isSingle ? 'single' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleOption(emp.id);
        }}
      >
        <div className="custom-dropdown-checkbox">
          {isSelected && (isSingle ? <div className="radio-dot" /> : '✓')}
        </div>
        <span className="custom-dropdown-text">
          {taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)}
        </span>
      </div>
    );
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
        <span className="dropdown-arrow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </span>
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
          <div className="assignee-dropdown-menu custom-dropdown-menu fade-in">
            {assignees.length === 0 ? (
              <div className="no-assignees">No employees found</div>
            ) : (
              <>
                {visibleAssignees.map(renderOption)}
                
                {limitToIds && !showAll && hiddenAssignees.length > 0 && (
                  <button 
                    type="button" 
                    className="load-others-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAll(true);
                    }}
                  >
                    + Load other employees ({hiddenAssignees.length})
                  </button>
                )}

                {showAll && hiddenAssignees.map(renderOption)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AssigneeSelector;
