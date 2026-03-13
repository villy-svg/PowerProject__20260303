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
      const { data: hubData } = await supabase.from('charging_hubs').select('id, hub_code');
      const { data: funcData } = await supabase.from('hub_functions').select('id, function_code');
      if (hubData) setHubs(hubData);
      if (funcData) setFunctions(funcData);
    };
    fetchData();
  }, []);

  // Extract unique cities from tasks
  const cities = [...new Set((tasks || []).map(t => t.city).filter(Boolean))].sort();
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  const filterStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderBottom: '1px solid var(--border-color)'
  };

  const selectStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: 'var(--bg-color)',
    color: 'var(--text-color)',
    border: '1px solid var(--border-color)',
    fontSize: '0.85rem'
  };

  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: '2px',
    display: 'block'
  };

  return (
    <div className="sub-sidebar-body">
      {isMasterAdmin && (
        <div className="sub-sidebar-actions" style={{ padding: '0 12px', marginBottom: '12px' }}>
          <button 
            className="halo-button" 
            style={{ width: '100%', marginTop: '12px' }}
            onClick={() => setActiveVertical('hub_function_management')}
          >
            Function Manager
          </button>
        </div>
      )}

      <div className="sub-nav-header" style={{ padding: '12px 12px 4px 12px' }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem' }}>Task Filters</p>
      </div>

      {/* Filter: City */}
      <div style={filterStyle}>
        <label style={labelStyle}>City</label>
        <select 
          style={selectStyle} 
          value={filters.city} 
          onChange={(e) => onFilterChange('city', e.target.value)}
        >
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Filter: Hub */}
      <div style={filterStyle}>
        <label style={labelStyle}>Hub</label>
        <select 
          style={selectStyle} 
          value={filters.hub} 
          onChange={(e) => onFilterChange('hub', e.target.value)}
        >
          <option value="">All Hubs</option>
          {hubs.map(h => <option key={h.id} value={h.id}>{h.hub_code}</option>)}
        </select>
      </div>

      {/* Filter: Priority */}
      <div style={filterStyle}>
        <label style={labelStyle}>Priority</label>
        <select 
          style={selectStyle} 
          value={filters.priority} 
          onChange={(e) => onFilterChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          {priorities.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Filter: Function */}
      <div style={filterStyle}>
        <label style={labelStyle}>Function</label>
        <select 
          style={selectStyle} 
          value={filters.function} 
          onChange={(e) => onFilterChange('function', e.target.value)}
        >
          <option value="">All Functions</option>
          {functions.map(f => <option key={f.id} value={f.id}>{f.function_code}</option>)}
        </select>
      </div>

      <div className="sub-nav-item" style={{ marginTop: 'auto' }}>
        <div className="sub-nav-text">
          <p>Module Navigation</p>
          <small>Vertical Active</small>
        </div>
      </div>
    </div>
  );
};

export default HubSubSidebar;
