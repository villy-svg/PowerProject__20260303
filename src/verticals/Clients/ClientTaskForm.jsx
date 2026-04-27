import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import { taskUtils } from '../../utils/taskUtils';
import { useTaskForm } from '../../hooks/useTaskForm';

/**
 * ClientTaskForm
 * Vertical-specific form for Client Manager tasks.
 * Refactored: Uses useTaskForm for unified state management.
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
        <input
          type="text"
          value={formData.text}
          onChange={(e) => updateField('text', e.target.value)}
          placeholder="e.g. Renew retainer, Schedule quarterly review"
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
            onChange={(e) => updateField('priority', e.target.value)}
            disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div className="form-group">
          <label>Related Client</label>
          <select 
            className="master-dropdown"
            value={formData.assigned_client_id}
            onChange={(e) => updateField('assigned_client_id', e.target.value)}
            disabled={!taskUtils.canUserEditField(initialData, 'assigned_client_id', permissions, currentUser)}
          >
            <option value="">N/A (General Client Task)</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Assigned To</label>
          <AssigneeSelector
            value={formData.assigned_to}
            onChange={(val) => updateField('assigned_to', val)}
            currentUser={currentUser}
            disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
          />
        </div>

        <TaskHierarchySelector 
          value={formData.parentTask}
          onChange={(val) => updateField('parentTask', val)}
          availableTasks={availableTasks}
          disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
        />
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => updateField('description', e.target.value)}
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
          {loading ? 'Saving...' : (initialData?.id ? (isDirty ? 'Update Task' : 'Close') : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default ClientTaskForm;
