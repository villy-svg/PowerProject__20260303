import React, { useState, useEffect } from 'react';
import { clientService } from '../../services/clients/clientService';
import { IconChevronDown, IconChevronRightSingle } from '../../components/ui/Icons';

/**
 * ClientSubSidebar
 *
 * Vertical-specific sidebar content for the Client Manager.
 * Contains nav links (Clients, Client Tasks, Category Manager)
 * and filters (by Category, Billing Model).
 */
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
const checkboxGroupStyle = (isExpanded, isMobileMenu) => ({
  display: isExpanded ? 'flex' : 'none',
  flexDirection: 'column',
  gap: '8px',
  /* In mobile menu, the outer overlay scrolls — remove per-group maxHeight so filters flow naturally */
  maxHeight: isMobileMenu ? 'none' : '180px',
  overflowY: isMobileMenu ? 'visible' : 'auto',
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

const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey, isExpanded, onToggle, onBatchFilter, onFilterChange, isMobileMenu }) => {
  return (
    <div style={filterSectionStyle}>
      <div style={groupHeaderStyle} onClick={onToggle}>
        <span style={groupLabelStyle}>{label}</span>
        <span className="u-opacity-50">{isExpanded ? <IconChevronDown size={10} /> : <IconChevronRightSingle size={10} />}</span>
      </div>

      {isExpanded && (
        <div className="u-px-12 u-pb-8 u-flex-gap-12">
          <button
            onClick={(e) => { e.stopPropagation(); onBatchFilter(filterKey, options.map(opt => valueKey ? opt[valueKey] : opt)); }}
            className="text-action-button u-text-0-65rem u-fw-600 u-text-brand-green u-bg-transparent u-border-none u-p-0 u-cursor-pointer u-opacity-80"
          >
            SELECT ALL
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onBatchFilter(filterKey, []); }}
            className="text-action-button u-text-0-65rem u-fw-600 u-text-danger u-bg-transparent u-border-none u-p-0 u-cursor-pointer u-opacity-80"
          >
            CLEAR
          </button>
        </div>
      )}

      <div style={checkboxGroupStyle(isExpanded, isMobileMenu)} className="custom-scrollbar">
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

const ClientSubSidebar = ({
  permissions,
  activeVertical,
  setActiveVertical,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  hideNavigation,
}) => {
  /* All filter groups start collapsed in the mobile menu (hideNavigation=true).
     The mobile overlay unmounts/remounts on each open/close, so this initial state
     effectively resets to collapsed every time the menu is opened. */
  const [expandedGroups, setExpandedGroups] = useState({
    vehicle: false,
    service: false,
    billing_model: false,
  });

  const [filterOptions, setFilterOptions] = useState({
    vehicleCategories: [],
    serviceCategories: [],
    billingModels: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const result = await clientService.getAllReferenceData();

        setFilterOptions({
          vehicleCategories: result.categories,
          serviceCategories: result.services,
          billingModels: result.billingModels,
        });
      } catch (err) {
        console.error('ClientSubSidebar: Fetch error:', err);
      }
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
          <div className="u-p-12 u-mb-8 u-flex-col-gap-8">
          {permissions?.canAccessClientTasks && (
            <button
              className="halo-button u-w-full"
              style={{ opacity: activeVertical === 'client_tasks' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('client_tasks')}
            >
              Client Task Board
            </button>
          )}
          {permissions?.canAccessLeadsFunnel && (
            <button
              className="halo-button u-w-full"
              style={{ opacity: activeVertical === 'leads_funnel' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('leads_funnel')}
            >
              Leads Funnel
            </button>
          )}
          </div>

          {/* Nav Toggle Header */}
          <div className="u-px-12 u-pt-16 u-pb-8 u-flex-between u-items-center u-border-b u-mb-12">
            {permissions?.canAccessClients ? (
              <button
                onClick={() => setActiveVertical('CLIENTS')}
                style={{
                  color: activeVertical === 'CLIENTS' ? 'var(--brand-green)' : 'var(--text-color)',
                  opacity: activeVertical === 'CLIENTS' ? 1 : 0.7,
                  transition: 'all 0.2s ease'
                }}
                className="sidebar-header-nav-btn u-m-0 u-fw-500 u-text-base u-bg-transparent u-border-none u-p-0 u-cursor-pointer"
              >
                Clients
              </button>
            ) : (
              <span className="u-fw-500 u-text-base u-text-primary u-opacity-50">Clients</span>
            )}
          </div>
        </>
      )}

      <div 
        className="filters-row-toggle" 
        onClick={() => setShowFilters(!showFilters)}
      >
        <p className="u-flex-center-gap-4">FILTERS {showFilters ? <IconChevronDown size={10} /> : <IconChevronRightSingle size={10} />}</p>
        <div className="u-flex-gap-4">
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
            label="Category"
            options={filterOptions.vehicleCategories}
            currentFilters={filters?.vehicle || []}
            filterKey="vehicle"
            displayKey="name"
            valueKey="id"
            isExpanded={expandedGroups.vehicle}
            onToggle={() => toggleGroup('vehicle')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />

          <FilterGroup
            label="Service Category"
            options={filterOptions.serviceCategories}
            currentFilters={filters?.service || []}
            filterKey="service"
            displayKey="name"
            valueKey="id"
            isExpanded={expandedGroups.service}
            onToggle={() => toggleGroup('service')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />

          <FilterGroup
            label="Billing Model"
            options={filterOptions.billingModels}
            currentFilters={filters?.billing_model || []}
            filterKey="billing_model"
            displayKey="name"
            valueKey="id"
            isExpanded={expandedGroups.billing_model}
            onToggle={() => toggleGroup('billing_model')}
            onBatchFilter={onBatchFilter}
            onFilterChange={onFilterChange}
            isMobileMenu={!!hideNavigation}
          />
        </div>
      )}

      {!hideNavigation && (
        <div className="sub-nav-item u-mt-24 u-opacity-50">
          <div className="sub-nav-text">
            <p>Client Manager</p>
            <small>Records Active</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSubSidebar;
