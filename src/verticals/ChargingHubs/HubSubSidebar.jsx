import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';

/**
 * HubSubSidebar
 * 
 * Vertical-specific sidebar content for Charging Hubs.
 * Contains the Master Admin administrative shortcut and task filters.
 */
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
  fontWeight: 600,
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

const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey, isExpanded, onToggle, onBatchFilter, onFilterChange }) => {
  return (
    <div style={filterSectionStyle}>
      <div style={groupHeaderStyle} onClick={onToggle}>
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
            style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--brand-green)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
          >
            SELECT ALL
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBatchFilter(filterKey, []);
            }}
            className="text-action-button"
            style={{ fontSize: '0.65rem', fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
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
              <span style={{ fontWeight: isSelected ? 600 : 400 }}>{labelText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HubSubSidebar = ({ permissions, activeVertical, setActiveVertical, onFilterChange, onReset, onBatchFilter, filters, tasks }) => {
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState({
    city: false,
    hub: false,
    priority: false,
    function: false,
    assignee: false
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: hubData } = await supabase.from('hubs').select('id, hub_code');
      const { data: funcData } = await supabase.from('hub_functions').select('id, function_code, name');
      if (hubData) setHubs(hubData);
      if (funcData) setFunctions(funcData);
    };
    fetchData();
  }, []);

  const cities = [...new Set((tasks || []).map(t => t.city).filter(Boolean))].sort();
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const [showFilters, setShowFilters] = useState(true);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sub-sidebar-body">
      {permissions?.canAccessHubTasks && (
        <div style={{ padding: '12px', marginBottom: '8px' }}>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'hub_tasks' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('hub_tasks')}
          >
            Hubs Task Board
          </button>
        </div>
      )}

      {permissions?.canAccessDailyHubTasks && (
        <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('daily_hub_tasks')}
          >
            Daily Task Board
          </button>
        </div>
      )}

      {permissions?.canAccessDailyTaskTemplates && (
        <div style={{ padding: '0 12px 12px 12px', marginBottom: '8px' }}>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'daily_task_templates' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('daily_task_templates')}
          >
            Daily Task Templates
          </button>
        </div>
      )}

      <div 
        className="filters-row-toggle" 
        onClick={() => setShowFilters(!showFilters)}
      >
        <p>FILTERS {showFilters ? '▲' : '▼'}</p>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onFilterChange('duplicatesOnly', !filters.duplicatesOnly); }}
            className={`filters-action-btn ${filters.duplicatesOnly ? 'active' : ''}`}
          >
            DUP ONLY
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReset(); }}
            className="filters-action-btn"
          >
            RESET
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-content">
          <FilterGroup
            label="City"
            options={cities}
            currentFilters={filters.city || []}
            filterKey="city"
            isExpanded={expandedGroups.city}
            onToggle={() => toggleGroup('city')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
          />

          <FilterGroup
            label="Hub"
            options={hubs}
            currentFilters={filters.hub || []}
            filterKey="hub"
            displayKey="hub_code"
            valueKey="id"
            isExpanded={expandedGroups.hub}
            onToggle={() => toggleGroup('hub')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
          />

          <FilterGroup
            label="Priority"
            options={priorities}
            currentFilters={filters.priority || []}
            filterKey="priority"
            isExpanded={expandedGroups.priority}
            onToggle={() => toggleGroup('priority')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
          />

          <FilterGroup
            label="Function"
            options={functions}
            currentFilters={filters.function || []}
            filterKey="function"
            displayKey="function_code"
            valueKey="name"
            isExpanded={expandedGroups.function}
            onToggle={() => toggleGroup('function')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
          />

          <FilterGroup
            label="Assignee"
            options={[...new Set((tasks || []).map(t => t.assigneeName || 'Unassigned'))].sort()}
            currentFilters={filters.assignee || []}
            filterKey="assignee"
            isExpanded={expandedGroups.assignee}
            onToggle={() => toggleGroup('assignee')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
          />
        </div>
      )}

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
