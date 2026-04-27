import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import CustomSelect from '../../components/CustomSelect';
import { taskUtils } from '../../utils/taskUtils';
import { useTaskForm } from '../../hooks/useTaskForm';

/**
 * ClientTaskForm
 * Vertical-specific form for Client Manager tasks.
 * Refactored: Uses useTaskForm for unified state management and CustomSelect for premium UI.
 */
const ClientTaskForm = ({ onSubmit, onCancel, loading, initialData = {}, currentUser = {}, permissions = {}, availableTasks = [] }) => {
  const {
    formData,
    updateField,
    isDirty
  } = useTaskForm(initialData);

  const [clients, setClients] = useState([]);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'Active')
      .order('name');
    if (data) setClients(data);
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const selectedClient = clients.find(c => c.id === formData.assigned_client_id);
    const finalTaskText = taskUtils.formatTaskText(formData.text, {
      assetCode: selectedClient?.name,
      forcePrefix: !!formData.assigned_client_id
    });

    onSubmit({
      ...formData,
      text: finalTaskText
    });
  };

  return (
    <form className="vertical-task-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>Task Summary</label>
        <div className="form-input-container">
          <input
            type="text"
            value={formData.text}
            onChange={(e) => updateField('text', e.target.value)}
            placeholder="e.g. Renew retainer, Schedule quarterly review"
            required
            disabled={!taskUtils.canUserEditField(initialData, 'text', permissions, currentUser)}
          />
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Priority</label>
          <div className="form-input-container">
            <CustomSelect
              value={formData.priority}
              onChange={(val) => updateField('priority', val)}
              options={[
                { label: 'Low', value: 'Low' },
                { label: 'Medium', value: 'Medium' },
                { label: 'High', value: 'High' },
                { label: 'Urgent', value: 'Urgent' }
              ]}
              disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Related Client</label>
          <div className="form-input-container">
            <CustomSelect
              value={formData.assigned_client_id}
              onChange={(val) => updateField('assigned_client_id', val)}
              options={[
                { label: 'N/A (General Client Task)', value: '' },
                ...clients.map(client => ({ label: client.name, value: client.id }))
              ]}
              placeholder="Select Client..."
              disabled={!taskUtils.canUserEditField(initialData, 'assigned_client_id', permissions, currentUser)}
            />
          </div>
        </div>
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Assigned To</label>
          <div className="form-input-container">
            <AssigneeSelector
              value={formData.assigned_to}
              onChange={(val) => updateField('assigned_to', val)}
              currentUser={currentUser}
              disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Parent Task</label>
          <div className="form-input-container">
            <TaskHierarchySelector 
              value={formData.parentTask}
              onChange={(val) => updateField('parentTask', val)}
              availableTasks={availableTasks}
              disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
            />
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <div className="form-input-container">
          <textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Enter task details..."
            rows={4}
            disabled={!taskUtils.canUserEditField(initialData, 'description', permissions, currentUser)}
          />
        </div>
      </div>

      <div className="form-footer">
        <button
          type={isDirty ? "submit" : "button"}
          className={`halo-button ${isDirty ? 'save-btn' : 'close-btn'}`}
          onClick={isDirty ? undefined : onCancel}
          disabled={loading}
        >
          {loading ? 'Saving...' : (initialData?.id ? (isDirty ? 'Update Task' : 'Close') : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default ClientTaskForm;
