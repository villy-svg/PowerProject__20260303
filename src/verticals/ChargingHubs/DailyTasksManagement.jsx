import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { masterErrorHandler } from '../../services/core/masterErrorHandler';
import { dailyTaskTemplateService } from '../../services/tasks/dailyTaskTemplateService';
import { VERTICALS } from '../../constants/verticals';
import MasterPageHeader from '../../components/MasterPageHeader';
import AssigneeSelector from '../../components/AssigneeSelector';
import { useManagementUI } from '../../hooks/useManagementUI';
import { taskUtils } from '../../utils/taskUtils';
import './DailyTasksManagement.css';

const DailyTasksManagement = ({ permissions = {}, refreshTasks, currentUser }) => {
  const ui = useManagementUI({
    resourceName: 'DailyTaskTemplates',
    onRefetch: () => fetchTemplates()
  });

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Reference Data
  const [hubs, setHubs] = useState([]);
  const [clients, setClients] = useState([]);
  
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    verticalId: VERTICALS.CHARGING_HUBS.id,
    subjectId: '',
    frequency: 'DAILY',
    timeOfDay: '08:00',
    assignedTo: '',
    isActive: true,
    uploadLink: ''
  });

  useEffect(() => {
    fetchTemplates();
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    try {
      const [hubRes, clientRes] = await Promise.all([
        supabase.from('hubs').select('id, name, hub_code'),
        // Await the client fetch separately or inside an async IIFE to avoid the .catch() prototype error on PostgrestBuilder
        (async () => {
          const { data, error } = await supabase.from('clients').select('id, name').limit(100);
          return { data: error ? [] : data };
        })()
      ]);

      setHubs(hubRes.data || []);
      setClients(clientRes?.data || []);
    } catch (err) {
      console.error('Error fetching reference data', err);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await dailyTaskTemplateService.getTemplates();
      setTemplates(data || []);
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'DailyTasksManagement', 'Fetch Templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (template = null) => {
    if (template) {
      ui.openEditModal(template);
      setFormData({
        title: template.title,
        description: template.description || '',
        verticalId: template.verticalId || VERTICALS.CHARGING_HUBS.id,
        subjectId: template.subjectId || '',
        frequency: template.frequency || 'DAILY',
        timeOfDay: template.timeOfDay || '08:00',
        assignedTo: template.assignedTo || '',
        isActive: template.isActive,
        uploadLink: template.uploadLink || ''
      });
    } else {
      ui.openAddModal();
      setFormData({ 
        title: '', description: '', verticalId: VERTICALS.CHARGING_HUBS.id, 
        subjectId: '', frequency: 'DAILY', timeOfDay: '08:00', 
        assignedTo: '', isActive: true, uploadLink: '' 
      });
    }
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (ui.editingItem) {
        await dailyTaskTemplateService.updateTemplate({ ...formData, id: ui.editingItem.id }, user.id);
        setStatusMsg({ type: 'success', text: 'Template updated successfully!' });
      } else {
        await dailyTaskTemplateService.addTemplate(formData, user.id);
        setStatusMsg({ type: 'success', text: 'Template created successfully!' });
      }
      setTimeout(() => {
        ui.closeModal();
        fetchTemplates();
      }, 1000);
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'DailyTasksManagement', 'Submit Template');
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    setLoading(true);
    try {
      await dailyTaskTemplateService.deleteTemplate(id);
      fetchTemplates();
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'DailyTasksManagement', 'Delete Template');
      setLoading(false);
    }
  };

  const handleToggleStatus = async (template) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await dailyTaskTemplateService.toggleStatus(template.id, !template.isActive, user.id);
      fetchTemplates();
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'DailyTasksManagement', 'Toggle Status');
    }
  };

  const handleCreateSample = async (template) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await dailyTaskTemplateService.generateSampleTask(template, user.id);
      if (refreshTasks) refreshTasks(); // Fetch the new task so it's ready in the board
      setStatusMsg({ type: 'success', text: `Sample task created for "${template.title}"! Check the Daily Board.` });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'DailyTasksManagement', 'Create Sample Task');
      setStatusMsg({ type: 'error', text: 'Failed to create sample task.' });
    } finally {
      setLoading(false);
    }
  };

  // Determine which subjects to show based on vertical
  const subjectOptions = formData.verticalId === VERTICALS.CLIENTS.id
    ? clients.map(c => ({ id: c.id, label: c.name })) :
    hubs.map(h => ({ id: h.id, label: h.hub_code || h.name }));

  return (
    <>
      <MasterPageHeader
        title="Daily Tasks Management"
        description="Create and manage recurring task templates that automatically generate on the Task Board."
        rightActions={
          <>
            {statusMsg.text && !ui.isAddModalOpen && (
              <span className={`status-pill ${statusMsg.type}`} style={{ marginRight: '1rem' }}>
                {statusMsg.text}
              </span>
            )}
            {permissions?.canCreateDailyTaskTemplates && (
              <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
                + New Template
              </button>
            )}
          </>
        }
        expandedLeft={
          <div className="view-mode-toggle">
            <button
              className={`view-toggle-btn ${ui.viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => ui.setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={`view-toggle-btn ${ui.viewMode === 'list' ? 'active' : ''}`}
              onClick={() => ui.setViewMode('list')}
            >
              List
            </button>
          </div>
        }
      />

      {loading && !ui.isAddModalOpen && <div className="loading-spinner">Processing...</div>}

      {ui.viewMode === 'grid' ? (
        <div className="templates-grid">
          {templates.map(template => (
            <div key={template.id} className={`template-card ${!template.isActive ? 'inactive' : ''}`}>
              <div className="template-header">
                <span className={`status-badge ${template.isActive ? 'active' : 'inactive'}`}>
                  {template.isActive ? 'Active' : 'Paused'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {permissions?.canUpdateDailyTaskTemplates && (
                    <>
                      <button 
                        className="icon-btn test" 
                        onClick={() => handleCreateSample(template)}
                        title="Create Sample Task (Test Play)"
                      >
                        🧪
                      </button>
                      <button 
                        className="icon-btn toggle" 
                        onClick={() => handleToggleStatus(template)}
                        title={template.isActive ? "Pause Generation" : "Resume Generation"}
                      >
                        {template.isActive ? '⏸' : '▶'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="template-frequency halo-type">{template.frequency}</div>
              <h3 className="template-title">{template.title}</h3>
              <p className="template-desc">{template.description || 'No description provided.'}</p>
              
              <div className="template-meta">
                <span><strong>Vertical:</strong> {template.verticalId.replace(/_/g, ' ')}</span>
                <span><strong>Assignee:</strong> {taskUtils.formatAssigneeForList(template.assignedTo, template.assigneeName, currentUser)}</span>
              </div>
              
              <div className="template-actions">
                {permissions?.canUpdateDailyTaskTemplates && (
                  <button className="halo-button edit-btn" onClick={() => handleOpenModal(template)} title="Edit Template">✎</button>
                )}
                {permissions?.canDeleteDailyTaskTemplates && (
                  <button className="halo-button delete-btn" onClick={() => handleDelete(template.id)} title="Delete Template">×</button>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && !loading && (
             <div className="empty-state">
               <p>No templates found. Create a new recurring task to get started!</p>
             </div>
          )}
        </div>
      ) : (
        <div className="templates-list-view responsive-table-wrapper">
          <table className="management-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Frequency</th>
                <th>Vertical</th>
                <th>Default Assignee</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(template => (
                <tr key={template.id} className={!template.isActive ? 'is-inactive' : ''}>
                  <td className="name-cell">{template.title}</td>
                  <td><span className="v-tag master">{template.frequency}</span></td>
                  <td>{template.verticalId.replace(/_/g, ' ')}</td>
                  <td>{taskUtils.formatAssigneeForList(template.assignedTo, template.assigneeName, currentUser)}</td>
                  <td>
                    <span className={`status-pill ${template.isActive ? 'active' : 'inactive'}`}>
                      {template.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      {permissions?.canUpdateDailyTaskTemplates && (
                        <>
                          <button className="icon-btn test" onClick={() => handleCreateSample(template)} title="Create Sample">🧪</button>
                          <button className="icon-btn" onClick={() => handleToggleStatus(template)}>{template.isActive ? '⏸' : '▶'}</button>
                          <button className="icon-btn edit" onClick={() => handleOpenModal(template)}>✎</button>
                        </>
                      )}
                      {permissions?.canDeleteDailyTaskTemplates && (
                        <button className="icon-btn delete" onClick={() => handleDelete(template.id)}>×</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ui.isAddModalOpen && (
        <div className="modal-overlay" onClick={ui.closeModal}>
          <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{ui.editingItem ? 'Edit Task Template' : 'Create Task Template'}</h2>
              <button className="close-modal" onClick={ui.closeModal}>&times;</button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              
              {/* Basic Info */}
              <div className="form-row-grid">
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Task Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Clean Hub Connectors"
                  />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detailed instructions..."
                  />
                </div>
              </div>

              {/* Rules */}
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Vertical</label>
                  <select
                    className="master-dropdown"
                    value={formData.verticalId}
                    onChange={(e) => setFormData({ ...formData, verticalId: e.target.value, subjectId: '' })}
                  >
                    <option value={VERTICALS.CHARGING_HUBS.id}>Charging Hubs</option>
                    <option value={VERTICALS.CLIENTS.id}>Client Management</option>
                    <option value={VERTICALS.EMPLOYEES.id}>Employee Management</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Subject (Hub/Client/Etc)</label>
                  <select
                    className="master-dropdown"
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  >
                    <option value="">-- Generic Task --</option>
                    {subjectOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Frequency</label>
                  <select
                    className="master-dropdown"
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Default Assignee</label>
                  <AssigneeSelector
                    value={formData.assignedTo}
                    onChange={(val) => setFormData({...formData, assignedTo: val})}
                    currentUser={currentUser}
                  />
                </div>

                <div className="form-group">
                  <label>Template Status</label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '100%' }}>
                     <label style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}} onClick={() => setFormData({...formData, isActive: !formData.isActive})}>
                        <div className={`selection-checkbox ${formData.isActive ? 'checked' : ''}`}>
                          {formData.isActive && '✓'}
                        </div>
                        <span style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                          {formData.isActive ? 'Active (Generating)' : 'Paused'}
                        </span>
                      </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Upload Link (Future feature)</label>
                  <input
                    type="url"
                    value={formData.uploadLink}
                    onChange={(e) => setFormData({ ...formData, uploadLink: e.target.value })}
                    placeholder="https://"
                    disabled
                    title="Reserved for future attachments"
                  />
                </div>
              </div>

              {statusMsg.text && (
                <div className={`status-message ${statusMsg.type}`}>
                  {statusMsg.text}
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="halo-button cancel-btn" onClick={ui.closeModal}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (ui.editingItem ? 'Update Template' : 'Create Template')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyTasksManagement;
