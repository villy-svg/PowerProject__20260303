import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './HubManagement.css';
import HubCSVDownload from './HubCSVDownload';
import HubCSVImport from './HubCSVImport';
import '../../components/CSVButtons.css';

const HubManagement = () => {
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHub, setEditingHub] = useState(null);
  const [formData, setFormData] = useState({ name: '', hub_code: '', city: '', status: 'active' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hubs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching hubs:', error);
    } else {
      setHubs(data || []);
    }
    setLoading(false);
  };

  const handleOpenModal = (hub = null) => {
    if (hub) {
      setEditingHub(hub);
      setFormData({ 
        name: hub.name, 
        hub_code: hub.hub_code || '', 
        city: hub.city || '', 
        status: hub.status || 'active' 
      });
    } else {
      setEditingHub(null);
      setFormData({ name: '', hub_code: '', city: '', status: 'active' });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const hubData = {
      ...formData,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingHub) {
      const { error: updateError } = await supabase
        .from('hubs')
        .update(hubData)
        .eq('id', editingHub.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('hubs')
        .insert([hubData]);
      error = insertError;
    }

    if (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setStatusMsg({ type: 'success', text: `Hub ${editingHub ? 'updated' : 'created'} successfully!` });
      setTimeout(() => {
        setIsModalOpen(false);
        fetchHubs();
      }, 1000);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this charging hub?')) return;

    setLoading(true);
    const { error } = await supabase.from('hubs').delete().eq('id', id);

    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      fetchHubs();
    }
    setLoading(false);
  };

  return (
    <div className="hub-management-container">
      <header className="hub-header">
        <div className="header-info">
          <h1>Hub Management</h1>
          <p>Create and manage global charging hub locations.</p>
        </div>
        <div className="header-actions">
          <button className="halo-button add-hub-main-btn" onClick={() => handleOpenModal()}>
            New Hub
          </button>
          <HubCSVDownload className="add-hub-main-btn" />
          <HubCSVImport className="add-hub-main-btn" onImportComplete={fetchHubs} />
        </div>
      </header>

      {loading && !isModalOpen && <div className="loading-spinner">Loading Hubs...</div>}

      <div className="hubs-grid">
        {(() => {
          // 1. Logic to detect duplicates by Name
          const nameCounts = {};
          hubs.forEach(h => {
            const name = h.name?.trim().toLowerCase();
            nameCounts[name] = (nameCounts[name] || 0) + 1;
          });

          // 2. Sort hubs: Group duplicates together, then by name
          const sortedHubs = [...hubs].sort((a, b) => {
            const nameA = a.name?.trim().toLowerCase();
            const nameB = b.name?.trim().toLowerCase();
            const isADup = nameCounts[nameA] > 1;
            const isBDup = nameCounts[nameB] > 1;

            if (isADup && !isBDup) return -1;
            if (!isADup && isBDup) return 1;
            return nameA.localeCompare(nameB);
          });

          return sortedHubs.map(hub => {
            const isDuplicateName = nameCounts[hub.name?.trim().toLowerCase()] > 1;

            return (
              <div key={hub.id} className={`hub-card ${isDuplicateName ? 'duplicate-name' : ''}`}>
                <div className={`status-badge ${hub.status}`}>{hub.status}</div>
                <div className="hub-code-tag">{hub.hub_code || 'NO CODE'}</div>
                <h3>{hub.name}</h3>
                <p className="hub-city">{hub.city || 'No city set'}</p>
                <div className="hub-actions">
                  <button className="halo-button edit-btn" onClick={() => handleOpenModal(hub)}>Edit</button>
                  <button className="halo-button delete-btn" onClick={() => handleDelete(hub.id)}>Delete</button>
                </div>
              </div>
            );
          });
        })()}
        {hubs.length === 0 && !loading && (
          <div className="empty-state">
            <p>No hubs found. Create your first charging hub to get started!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingHub ? 'Edit Charging Hub' : 'Create New Hub'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Hub Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Downtown Supercharger"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hub Code (Unique ID)</label>
                  <input 
                    type="text" 
                    value={formData.hub_code} 
                    onChange={(e) => setFormData({...formData, hub_code: e.target.value})}
                    placeholder="e.g. NYC-001"
                  />
                </div>
              </div>

              <div className="form-row-grid">
                <div className="form-group">
                  <label>City / Address</label>
                  <input 
                    type="text" 
                    value={formData.city} 
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    placeholder="e.g. 5th Avenue, NY"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {statusMsg.text && (
                <div className={`status-message ${statusMsg.type}`}>
                  {statusMsg.text}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="halo-button cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (editingHub ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HubManagement;
