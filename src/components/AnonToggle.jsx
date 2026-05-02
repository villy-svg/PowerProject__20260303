import React from 'react';
import './AnonToggle.css';

/**
 * AnonToggle Component
 * Standardized switch component for boolean inputs.
 * Reuses the design tokens from the PowerProject UI System.
 */
const AnonToggle = ({ 
  id, 
  label, 
  checked, 
  onChange, 
  disabled = false,
  description = "" 
}) => {
  return (
    <div className="anon-toggle-wrapper">
      <div className="anon-toggle-header">
        {label && <label htmlFor={id} className="anon-toggle-label">{label}</label>}
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
      {description && <small className="anon-toggle-description">{description}</small>}
    </div>
  );
};

export default AnonToggle;
