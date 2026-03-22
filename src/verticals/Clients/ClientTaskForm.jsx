import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';

/**
 * ClientTaskForm
 * Vertical-specific form for Client Manager tasks.
 * Allows assigning a task to a specific Client.
 */
const ClientTaskForm = ({ onSubmit, loading, initialData = {} }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    description: safeData.description || '',
    assigned_client_id: safeData.assigned_client_id || ''
  });
  const [clients, setClients] = useState([]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'Active')
      .order('name');
    if (data) setClients(data);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      // We map the client selection to a data field that the backend can handle.
      // In this app, tasks often use metadata or specific columns for assignments.
      // For now, we'll just pass it through as assigned_client_id.
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
        />
      </div>

      <div className="form-row-grid">
        <div className="form-group">
          <label>Priority</label>
          <select
            className="master-dropdown"
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
          <label>Related Client</label>
          <select 
            className="master-dropdown"
            value={formData.assigned_client_id}
            onChange={(e) => setFormData({...formData, assigned_client_id: e.target.value})}
          >
            <option value="">N/A (General Client Task)</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.name}
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

export default ClientTaskForm;
