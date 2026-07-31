import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { IconChevronDown, IconChevronRightSingle } from '../../components/ui/Icons';

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

const checkboxGroupStyle = (isExpanded, isMobileMenu) => ({
  display: isExpanded ? 'flex' : 'none',
  flexDirection: 'column',
  gap: '8px',
  /* In mobile menu, the outer overlay scrolls — remove per-group maxHeight so filters flow naturally */
  maxHeight: isMobileMenu ? 'none' : '180px',
  overflowY: isMobileMenu ? 'visible' : 'auto',
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

const FilterGroup = ({ label, options, currentFilters, filterKey, displayKey, valueKey, isExpanded, onToggle, onBatchFilter, onFilterChange, isMobileMenu }) => {
  return (
    <div style={filterSectionStyle}>
      <div style={groupHeaderStyle} onClick={onToggle}>
        <span style={groupLabelStyle}>{label}</span>
        <span className="u-opacity-50">
          {isExpanded ? <IconChevronDown size={10} /> : <IconChevronRightSingle size={10} />}
        </span>
      </div>

      {isExpanded && (
        <div className="u-px-12 u-pb-8 u-flex-gap-12">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const allVals = options.map(opt => valueKey ? opt[valueKey] : opt);
              onBatchFilter(filterKey, allVals);
            }}
            className="text-action-button u-text-0-65rem u-fw-600 u-text-brand-green u-bg-transparent u-border-none u-p-0 u-cursor-pointer u-opacity-80"
          >
            SELECT ALL
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBatchFilter(filterKey, []);
            }}
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

const HubSubSidebar = ({ permissions, activeVertical, setActiveVertical, onFilterChange, onReset, onBatchFilter, filters, tasks, hideNavigation }) => {
  const [hubs, setHubs] = useState([]);
  const [functions, setFunctions] = useState([]);
  /* All filter groups start collapsed in the mobile menu (hideNavigation=true).
     The mobile overlay unmounts/remounts on each open/close, so this initial state
     effectively resets to collapsed every time the menu is opened. */
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
      {!hideNavigation && (
        <>
          {permissions?.canAccessHubTasks && (
            <div className="u-p-12 u-mb-8">
              <button
                className="halo-button u-w-full u-p-10-12"
                style={{ 
                  opacity: activeVertical === 'hub_tasks' ? 1 : 0.7,
                  border: activeVertical === 'hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'hub_tasks' ? 500 : 400,
                  transition: 'all 0.2s ease-in-out'
                }}
                onClick={() => setActiveVertical('hub_tasks')}
              >
                Hubs Task Board
              </button>
            </div>
          )}

          {permissions?.canAccessDailyHubTasks && (
            <div className="u-px-12 u-pb-12 u-mb-8">
              <button
                className="halo-button u-w-full u-p-10-12"
                style={{ 
                  opacity: activeVertical === 'daily_hub_tasks' ? 1 : 0.7,
                  border: activeVertical === 'daily_hub_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'daily_hub_tasks' ? 500 : 400,
                  transition: 'all 0.2s ease-in-out'
                }}
                onClick={() => setActiveVertical('daily_hub_tasks')}
              >
                Daily Task Board
              </button>
            </div>
          )}

          {permissions?.canAccessEscalationTasks && (
            <div className="u-px-12 u-pb-12 u-mb-8">
              <button
                id="btn-nav-escalation"
                className="halo-button u-w-full u-p-10-12"
                style={{ 
                  opacity: activeVertical === 'escalation_tasks' ? 1 : 0.7,
                  border: activeVertical === 'escalation_tasks' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'escalation_tasks' ? 500 : 400,
                  transition: 'all 0.2s ease-in-out'
                }}
                onClick={() => setActiveVertical('escalation_tasks')}
              >
                Escalation Task Board
              </button>
            </div>
          )}

          {permissions?.canAccessDailyTaskTemplates && (
            <div className="u-px-12 u-pb-12 u-mb-8">
              <button
                className="halo-button u-w-full u-p-10-12"
                style={{ 
                  opacity: activeVertical === 'daily_task_templates' ? 1 : 0.7,
                  border: activeVertical === 'daily_task_templates' ? '1px solid var(--brand-green)' : '1px solid var(--border-color)',
                  fontWeight: activeVertical === 'daily_task_templates' ? 500 : 400,
                  transition: 'all 0.2s ease-in-out'
                }}
                onClick={() => setActiveVertical('daily_task_templates')}
              >
                Daily Task Templates
              </button>
            </div>
          )}
        </>
      )}


    </div>
  );
};

export default HubSubSidebar;
