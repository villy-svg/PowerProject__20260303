import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';

/**
 * HubTaskForm
 * Vertical-specific form for Charging Hub tasks.
 * Includes text, priority, and link to a specific hub.
 */
const HubTaskForm = ({ onSubmit, loading, initialData = {} }) => {
  const safeData = initialData || {};
  const [formData, setFormData] = useState({
    text: safeData.text || '',
    priority: safeData.priority || 'Medium',
    hub_id: safeData.hub_id || '',
    description: safeData.description || ''
  });
  const [hubs, setHubs] = useState([]);

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    let { data } = await supabase.from('hubs').select('id, name').order('name');
    
    if (data) {
      // Find if we already have an 'ALL' hub
      const allHub = data.find(h => h.name === 'ALL');
      
      if (!allHub) {
        // Automatically provision an 'ALL' hub to satisfy UUID relationships
        const { data: newHub } = await supabase
          .from('hubs')
          .insert([{ name: 'ALL', hub_code: 'ALL', location: 'System', status: 'Active' }])
          .select();
          
        if (newHub) {
          data = [...newHub, ...data];
        }
      }
      setHubs(data);
    }
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
          onChange={(e) => setFormData({...formData, text: e.target.value})}
          placeholder="e.g. Inspect Station 4"
          required
        />
      </div>

      <div className="form-group">
        <label>Linked Hub</label>
        <select 
          value={formData.hub_id}
          onChange={(e) => setFormData({...formData, hub_id: e.target.value})}
        >
          <option value="">N/A (No Hub Linked)</option>
          {hubs.map(hub => (
            <option key={hub.id} value={hub.id}>{hub.name}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Priority</label>
        <select 
          value={formData.priority}
          onChange={(e) => setFormData({...formData, priority: e.target.value})}
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>

      <div className="form-group">
        <label>Detailed Description</label>
        <textarea 
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Enter task details..."
          rows={4}
        />
      </div>

      <div className="modal-footer" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
        <button type="submit" className="halo-button save-btn" style={{ flex: 1 }} disabled={loading}>
          {loading ? 'Saving...' : (safeData.id ? 'Update Task' : 'Create Task')}
        </button>
      </div>
    </form>
  );
};

export default HubTaskForm;
