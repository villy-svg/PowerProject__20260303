import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import '../ChargingHubs/HubFunctionManagement.css'; // Reuse styles
import MasterPageHeader from '../../components/MasterPageHeader';
import DepartmentCSVDownload from './DepartmentCSVDownload';
import DepartmentCSVImport from './DepartmentCSVImport';

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({ name: '', dept_code: '', description: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
    } else {
      setDepartments(data || []);
    }
    setLoading(false);
  };

  const handleOpenModal = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setFormData({ 
        name: dept.name, 
        dept_code: dept.dept_code || '',
        description: dept.description || ''
      });
    } else {
      setEditingDept(null);
      setFormData({ name: '', dept_code: '', description: '' });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const deptData = {
      ...formData,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingDept) {
      const { error: updateError } = await supabase
        .from('departments')
        .update(deptData)
        .eq('id', editingDept.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('departments')
        .insert([deptData]);
      error = insertError;
    }

    if (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setStatusMsg({ type: 'success', text: `Department ${editingDept ? 'updated' : 'created'} successfully!` });
      setTimeout(() => {
        setIsModalOpen(false);
        fetchDepartments();
      }, 1000);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;

    setLoading(true);
    const { error } = await supabase.from('departments').delete().eq('id', id);

    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      fetchDepartments();
    }
    setLoading(false);
  };

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Department Management"
        description="Define and manage organization departments for employee tracking."
        leftActions={
          <div className="view-mode-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        }
        rightActions={
          <>
            <DepartmentCSVDownload className="master-action-btn" data={departments} label="Export Departments" />
            <DepartmentCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            <DepartmentCSVImport className="master-action-btn" label="Import Departments" onImportComplete={fetchDepartments} />
            <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
              + New Department
            </button>
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Departments...</div>}

      {viewMode === 'grid' ? (
        <div className="hubs-grid">
          {departments.map(dept => (
            <div key={dept.id} className="hub-card">
              <div className="hub-code-tag">{dept.dept_code || 'NO CODE'}</div>
              <h3>{dept.name}</h3>
              <p className="hub-city">{dept.description || 'No description provided'}</p>
              <div className="hub-actions">
                <button className="halo-button edit-btn" onClick={() => handleOpenModal(dept)}>Edit</button>
                <button className="halo-button delete-btn" onClick={() => handleDelete(dept.id)}>Delete</button>
              </div>
            </div>
          ))}
          {departments.length === 0 && !loading && (
            <div className="empty-state">
              <p>No departments found. Create your first department to get started!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view">
          <table className="management-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Code</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id}>
                  <td className="name-cell">{dept.name}</td>
                  <td><code className="code-font">{dept.dept_code || '—'}</code></td>
                  <td style={{ opacity: 0.7, fontSize: '0.85rem' }}>{dept.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      <button className="icon-btn edit" onClick={() => handleOpenModal(dept)} title="Edit">✎</button>
                      <button className="icon-btn delete" onClick={() => handleDelete(dept.id)} title="Delete">×</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {departments.length === 0 && !loading && (
            <div className="empty-state">
              <p>No departments found.</p>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingDept ? 'Edit Department' : 'Create New Department'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Department Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Engineering, Marketing, Operations"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Department Code</label>
                  <input 
                    type="text" 
                    value={formData.dept_code} 
                    onChange={(e) => setFormData({...formData, dept_code: e.target.value})}
                    placeholder="e.g. ENG, MKT, OPS"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What is this department responsible for?"
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
                  {loading ? 'Saving...' : (editingDept ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;
