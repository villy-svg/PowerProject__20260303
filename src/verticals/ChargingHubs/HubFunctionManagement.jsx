import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './HubFunctionManagement.css';
import FunctionCSVDownload from './FunctionCSVDownload';
import FunctionCSVImport from './FunctionCSVImport';
import '../../components/CSVButtons.css';
import MasterPageHeader from '../../components/MasterPageHeader';

const HubFunctionManagement = () => {
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState(null);
  const [formData, setFormData] = useState({ name: '', function_code: '', description: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchFunctions();
  }, []);

  const fetchFunctions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hub_functions')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching functions:', error);
    } else {
      setFunctions(data || []);
    }
    setLoading(false);
  };

  const handleOpenModal = (fn = null) => {
    if (fn) {
      setEditingFunction(fn);
      setFormData({ 
        name: fn.name, 
        function_code: fn.function_code || '',
        description: fn.description || ''
      });
    } else {
      setEditingFunction(null);
      setFormData({ name: '', function_code: '', description: '' });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const functionData = {
      ...formData,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingFunction) {
      const { error: updateError } = await supabase
        .from('hub_functions')
        .update(functionData)
        .eq('id', editingFunction.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('hub_functions')
        .insert([functionData]);
      error = insertError;
    }

    if (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setStatusMsg({ type: 'success', text: `Function ${editingFunction ? 'updated' : 'created'} successfully!` });
      setTimeout(() => {
        setIsModalOpen(false);
        fetchFunctions();
      }, 1000);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this functional category?')) return;

    setLoading(true);
    const { error } = await supabase.from('hub_functions').delete().eq('id', id);

    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      fetchFunctions();
    }
    setLoading(false);
  };

  return (
    <>
      <MasterPageHeader
        title="Hub Function Management"
        description="Define and manage functional categories for charging hub tasks."
        rightActions={
          <>
            <FunctionCSVDownload 
              className="halo-button master-action-btn" 
              data={functions} 
              label="Export Functions" 
              filename={`hub_functions_export_${new Date().toISOString().split('T')[0]}.csv`}
            />
            <FunctionCSVDownload className="halo-button master-action-btn" label="Download Template" />
            <FunctionCSVImport className="halo-button master-action-btn" label="Import Functions" onImportComplete={fetchFunctions} />
            <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
              + New Function
            </button>
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Functions...</div>}

      <div className="hubs-grid">
        {functions.map(fn => (
          <div key={fn.id} className="hub-card">
            <div className="hub-code-tag">{fn.function_code || 'NO CODE'}</div>
            <h3>{fn.name}</h3>
            <p className="hub-city">{fn.description || 'No description provided'}</p>
            <div className="hub-actions">
              <button className="halo-button edit-btn" onClick={() => handleOpenModal(fn)}>Edit</button>
              <button className="halo-button delete-btn" onClick={() => handleDelete(fn.id)}>Delete</button>
            </div>
          </div>
        ))}
        {functions.length === 0 && !loading && (
          <div className="empty-state">
            <p>No functional categories found. Create your first function to get started!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingFunction ? 'Edit Hub Function' : 'Create New Function'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Function Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Maintenance, Inspection, Cleaning"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Function Code (Short ID)</label>
                  <input 
                    type="text" 
                    value={formData.function_code} 
                    onChange={(e) => setFormData({...formData, function_code: e.target.value})}
                    placeholder="e.g. MNT, CLN, INSP"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What does this function involve?"
                  rows={4}
                />
              </div>

              {statusMsg.text && (
                <div className={`status-message ${statusMsg.type}`}>
                  {statusMsg.text}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="halo-button cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (editingFunction ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default HubFunctionManagement;
