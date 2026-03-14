import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * HubSubSidebar
 * 
 * Vertical-specific sidebar content for Charging Hubs.
 * Contains the Master Admin administrative shortcut and task filters.
 */
const HubSubSidebar = ({ user, setActiveVertical, onFilterChange, onReset, onBatchFilter, filters, tasks }) => {
  const isMasterAdmin = user?.roleId === 'master_admin';
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({
    city: true,
    hub: false,
    priority: false,
    function: false
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: hubData } = await supabase.from('hubs').select('id, hub_code');
      const { data: funcData } = await supabase.from('hub_functions').select('id, function_code');
      if (hubData) setHubs(hubData);
      if (funcData) setFunctions(funcData);
    };
    fetchData();
  }, []);

  const cities = [...new Set((tasks || []).map(t => t.city).filter(Boolean))].sort();
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = (key, options, valueKey) => {
    options.forEach(opt => {
      const val = valueKey ? opt[valueKey] : opt;
      if (!filters[key]?.includes(val)) {
        onFilterChange(key, val);
      }
    });
  };

  const filterSectionStyle = {
    borderBottom: '1px solid var(--border-color)',
    transition: 'all 0.3s ease'
  };

  const groupHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    cursor: 'pointer',
    userSelect: 'none'
  };

  const groupLabelStyle = {
    fontSize: '0.75rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    color: 'var(--brand-green)',
    letterSpacing: '0.5px'
  };

  const checkboxGroupStyle = (isExpanded) => ({
    display: isExpanded ? 'flex' : 'none',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '0 12px 16px 12px',
    transition: 'opacity 0.2s ease'
  });

  const checkboxItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--text-color)',
    padding: '4px 0',
    opacity: 0.8
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

  const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey }) => {
    const isExpanded = expandedGroups[filterKey];
    return (
      <div style={filterSectionStyle}>
        <div style={groupHeaderStyle} onClick={() => toggleGroup(filterKey)}>
          <span style={groupLabelStyle}>{label}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
        
        {isExpanded && (
          <div style={{ padding: '0 12px 8px 12px', display: 'flex', gap: '12px' }}>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                const allVals = options.map(opt => valueKey ? opt[valueKey] : opt);
                onBatchFilter(filterKey, allVals); 
              }}
              className="text-action-button"
              style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--brand-green)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
            >
              SELECT ALL
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                onBatchFilter(filterKey, []); 
              }}
              className="text-action-button"
              style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
            >
              CLEAR
            </button>
          </div>
        )}

        <div style={checkboxGroupStyle(isExpanded)} className="custom-scrollbar">
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
  };

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

      <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <p style={{ margin: 0, fontWeight: 900, fontSize: '0.9rem', color: 'var(--text-color)' }}>FILTERS</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => onFilterChange('duplicatesOnly', !filters.duplicatesOnly)}
            style={{ 
              background: filters.duplicatesOnly ? 'var(--brand-green)' : 'rgba(255,255,255,0.05)', 
              border: 'none', 
              color: filters.duplicatesOnly ? 'black' : 'var(--brand-green)', 
              fontSize: '0.6rem', 
              fontWeight: 900, 
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: '10px',
              transition: 'all 0.2s'
            }}
          >
            DUP ONLY
          </button>
          <button 
            onClick={onReset}
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
            RESET
          </button>
        </div>
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
