import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * EmployeeTaskForm
 * Vertical-specific form for Employee Manager tasks.
 * Basic fields for now — will be extended with employee-specific data in future prompts.
 */
const EmployeeTaskForm = ({ onSubmit, loading, initialData = {} }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    description: safeData.description || '',
    assigned_to: safeData.assigned_to || ''
  });
  const [employees, setEmployees] = useState([]);

  React.useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, full_name, emp_code')
      .eq('status', 'Active')
      .order('full_name');
    if (data) setEmployees(data);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form className="vertical-task-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Task Summary</label>
        <input
          type="text"
          value={formData.text}
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
          placeholder="e.g. Onboard new hire, Conduct performance review"
          required
        />
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Priority</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="form-group">
          <label>Assigned To</label>
          <select 
            value={formData.assigned_to}
            onChange={(e) => setFormData({...formData, assigned_to: e.target.value})}
          >
            <option value="">N/A (Unassigned)</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.emp_code ? `[${emp.emp_code}] ` : ''}{emp.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter task details..."
          rows={4}
        />
      </div>

      <div className="form-footer">
        <button type="submit" className="halo-button save-btn" disabled={loading}>
          {loading ? 'Saving...' : (safeData.id ? 'Update Task' : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default EmployeeTaskForm;
