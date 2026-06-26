import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import CustomSelect from '../../components/ui/CustomSelect';
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
        <div className="bulk-field-row">
          <div className="selection-area bulk-selection-container" onClick={() => handleFieldToggle('hub_id')}>
            <div className={`selection-checkbox ${activeFields.hub_id ? 'checked' : ''}`}>
              {activeFields.hub_id && '✓'}
            </div>
          </div>
          <div className={`form-group bulk-form-group ${!activeFields.hub_id ? 'disabled' : ''}`}>
            <label>Primary Hub</label>
            <CustomSelect 
              className="master-dropdown"
              value={values.hub_id} 
              onChange={(val) => handleValueChange('hub_id', val)}
              disabled={!activeFields.hub_id}
              options={[
                { value: '', label: 'No Change' },
                { value: 'NULL', label: 'NONE (ALL)' },
                ...hubs.map(h => ({ value: h.id, label: h.hub_code }))
              ]}
            />
          </div>
        </div>

        {/* Role */}
        <div className="bulk-field-row">
          <div className="selection-area bulk-selection-container" onClick={() => handleFieldToggle('role_id')}>
            <div className={`selection-checkbox ${activeFields.role_id ? 'checked' : ''}`}>
              {activeFields.role_id && '✓'}
            </div>
          </div>
          <div className={`form-group bulk-form-group ${!activeFields.role_id ? 'disabled' : ''}`}>
            <label>Role</label>
            <CustomSelect 
              className="master-dropdown"
              value={values.role_id} 
              onChange={(val) => handleValueChange('role_id', val)}
              disabled={!activeFields.role_id}
              options={[
                { value: '', label: 'No Change' },
                ...roles.map(r => ({ value: r.id, label: `${r.role_code ? `[${r.role_code}] ` : ''}${r.name}` }))
              ]}
            />
          </div>
        </div>

        {/* Department */}
        <div className="bulk-field-row">
          <div className="selection-area bulk-selection-container" onClick={() => handleFieldToggle('department_id')}>
            <div className={`selection-checkbox ${activeFields.department_id ? 'checked' : ''}`}>
              {activeFields.department_id && '✓'}
            </div>
          </div>
          <div className={`form-group bulk-form-group ${!activeFields.department_id ? 'disabled' : ''}`}>
            <label>Department</label>
            <CustomSelect 
              className="master-dropdown"
              value={values.department_id} 
              onChange={(val) => handleValueChange('department_id', val)}
              disabled={!activeFields.department_id}
              options={[
                { value: '', label: 'No Change' },
                ...departments.map(d => ({ value: d.id, label: `${d.dept_code ? `[${d.dept_code}] ` : ''}${d.name}` }))
              ]}
            />
          </div>
        </div>

        {/* Manager */}
        <div className="bulk-field-row">
          <div className="selection-area bulk-selection-container" onClick={() => handleFieldToggle('manager_id')}>
            <div className={`selection-checkbox ${activeFields.manager_id ? 'checked' : ''}`}>
              {activeFields.manager_id && '✓'}
            </div>
          </div>
          <div className={`form-group bulk-form-group ${!activeFields.manager_id ? 'disabled' : ''}`}>
            <label>Reporting Manager</label>
            <CustomSelect 
              className="master-dropdown"
              value={values.manager_id} 
              onChange={(val) => handleValueChange('manager_id', val)}
              disabled={!activeFields.manager_id}
              options={[
                { value: '', label: 'No Change' },
                { value: 'NULL', label: 'NONE (Clear Manager)' },
                ...employees.map(e => ({ value: e.id, label: e.full_name }))
              ]}
            />
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
