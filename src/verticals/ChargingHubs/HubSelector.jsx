import React, { useState, useRef, useEffect } from 'react';
import './HubSelector.css';
import '../../styles/DropdownSystem.css';

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
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const fuzzyMatch = (str, pattern) => {
    if (!pattern) return true;
    if (!str) return false;
    pattern = pattern.toLowerCase();
    str = str.toLowerCase();
    let patternIdx = 0;
    let strIdx = 0;
    while (patternIdx < pattern.length && strIdx < str.length) {
      if (pattern[patternIdx] === str[strIdx]) {
        patternIdx++;
      }
      strIdx++;
    }
    return patternIdx === pattern.length;
  };

  const filteredHubs = hubs.filter(hub => 
    hub.name !== 'MULTI' && (fuzzyMatch(hub.hub_code, searchTerm) || fuzzyMatch(hub.name, searchTerm))
  );

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
      {isOpen ? (
        <div className="custom-select-search-wrapper">
          <input 
            ref={inputRef}
            type="text"
            className="custom-select-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            onClick={(e) => e.stopPropagation()}
          />
          <button 
            type="button" 
            className="custom-select-clear-btn" 
            onClick={(e) => { 
              e.stopPropagation(); 
              setSearchTerm(''); 
            }}
            style={{ visibility: searchTerm ? 'visible' : 'hidden' }}
          >
            ×
          </button>
        </div>
      ) : (
        <button 
          type="button"
          id={id}
          className={`hub-selector-trigger ${disabled ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(true);
          }}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="selected-count">{getLabel()}</span>
          <span className="dropdown-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </button>
      )}

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
          <div className="hub-dropdown-menu custom-dropdown-menu fade-in">
            {filteredHubs.length === 0 ? (
              <div className="no-hubs">No hubs available</div>
            ) : (
              filteredHubs.map(hub => {
                const isSelected = selectedIds.includes(hub.id);
                return (
                  <div 
                    key={hub.id} 
                    id={`hub-option-${hub.id}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`custom-dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      toggleOption(hub.id);
                    }}
                  >
                    <div className="custom-dropdown-checkbox">
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

