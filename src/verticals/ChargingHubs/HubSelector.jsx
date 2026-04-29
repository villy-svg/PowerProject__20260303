import React from 'react';
import BaseDropdown from '../../components/BaseDropdown';
import './HubSelector.css';
import '../../styles/DropdownSystem.css';

const HubSelector = ({
  hubs = [],
  value = [],
  onChange,
  id = '',
  disabled = false,
  placeholder = 'Select Hubs...',
}) => {
  const options = hubs
    .filter(hub => hub.name !== 'MULTI')
    .map(hub => ({
      label: hub.hub_code || hub.name,
      value: hub.id,
      sublabel: hub.name,
    }));

  const getLabel = (selectedValues, options) => {
    if (selectedValues.length === 0) return 'N/A (No Hub)';

    const firstOpt = options.find(o => o.value === selectedValues[0]);
    if (!firstOpt) return `Selected (${selectedValues.length})`;

    const primaryLabel = firstOpt.label;

    if (selectedValues.length === 1) return primaryLabel;
    return `${primaryLabel} + ${selectedValues.length - 1}`;
  };

  const renderItem = (opt, isSelected) => (
    <>
      <div className="custom-dropdown-checkbox">
        {isSelected && '✓'}
      </div>
      <div className="hub-info">
        <span className="hub-code">{opt.label}</span>
      </div>
    </>
  );

  return (
    <BaseDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      mode="multi"
      placeholder={placeholder}
      disabled={disabled}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label', 'sublabel']}
      getLabel={getLabel}
      renderItem={renderItem}
      showCheckbox={true}
      displayMode="compact"
    />
  );
};

export default HubSelector;
