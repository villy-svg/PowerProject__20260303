import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import { taskUtils } from '../../utils/taskUtils';

/**
 * ClientTaskForm
 * Vertical-specific form for Client Manager tasks.
 * Allows assigning a task to a specific Client.
 */
const ClientTaskForm = ({ onSubmit, loading, initialData = {}, currentUser = {}, permissions = {}, availableTasks = [] }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    description: safeData.description || '',
    assigned_client_id: safeData.assigned_client_id || '',
    assigned_to: safeData.assigned_to || '',
    parentTask: safeData.parentTask || ''
  });
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
          onChange={(e) => setFormData({ ...formData, text: e.target.value })}
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
          <label>Related Client</label>
          <select 
            className="master-dropdown"
            value={formData.assigned_client_id}
            onChange={(e) => setFormData({...formData, assigned_client_id: e.target.value})}
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
        <button type="submit" className="halo-button save-btn" disabled={loading}>
          {loading ? 'Saving...' : (safeData.id ? 'Update Task' : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default ClientTaskForm;
