import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { IconChevronDown, IconChevronRightSingle } from '../../components/Icons';
import './EmployeeSubSidebar.css';

/**
 * EmployeeSubSidebar
 * 
 * Vertical-specific sidebar content for the Employee Manager.
 * Contains filters for employee records.
 */

const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey, isExpanded, onToggle, onBatchFilter, onFilterChange, isMobileMenu }) => {
  return (
    <div className="filter-section">
      <div className="filter-group-header" onClick={onToggle}>
        <span className="filter-group-label">{label}</span>
        <span className="opacity-50">{isExpanded ? <IconChevronDown size={10} /> : <IconChevronRightSingle size={10} />}</span>
      </div>

      {isExpanded && (
        <div className="filter-actions-row">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const allVals = options.map(opt => valueKey ? opt[valueKey] : opt);
              onBatchFilter(filterKey, allVals);
            }}
            className="filter-batch-btn select-all"
          >
            SELECT ALL
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBatchFilter(filterKey, []);
            }}
            className="filter-batch-btn clear"
          >
            CLEAR
          </button>
        </div>
      )}

      {/* isMobileMenu adds 'mobile-menu' class to remove the 180px per-group cap */}
      <div className={`filter-checkbox-group custom-scrollbar ${!isExpanded ? 'hidden' : ''} ${isMobileMenu ? 'mobile-menu' : ''}`}>
        {options.map(opt => {
          const val = valueKey ? opt[valueKey] : opt;
          const labelText = displayKey ? opt[displayKey] : opt;
          const isSelected = (currentFilters || []).includes(val);
          return (
            <div
              key={val}
              className="filter-checkbox-item"
              style={{ opacity: isSelected ? 1 : 0.6 }}
              onClick={() => onFilterChange(filterKey, val)}
            >
              <div className={`filter-check-mark ${isSelected ? 'selected' : ''}`}>
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

const EmployeeSubSidebar = ({ permissions, activeVertical, setActiveVertical, onFilterChange, onReset, onBatchFilter, filters, hideNavigation }) => {
  /* All filter groups start collapsed in the mobile menu (hideNavigation=true).
     The mobile overlay unmounts/remounts on each open/close, so this initial state
     effectively resets to collapsed every time the menu is opened. */
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

      const hubsList = hubs || [];
      // Explicitly add "NULL" as a selectable hub if any unassigned exist (or just always for filter ease)
      if (!hubsList.some(h => h.id === null)) {
        hubsList.unshift({ id: null, hub_code: 'NULL' });
      }

      setFilterOptions({
        hubs: hubsList,
        roles: roles || [],
        departments: depts || [],
      });
    };
    fetchOptions();
  }, []);

  const [showFilters, setShowFilters] = useState(true);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sub-sidebar-body">
      {!hideNavigation && (
        <>
          {permissions?.canAccessEmployeeTasks && (
            <div className="employee-tasks-btn-wrapper">
              <button
                className="halo-button employee-tasks-nav-btn"
                style={{ opacity: activeVertical === 'employee_tasks' ? 1 : 0.7 }}
                onClick={() => setActiveVertical('employee_tasks')}
              >
                Remarks Manager
              </button>
            </div>
          )}

          {/* Rules & Regulations Board button */}
          <div className="employee-tasks-btn-wrapper">
            <button
              className="halo-button employee-tasks-nav-btn"
              style={{ opacity: activeVertical === 'employee_rules_board' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('employee_rules_board')}
            >
              Rules & Regulations
            </button>
          </div>

          {/* Attendance Board button */}
          <div className="employee-tasks-btn-wrapper">
            <button
              className="halo-button employee-tasks-nav-btn"
              style={{ opacity: activeVertical === 'employee_attendance_board' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('employee_attendance_board')}
            >
              Attendance Board
            </button>
          </div>

          {/* Employee Self-Service button — for employees to log their own shifts */}
          <div className="employee-tasks-btn-wrapper">
            <button
              className="halo-button employee-tasks-nav-btn"
              style={{ opacity: activeVertical === 'attendance_self_service' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('attendance_self_service')}
            >
              My Attendance
            </button>
          </div>

          {/* Nav Toggle Header */}
          <div className="sidebar-title-row">
            {permissions?.canAccessEmployees ? (
               <p className="sidebar-title-text">Employees</p>
            ) : (
               <p className="sidebar-title-text disabled">Employees</p>
            )}
          </div>
        </>
      )}

      <div 
        className="filters-row-toggle" 
        onClick={() => setShowFilters(!showFilters)}
      >
        <p>FILTERS {showFilters ? <IconChevronDown size={10} /> : <IconChevronRightSingle size={10} />}</p>
        <div className="filters-reset-wrapper">
          <button
            onClick={(e) => { e.stopPropagation(); onFilterChange('highRemarksOnly', !filters.highRemarksOnly); }}
            className={`filters-action-btn ${filters.highRemarksOnly ? 'active' : ''}`}
            title="High Remarks Only"
          >
            HIGH
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
            label="Employee Role"
            options={filterOptions.roles}
            currentFilters={filters.role}
            filterKey="role"
            displayKey="role_code"
            valueKey="role_code"
            isExpanded={expandedGroups.role}
            onToggle={() => toggleGroup('role')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />

          <FilterGroup
            label="Primary Hub"
            options={filterOptions.hubs}
            currentFilters={filters.hub}
            filterKey="hub"
            displayKey="hub_code"
            valueKey="id"
            isExpanded={expandedGroups.hub}
            onToggle={() => toggleGroup('hub')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />

          <FilterGroup
            label="Department"
            options={filterOptions.departments}
            currentFilters={filters.department}
            filterKey="department"
            displayKey="dept_code"
            valueKey="dept_code"
            isExpanded={expandedGroups.department}
            onToggle={() => toggleGroup('department')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />
        </div>
      )}

      {!hideNavigation && (
        <div className="sub-nav-item sidebar-footer-info">
          <div className="sub-nav-text">
            <p>Employee Manager</p>
            <small>Task Board Active</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeSubSidebar;
