import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * ClientSubSidebar
 *
 * Vertical-specific sidebar content for the Client Manager.
 * Contains nav links (Clients, Client Tasks, Category Manager)
 * and filters (by Category, Billing Model).
 */
const ClientSubSidebar = ({
  user,
  permissions,
  activeVertical,
  setActiveVertical,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
}) => {
  const canAccessAdmin = permissions?.canAccessConfig;

  const [expandedGroups, setExpandedGroups] = useState({
    category: false,
    billing_model: false,
  });

  const [filterOptions, setFilterOptions] = useState({
    categories: [],
    billingModels: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: cats }, { data: models }] = await Promise.all([
        supabase.from('client_categories').select('id, name, code').order('name'),
        supabase.from('client_billing_models').select('id, name, code').order('name'),
      ]);
      setFilterOptions({
        categories: cats || [],
        billingModels: models || [],
      });
    };
    fetchOptions();
  }, []);

  const toggleGroup = (key) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Shared styles (mirrors EmployeeSubSidebar) ────────────────────────────
  const filterSectionStyle = {
    borderBottom: '1px solid var(--border-color)',
    transition: 'all 0.3s ease',
  };
  const groupHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    cursor: 'pointer',
    userSelect: 'none',
  };
  const groupLabelStyle = {
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'var(--brand-green)',
    letterSpacing: '0.5px',
  };
  const checkboxGroupStyle = (isExpanded) => ({
    display: isExpanded ? 'flex' : 'none',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '180px',
    overflowY: 'auto',
    padding: '0 12px 16px 12px',
    transition: 'opacity 0.2s ease',
  });
  const checkboxItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--text-color)',
    padding: '4px 0',
    opacity: 0.8,
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
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
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
              onClick={(e) => { e.stopPropagation(); onBatchFilter(filterKey, options.map(opt => valueKey ? opt[valueKey] : opt)); }}
              style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--brand-green)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.8 }}
            >
              SELECT ALL
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onBatchFilter(filterKey, []); }}
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
      {/* Nav Quick Links */}
      {canAccessAdmin && (
        <div style={{ padding: '12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'client_tasks' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('client_tasks')}
          >
            Client Tasks
          </button>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'leads_funnel' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('leads_funnel')}
          >
            Leads Funnel
          </button>
          <button
            className="halo-button"
            style={{ width: '100%', opacity: activeVertical === 'client_category_management' ? 1 : 0.7 }}
            onClick={() => setActiveVertical('client_category_management')}
          >
            Category Manager
          </button>
        </div>
      )}

      {/* Filters Header */}
      <div style={{ padding: '16px 12px 8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveVertical('CLIENTS')}
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: '1rem',
            color: activeVertical === 'CLIENTS' ? 'var(--brand-green)' : 'var(--text-color)',
            letterSpacing: '0.5px',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            opacity: activeVertical === 'CLIENTS' ? 1 : 0.7,
            transition: 'all 0.2s ease'
          }}
          className="sidebar-header-nav-btn"
        >
          Clients
        </button>
        <button
          onClick={onReset}
          style={{ background: 'none', border: 'none', color: 'var(--brand-green)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', padding: '4px' }}
        >
          RESET
        </button>
      </div>

      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, opacity: 0.5, textTransform: 'uppercase' }}>Filter Records</p>
      </div>

      <FilterGroup
        label="Category"
        options={filterOptions.categories}
        currentFilters={filters?.category || []}
        filterKey="category"
        displayKey="code"
        valueKey="id"
      />

      <FilterGroup
        label="Billing Model"
        options={filterOptions.billingModels}
        currentFilters={filters?.billing_model || []}
        filterKey="billing_model"
        displayKey="code"
        valueKey="id"
      />

      <div className="sub-nav-item" style={{ marginTop: '24px', opacity: 0.4 }}>
        <div className="sub-nav-text">
          <p>Client Manager</p>
          <small>Records Active</small>
        </div>
      </div>
    </div>
  );
};

export default ClientSubSidebar;
