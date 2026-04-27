import React, { useState, useRef } from 'react';
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
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value);
  const label = selectedOption ? selectedOption.label : placeholder;

  const handleSelect = (val) => {
    if (disabled) return;
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-container ${isOpen ? 'open' : ''}`} ref={containerRef}>
      <button 
        type="button"
        id={id}
        className={`custom-select-trigger ${disabled ? 'disabled' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
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

      {isOpen && !disabled && (
        <>
          <div className="selector-backdrop" onClick={() => setIsOpen(false)} />
          <div className="custom-dropdown-menu fade-in">
            {options.length === 0 ? (
              <div className="no-options" style={{ padding: '15px', textAlign: 'center', opacity: 0.5 }}>No options available</div>
            ) : (
              options.map(opt => (
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
