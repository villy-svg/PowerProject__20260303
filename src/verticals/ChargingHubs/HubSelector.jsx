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
  disabled = false,
  placeholder = 'Select Hubs...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      <div 
        className={`hub-selector-trigger ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="selected-count">{getLabel()}</span>
        <span className="dropdown-arrow">▼</span>
      </div>

      {isOpen && !disabled && (
        <div className="hub-dropdown-menu fade-in">
          {hubs.length === 0 ? (
            <div className="no-hubs">No hubs available for this city</div>
          ) : (
            hubs.map(hub => {
              const isSelected = selectedIds.includes(hub.id);
              return (
                <div 
                  key={hub.id} 
                  className={`hub-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleOption(hub.id)}
                >
                  <div className="hub-checkbox">
                    {isSelected && '✓'}
                  </div>
                  <div className="hub-info">
                    <span className="hub-code">{hub.hub_code}</span>
                    <span className="hub-name">{hub.name}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default HubSelector;
