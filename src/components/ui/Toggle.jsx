import React from 'react';
import './Toggle.css';

/**
 * Toggle Component
 * Standardized switch component for boolean inputs.
 * Reuses the design tokens from the PowerProject UI System.
 */
const Toggle = ({ 
  id, 
  label, 
  checked, 
  onChange, 
  disabled = false,
  description = "" 
}) => {
  return (
    <div className="toggle-wrapper">
      <div className="toggle-header">
        {label && <label htmlFor={id} className="toggle-label">{label}</label>}
        <label className="switch">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <span className="slider"></span>
        </label>
      </div>
      {description && <small className="toggle-description">{description}</small>}
    </div>
  );
};

export default Toggle;
