import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import { taskUtils } from '../../utils/taskUtils';

/**
 * EmployeeTaskForm
 * Vertical-specific form for Employee Manager tasks.
 * Basic fields for now — will be extended with employee-specific data in future prompts.
 */
const EmployeeTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, currentUser = {}, permissions = {}, availableTasks = [] }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    description: safeData.description || '',
    assigned_to: Array.isArray(safeData.assigned_to) ? safeData.assigned_to : (safeData.assigned_to ? [safeData.assigned_to] : []),
    parentTask: safeData.parentTask || ''
  });

  // Check if form has changes
  const isDirty = initialData.id ? Object.keys(formData).some(key => {
    const initialVal = initialData[key] || '';
    const currentVal = formData[key] || '';
    return String(initialVal) !== String(currentVal);
  }) : true; // Always dirty for new records

  useEffect(() => {
    // Other ref data could go here
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // For employees, we'll check for "hiring" keywords in the text as a simple principle
    const isHiring = formData.text.toLowerCase().includes('hire') || formData.text.toLowerCase().includes('onboard');
    
    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      functionName: isHiring ? 'hiring' : ''
    });

    onSubmit({ ...formData, text: finalTaskText });
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
          disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
        />
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Priority</label>
          <select
            className="master-dropdown"
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="form-group">
          <label>Assigned To</label>
          <AssigneeSelector
            value={formData.assigned_to}
            onChange={(val) => setFormData({...formData, assigned_to: val})}
            currentUser={currentUser}
            disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
          />
        </div>

        <TaskHierarchySelector 
          value={formData.parentTask}
          onChange={(val) => setFormData({...formData, parentTask: val})}
          availableTasks={availableTasks}
          disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
        />
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter task details..."
          rows={4}
          disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
        />
      </div>

      <div className="form-footer">
        <button
          type={isDirty ? "submit" : "button"}
          className={`halo-button ${isDirty ? 'save-btn' : 'close-btn'}`}
          onClick={isDirty ? undefined : onCancel}
          disabled={loading}
        >
          {loading ? 'Saving...' : (safeData.id ? (isDirty ? 'Update Task' : 'Close') : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default EmployeeTaskForm;
