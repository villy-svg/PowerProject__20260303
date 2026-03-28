import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './EmployeeRoleManagement.css';
import '../ChargingHubs/HubManagement.css'; // Global grid/list layout logic
import MasterPageHeader from '../../components/MasterPageHeader';
import EmployeeRoleCSVDownload from './EmployeeRoleCSVDownload';
import EmployeeRoleCSVImport from './EmployeeRoleCSVImport';

const EmployeeRoleManagement = ({ permissions = {} }) => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', role_code: '', description: '', seniority_level: 1 });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_roles')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching employee roles:', error);
    } else {
      setRoles(data || []);
    }
    setLoading(false);
  };

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({ 
        name: role.name, 
        role_code: role.role_code || '',
        description: role.description || '',
        seniority_level: role.seniority_level || 1
      });
    } else {
      setEditingRole(null);
      setFormData({ name: '', role_code: '', description: '', seniority_level: 1 });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const roleData = {
      ...formData,
      updated_at: new Date().toISOString()
    };

    let error;
    if (editingRole) {
      const { error: updateError } = await supabase
        .from('employee_roles')
        .update(roleData)
        .eq('id', editingRole.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('employee_roles')
        .insert([roleData]);
      error = insertError;
    }

    if (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setStatusMsg({ type: 'success', text: `Role ${editingRole ? 'updated' : 'created'} successfully!` });
      setTimeout(() => {
        setIsModalOpen(false);
        fetchRoles();
      }, 1000);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this role?')) return;

    setLoading(true);
    const { error } = await supabase.from('employee_roles').delete().eq('id', id);

    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      fetchRoles();
    }
    setLoading(false);
  };

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Employee Role Management"
        description="Define and manage specific job roles for the employee vertical."
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
            <EmployeeRoleCSVDownload className="master-action-btn" data={roles} label="Export Roles" />
            <EmployeeRoleCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            {permissions.canCreate && (
              <>
                <EmployeeRoleCSVImport className="master-action-btn" label="Import Roles" onImportComplete={fetchRoles} />
                <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
                  + New Role
                </button>
              </>
            )}
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Roles...</div>}

      {viewMode === 'grid' ? (
        <div className="hubs-grid">
          {roles.map(role => (
            <div key={role.id} className="hub-card">
              <div className="hub-code-tag">{role.role_code || 'NO CODE'}</div>
              <div className="seniority-tag">Level {role.seniority_level || 1}</div>
              <h3>{role.name}</h3>
              <p className="hub-city">{role.description || 'No description provided'}</p>
              <div className="hub-actions">
                {permissions.canUpdate && <button className="halo-button edit-btn" onClick={() => handleOpenModal(role)} title="Edit Role">✎</button>}
                {permissions.canDelete && <button className="halo-button delete-btn" onClick={() => handleDelete(role.id)} title="Delete Role">×</button>}
              </div>
            </div>
          ))}
          {roles.length === 0 && !loading && (
            <div className="empty-state">
              <p>No roles found. Create your first employee role to get started!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view responsive-table-wrapper">
          <table className="management-table">
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Code</th>
                <th>Seniority</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                <tr key={role.id}>
                  <td className="name-cell">{role.name}</td>
                  <td><code className="code-font">{role.role_code || '—'}</code></td>
                  <td>
                    <span className="seniority-tag">Level {role.seniority_level || 1}</span>
                  </td>
                  <td style={{ opacity: 0.7, fontSize: '0.85rem' }}>{role.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      {permissions.canUpdate && <button className="icon-btn edit" onClick={() => handleOpenModal(role)} title="Edit">✎</button>}
                      {permissions.canDelete && <button className="icon-btn delete" onClick={() => handleDelete(role.id)} title="Delete">×</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingRole ? 'Edit Role' : 'Create New Role'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Role Name</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Senior Developer, Marketing Associate"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Role Code</label>
                  <input 
                    type="text" 
                    value={formData.role_code} 
                    onChange={(e) => setFormData({...formData, role_code: e.target.value})}
                    placeholder="e.g. SR-DEV, MKT-ASC"
                  />
                </div>

                <div className="form-group">
                  <label>Seniority Level</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="10"
                    value={formData.seniority_level} 
                    onChange={(e) => setFormData({...formData, seniority_level: parseInt(e.target.value) || 1})}
                    placeholder="1-10 (1=lowest, 10=highest)"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What are the key responsibilities of this role?"
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
                  {loading ? 'Saving...' : (editingRole ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeRoleManagement;
