import React, { useState, useEffect } from 'react';
import { billingModelService } from '../../services/clients/clientService';
import '../ChargingHubs/HubManagement.css';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { IconChevronDown } from '../../components/ui/Icons';
import ClientBillingModelCSVDownload from './ClientBillingModelCSVDownload';
import ClientBillingModelCSVImport from './ClientBillingModelCSVImport';

/**
 * ClientBillingModelManagement
 * CRUD sub-view for client billing models.
 */
const ClientBillingModelManagement = ({ user = {}, permissions = {}, setActiveVertical, onShowBottomNav }) => {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const data = await billingModelService.getBillingModels();
      setModels(data);
    } catch (error) {
      console.error('BillingModel fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchModels(); }, []);

  const handleOpenModal = (model = null) => {
    if (model) {
      setEditingModel(model);
      setFormData({ name: model.name, code: model.code || '', description: model.description || '' });
    } else {
      setEditingModel(null);
      setFormData({ name: '', code: '', description: '' });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      if (editingModel) {
        await billingModelService.updateBillingModel(editingModel.id, formData);
      } else {
        await billingModelService.addBillingModel(formData);
      }
      setStatusMsg({ type: 'success', text: `Billing model ${editingModel ? 'updated' : 'created'} successfully!` });
      setTimeout(() => { setIsModalOpen(false); fetchModels(); }, 1000);
    } catch (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this billing model? Clients using it will be unlinked.')) return;
    setLoading(true);
    try {
      await billingModelService.deleteBillingModel(id);
      fetchModels();
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Billing Models Management"
        description="Define global billing models for client contracts."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        rightActions={
          permissions.canCreate && (
            <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
              + New Billing Model
            </button>
          )
        }
        expandedLeft={
          <div className="view-mode-toggle">
            {['grid', 'list'].map(mode => (
              <button
                key={mode}
                className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        }
        expandedRight={
          <>
            <div className="data-operations-wrapper">
              <div className="actions-dropdown-container">
                <div
                  className="filters-row-toggle"
                  onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                >
                  <p className="u-text-upper">Data Operations</p>
                  <span style={{ transform: isActionsDropdownOpen ? 'rotate(180deg)' : 'none', opacity: 0.5, transition: 'transform 0.2s ease', display: 'flex', alignItems: 'center' }}>
                    <IconChevronDown size={10} />
                  </span>
                </div>
                {isActionsDropdownOpen && (
                  <div className="actions-dropdown-menu">
                    <ClientBillingModelCSVDownload className="master-action-btn" data={models} label="Export Models" />
            <ClientBillingModelCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            {permissions.canCreate && (
              <ClientBillingModelCSVImport className="master-action-btn" label="Import Models" onImportComplete={fetchModels} />
            )}
                  </div>
                )}
              </div>
            </div>
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Billing Models...</div>}

      {viewMode === 'grid' ? (
        <div className="hubs-grid">
          {models.map(model => (
            <div key={model.id} className="hub-card">
              <div className="hub-code-tag">{model.code || 'NO CODE'}</div>
              <h3>{model.name}</h3>
              <p className="hub-city">{model.description || 'No description provided'}</p>
              <div className="hub-actions">
                {permissions.canUpdate && <button className="halo-button edit-btn" onClick={() => handleOpenModal(model)} title="Edit Billing Model">✎</button>}
                {permissions.canDelete && <button className="halo-button delete-btn" onClick={() => handleDelete(model.id)} title="Delete Billing Model">×</button>}
              </div>
            </div>
          ))}
          {models.length === 0 && !loading && (
            <div className="empty-state">
              <p>No billing models yet. Create your first billing model!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view">
          <table className="management-table">
            <thead>
              <tr>
                <th>Model Name</th>
                <th>Code</th>
                <th>Description</th>
                <th className="u-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {models.map(model => (
                <tr key={model.id}>
                  <td className="name-cell">{model.name}</td>
                  <td><code className="code-font">{model.code || '—'}</code></td>
                  <td className="u-opacity-70 u-text-sm">{model.description || '—'}</td>
                  <td className="u-text-right">
                    <div className="table-actions">
                      {permissions.canUpdate && <button className="icon-btn edit" onClick={() => handleOpenModal(model)} title="Edit">✎</button>}
                      {permissions.canDelete && <button className="icon-btn delete" onClick={() => handleDelete(model.id)} title="Delete">×</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {models.length === 0 && !loading && (
            <div className="empty-state"><p>No billing models found.</p></div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingModel ? 'Edit Billing Model' : 'Create New Billing Model'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>
            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Billing Model Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Per Session, Monthly Retainer, Revenue Share"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. PER-SES, MNT-RET, REV-SHR"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="How does this billing model work?"
                  rows={4}
                />
              </div>
              {statusMsg.text && (
                <div className={`status-message ${statusMsg.type}`}>{statusMsg.text}</div>
              )}
              <div className="modal-footer">
                <button type="button" className="halo-button cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (editingModel ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientBillingModelManagement;
