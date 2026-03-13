import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * HubSubSidebar
 * 
 * Vertical-specific sidebar content for Charging Hubs.
 * Contains the Master Admin administrative shortcut and task filters.
 */
const HubSubSidebar = ({ user, setActiveVertical, onFilterChange, filters, tasks }) => {
  const isMasterAdmin = user?.roleId === 'master_admin';
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      // FIX: Use 'hubs' table, not 'charging_hubs'
      const { data: hubData } = await supabase.from('hubs').select('id, hub_code');
      const { data: funcData } = await supabase.from('hub_functions').select('id, function_code');
      if (hubData) setHubs(hubData);
      if (funcData) setFunctions(funcData);
    };
    fetchData();
  }, []);

  // Extract unique cities from tasks
  const cities = [...new Set((tasks || []).map(t => t.city).filter(Boolean))].sort();
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const filterSectionStyle = {
    padding: '16px 12px',
    borderBottom: '1px solid var(--border-color)'
  };

  const sectionLabelStyle = {
    fontSize: '0.75rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--brand-green)',
    letterSpacing: '0.5px',
    marginBottom: '12px',
    display: 'block',
    opacity: 0.8
  };

  const checkboxGroupStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '180px',
    overflowY: 'auto',
    paddingRight: '4px'
  };

  const checkboxItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--text-color)',
    padding: '4px 0',
    transition: 'opacity 0.2s ease',
    userSelect: 'none'
  };

  const checkMarkStyle = (isSelected) => ({
    width: '16px',
    height: '16px',
    borderRadius: '4px',
    border: '2px solid var(--border-color)',
    backgroundColor: isSelected ? 'var(--brand-green)' : 'transparent',
    borderColor: isSelected ? 'var(--brand-green)' : 'var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: 'white',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  });

  const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey }) => (
    <div style={filterSectionStyle}>
      <label style={sectionLabelStyle}>{label}</label>
      <div style={checkboxGroupStyle} className="custom-scrollbar">
        {options.map(opt => {
          const val = valueKey ? opt[valueKey] : opt;
          const labelText = displayKey ? opt[displayKey] : opt;
          const isSelected = currentFilters.includes(val);
          return (
            <div 
              key={val} 
              style={{ ...checkboxItemStyle, opacity: isSelected ? 1 : 0.6 }}
              onClick={() => onFilterChange(filterKey, val)}
            >
              <div style={checkMarkStyle(isSelected)}>
                {isSelected && '✓'}
              </div>
              <span style={{ fontWeight: isSelected ? 700 : 500 }}>{labelText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="sub-sidebar-body">
      {isMasterAdmin && (
        <div style={{ padding: '12px', marginBottom: '8px' }}>
          <button 
            className="halo-button" 
            style={{ width: '100%' }}
            onClick={() => setActiveVertical('hub_function_management')}
          >
            Function Manager
          </button>
        </div>
      )}

      <div style={{ padding: '4px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: 'var(--text-color)' }}>FILTERS</p>
        <button 
          onClick={() => {
            ['city', 'hub', 'priority', 'function'].forEach(key => {
              if (filters[key]?.length > 0) {
                filters[key].forEach(val => onFilterChange(key, val));
              }
            });
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--brand-green)', 
            fontSize: '0.7rem', 
            fontWeight: 800, 
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          CLEAR ALL
        </button>
      </div>

      <FilterGroup 
        label="City" 
        options={cities} 
        currentFilters={filters.city || []} 
        filterKey="city" 
      />

      <FilterGroup 
        label="Hub" 
        options={hubs} 
        currentFilters={filters.hub || []} 
        filterKey="hub" 
        displayKey="hub_code"
        valueKey="id"
      />

      <FilterGroup 
        label="Priority" 
        options={priorities} 
        currentFilters={filters.priority || []} 
        filterKey="priority" 
      />

      <FilterGroup 
        label="Function" 
        options={functions} 
        currentFilters={filters.function || []} 
        filterKey="function" 
        displayKey="function_code"
        valueKey="id"
      />

      <div className="sub-nav-item" style={{ marginTop: '24px', opacity: 0.4 }}>
        <div className="sub-nav-text">
          <p>Module Navigation</p>
          <small>Vertical Active</small>
        </div>
      </div>
    </div>
  );
};

export default HubSubSidebar;
