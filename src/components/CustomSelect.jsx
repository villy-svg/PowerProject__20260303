import React, { useState, useRef, useEffect } from 'react';
import '../styles/DropdownSystem.css';

/**
 * CustomSelect
 * A premium, standardized single-select dropdown that matches the Assignee/Hub selector aesthetic.
 * Replaces native <select> for a consistent "Premium Midnight" experience.
 */
const CustomSelect = ({ 
  id, 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Select option...', 
  disabled = false,
  required = false,
  fullWidthDropdown = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);
  const label = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && fullWidthDropdown && containerRef.current && dropdownRef.current) {
      const modalContent = containerRef.current.closest('.modal-content-area') || containerRef.current.closest('.modal-content');
      if (modalContent) {
        const modalRect = modalContent.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        dropdownRef.current.style.width = `${modalRect.width - 64}px`;
        dropdownRef.current.style.left = `${modalRect.left - containerRect.left + 32}px`;
        dropdownRef.current.style.right = 'auto';
      }
    }
  }, [isOpen, fullWidthDropdown]);

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

  const filteredOptions = options.filter(opt => fuzzyMatch(opt.label, searchTerm));

  const handleSelect = (val) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-container ${isOpen ? 'open' : ''}`} ref={containerRef}>
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
          className={`custom-select-trigger ${disabled ? 'disabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen(true);
          }}
          aria-expanded={isOpen}
        >
          <span className="selected-label">{label}</span>
          <span className="dropdown-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </button>
      )}

      {isOpen && !disabled && (
        <>
          <div className="selector-backdrop" onClick={() => setIsOpen(false)} />
          <div className="custom-dropdown-menu fade-in" ref={dropdownRef}>
            {filteredOptions.length === 0 ? (
              <div className="no-options" style={{ padding: '15px', textAlign: 'center', opacity: 0.5 }}>No options available</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt.value}
                  className={`custom-dropdown-option ${value === opt.value ? 'selected' : ''} single`}
                  onClick={() => handleSelect(opt.value)}
                >
                  <div className="custom-dropdown-checkbox">
                    {value === opt.value && <div className="radio-dot" style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%' }} />}
                  </div>
                  <span className="custom-dropdown-text">{opt.label}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CustomSelect;

