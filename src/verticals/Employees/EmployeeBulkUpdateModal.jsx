import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './EmployeeForm.css';

/**
 * BulkUpdateModal
 * 
 * Allows users to select fields and values for bulk updating multiple employees.
 */
const EmployeeBulkUpdateModal = ({ selectedCount, onUpdate, loading }) => {
  const [hubs, setHubs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [activeFields, setActiveFields] = useState({
    hub_id: false,
    role_id: false,
    department_id: false,
    manager_id: false
  });

  const [values, setValues] = useState({
    hub_id: '',
    role_id: '',
    department_id: '',
    manager_id: ''
  });

  useEffect(() => {
    const fetchLookupData = async () => {
      const [hubsRes, deptRes, roleRes, empRes] = await Promise.all([
        supabase.from('hubs').select('id, hub_code').order('hub_code'),
        supabase.from('departments').select('id, name, dept_code').order('name'),
        supabase.from('employee_roles').select('id, name, role_code').order('name'),
        supabase.from('employees').select('id, full_name').eq('status', 'Active').order('full_name')
      ]);
      
      if (hubsRes.data) setHubs(hubsRes.data);
      if (deptRes.data) setDepartments(deptRes.data);
      if (roleRes.data) setRoles(roleRes.data);
      if (empRes.data) setEmployees(empRes.data);
    };
    fetchLookupData();
  }, []);

  const handleFieldToggle = (field) => {
    setActiveFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleValueChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updates = {};
    Object.keys(activeFields).forEach(field => {
      if (activeFields[field]) {
        updates[field] = values[field] === 'NULL' ? null : (values[field] || null);
      }
    });

    if (Object.keys(updates).length === 0) {
      alert('Please select at least one field to update.');
      return;
    }

    onUpdate(updates);
  };

  return (
    <form className="bulk-update-form" onSubmit={handleSubmit} style={{ padding: '1rem' }}>
      <p style={{ margin: '0 0 1.5rem 0', opacity: 0.7, fontSize: '0.9rem' }}>
        You are updating <strong>{selectedCount}</strong> employees. Select the fields you wish to modify:
      </p>

      <div className="form-grid" style={{ gap: '1.5rem' }}>
        {/* Hub */}
        <div className="bulk-field-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <input 
            type="checkbox" 
            checked={activeFields.hub_id} 
            onChange={() => handleFieldToggle('hub_id')}
            style={{ marginTop: '30px' }}
          />
          <div className="form-group" style={{ flex: 1, opacity: activeFields.hub_id ? 1 : 0.4 }}>
            <label>Primary Hub</label>
            <select 
              value={values.hub_id} 
              onChange={(e) => handleValueChange('hub_id', e.target.value)}
              disabled={!activeFields.hub_id}
            >
              <option value="">No Change</option>
              <option value="NULL">NONE (ALL)</option>
              {hubs.map(h => <option key={h.id} value={h.id}>{h.hub_code}</option>)}
            </select>
          </div>
        </div>

        {/* Role */}
        <div className="bulk-field-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <input 
            type="checkbox" 
            checked={activeFields.role_id} 
            onChange={() => handleFieldToggle('role_id')}
            style={{ marginTop: '30px' }}
          />
          <div className="form-group" style={{ flex: 1, opacity: activeFields.role_id ? 1 : 0.4 }}>
            <label>Role</label>
            <select 
              value={values.role_id} 
              onChange={(e) => handleValueChange('role_id', e.target.value)}
              disabled={!activeFields.role_id}
            >
              <option value="">No Change</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_code ? `[${r.role_code}] ` : ''}{r.name}</option>)}
            </select>
          </div>
        </div>

        {/* Department */}
        <div className="bulk-field-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <input 
            type="checkbox" 
            checked={activeFields.department_id} 
            onChange={() => handleFieldToggle('department_id')}
            style={{ marginTop: '30px' }}
          />
          <div className="form-group" style={{ flex: 1, opacity: activeFields.department_id ? 1 : 0.4 }}>
            <label>Department</label>
            <select 
              value={values.department_id} 
              onChange={(e) => handleValueChange('department_id', e.target.value)}
              disabled={!activeFields.department_id}
            >
              <option value="">No Change</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.dept_code ? `[${d.dept_code}] ` : ''}{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* Manager */}
        <div className="bulk-field-row" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <input 
            type="checkbox" 
            checked={activeFields.manager_id} 
            onChange={() => handleFieldToggle('manager_id')}
            style={{ marginTop: '30px' }}
          />
          <div className="form-group" style={{ flex: 1, opacity: activeFields.manager_id ? 1 : 0.4 }}>
            <label>Reporting Manager</label>
            <select 
              value={values.manager_id} 
              onChange={(e) => handleValueChange('manager_id', e.target.value)}
              disabled={!activeFields.manager_id}
            >
              <option value="">No Change</option>
              <option value="NULL">NONE (Clear Manager)</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="form-footer" style={{ marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
        <button type="submit" className="halo-button save-btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Processing Bulk Update...' : `Apply Changes to ${selectedCount} Employees`}
        </button>
      </div>
    </form>
  );
};

export default EmployeeBulkUpdateModal;
