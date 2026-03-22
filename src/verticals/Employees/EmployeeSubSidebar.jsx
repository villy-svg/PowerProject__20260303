import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';

/**
 * EmployeeSubSidebar
 * 
 * Vertical-specific sidebar content for the Employee Manager.
 * Contains filters for employee records.
 */
const EmployeeSubSidebar = ({ user, permissions, activeVertical, setActiveVertical, onFilterChange, onReset, onBatchFilter, filters, tasks }) => {
  const canAccessAdmin = permissions?.canAccessConfig;

  const [expandedGroups, setExpandedGroups] = useState({
    role: false,
    hub: false,
    department: false,
  });

  const [filterOptions, setFilterOptions] = useState({
    hubs: [],
    roles: [],
    departments: []
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: hubs }, { data: roles }, { data: depts }] = await Promise.all([
        supabase.from('hubs').select('id, name, hub_code').order('name'),
        supabase.from('employee_roles').select('name, role_code').order('name'),
        supabase.from('departments').select('name, dept_code').order('name')
      ]);

      setFilterOptions({
        hubs: hubs || [],
        roles: roles || [],
        departments: depts || []
      });
    };
    fetchOptions();
  }, []);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
              style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--brand-green)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
            >
              SELECT ALL
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBatchFilter(filterKey, []);
              }}
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
            const isSelected = (currentFilters || []).includes(val);
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

  return (
    <div className="sub-sidebar-body">
      {permissions?.canAccessEmployeeTasks && (
        <div style={{ padding: '12px', marginBottom: '8px' }}>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'employee_tasks' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('employee_tasks')}
          >
            Employee Tasks
          </button>
        </div>
      )}

      {/* Filters Header */}
      <div style={{ padding: '16px 12px 8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        {permissions?.canAccessEmployees ? (
           <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-color)', letterSpacing: '0.5px' }}>Employees</p>
        ) : (
           <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--text-color)', opacity: 0.5, letterSpacing: '0.5px' }}>Employees</p>
        )}
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

      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Filter Records</p>
      </div>

      <FilterGroup
        label="Employee Role"
        options={filterOptions.roles}
        currentFilters={filters.role}
        filterKey="role"
        displayKey="role_code"
        valueKey="role_code"
      />

      <FilterGroup
        label="Primary Hub"
        options={filterOptions.hubs}
        currentFilters={filters.hub}
        filterKey="hub"
        displayKey="hub_code"
        valueKey="id"
      />

      <FilterGroup
        label="Department"
        options={filterOptions.departments}
        currentFilters={filters.department}
        filterKey="department"
        displayKey="dept_code"
        valueKey="dept_code"
      />

      <div className="sub-nav-item" style={{ marginTop: '24px', opacity: 0.4 }}>
        <div className="sub-nav-text">
          <p>Employee Manager</p>
          <small>Task Board Active</small>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSubSidebar;
