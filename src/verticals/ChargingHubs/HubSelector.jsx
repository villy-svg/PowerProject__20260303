import React, { useState, useRef, useEffect } from 'react';
import './HubSelector.css';

/**
 * HubSelector
 * Standardized multi-select dropdown for selecting charging hubs.
 * Mimics AssigneeSelector for UI consistency.
 */
const HubSelector = ({ 
  hubs = [], 
  value = [], 
  onChange, 
  id,
  disabled = false,
  placeholder = 'Select Hubs...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

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
    if (selectedIds.length === 0) return 'N/A (No Hub)';
    
    const firstHub = hubs.find(h => h.id === selectedIds[0]);
    if (!firstHub) return `Selected (${selectedIds.length})`;

    const primaryLabel = firstHub.hub_code || firstHub.name;
    
    if (selectedIds.length === 1) {
      return primaryLabel;
    }
    
    return `${primaryLabel} + ${selectedIds.length - 1}`;
  };

  return (
    <div 
      className={`hub-selector-container ${isOpen ? 'open' : ''}`} 
      ref={containerRef}
    >
      <button 
        type="button"
        id={id}
        className={`hub-selector-trigger ${disabled ? 'disabled' : ''}`}
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
          <div className="hub-dropdown-menu fade-in">
            {hubs.length === 0 ? (
              <div className="no-hubs">No hubs available for this city</div>
            ) : (
              hubs.map(hub => {
                const isSelected = selectedIds.includes(hub.id);
                return (
                  <div 
                    key={hub.id} 
                    id={`hub-option-${hub.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`hub-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleOption(hub.id);
                    }}
                  >
                    <div className="hub-checkbox">
                      {isSelected && '✓'}
                    </div>
                    <div className="hub-info">
                      <span className="hub-code">{hub.hub_code}</span>
                    </div>
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

export default HubSelector;
