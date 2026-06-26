import React from 'react';
import BaseDropdown from './BaseDropdown';

/**
 * CustomSelect
 * Single-select dropdown. Thin wrapper around BaseDropdown.
 * Preserves the original API surface — no consumer changes needed.
 */
const CustomSelect = ({
  id,
  className = '',
  style = {},
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  disabled = false,
  required = false,
  fullWidthDropdown = false,
}) => (
  <BaseDropdown
    id={id}
    className={className}
    style={style}
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    fullWidthDropdown={fullWidthDropdown}
    mode="single"
    searchable={true}
    fuzzySearch={true}
    searchKeys={['label']}
    showCheckbox={true}
    displayMode="compact"
  />
);

export default CustomSelect;
