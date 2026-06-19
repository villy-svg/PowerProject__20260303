import React, { useState, useEffect } from 'react';
import { clientServiceManager } from '../../services/clients/clientService';
import '../ChargingHubs/HubManagement.css';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { IconChevronDown } from '../../components/ui/Icons';
// B4 FIX: ClientCategoryCSVDownload/Import are fully generic via tableName/entityName/requiredFields props.
// Imported under neutral local names to make the intent clear and avoid misleading file references.
import CSVDownload from './ClientCategoryCSVDownload';
import CSVImport from './ClientCategoryCSVImport';

/**
 * ClientServiceManagement
 * CRUD sub-view for client service categories (mirrors ClientCategoryManagement but for SERVICE type).
 */
const ClientServiceManagement = ({ user = {}, permissions = {}, setActiveVertical, onShowBottomNav }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const data = await clientServiceManager.getServices();
      setCategories(data);
    } catch (error) {
      console.error('ClientService fetch error:', error);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleOpenModal = (cat = null) => {
    if (cat) {
      setEditingCat(cat);
      setFormData({ name: cat.name, code: cat.code || '', description: cat.description || '' });
    } else {
      setEditingCat(null);
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
      if (editingCat) {
        await clientServiceManager.updateService(editingCat.id, formData);
      } else {
        await clientServiceManager.addService(formData);
      }
      setStatusMsg({ type: 'success', text: `Service ${editingCat ? 'updated' : 'created'} successfully!` });
      setTimeout(() => { setIsModalOpen(false); fetchCategories(); }, 1000);
    } catch (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this service category? Clients using it will be unlinked.')) return;
    setLoading(true);
    try {
      await clientServiceManager.deleteService(id);
      fetchCategories();
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Client Service Management"
        description="Define and manage service categories (Maintenance, AMC, etc.)"
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        rightActions={
          permissions.canCreate && (
            <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
              + New Service
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
                  <p style={{ textTransform: 'uppercase' }}>Data Operations</p>
                  <span style={{ transform: isActionsDropdownOpen ? 'rotate(180deg)' : 'none', opacity: 0.5, transition: 'transform 0.2s ease', display: 'flex', alignItems: 'center' }}>
                    <IconChevronDown size={10} />
                  </span>
                </div>
                {isActionsDropdownOpen && (
                  <div className="actions-dropdown-menu">
                    <CSVDownload
              className="master-action-btn"
              data={categories}
              label="Export Services"
              tableName="client_services"
              entityName="Client Services"
              headers={['Service Name', 'Code', 'Description']}
            />
            <CSVDownload
              className="master-action-btn"
              isTemplate
              label="Download Template"
              tableName="client_services"
              entityName="Client Services"
              headers={['Service Name', 'Code', 'Description']}
            />
            {permissions.canCreate && (
              <CSVImport
                className="master-action-btn"
                label="Import Services"
                onImportComplete={fetchCategories}
                tableName="client_services"
                entityName="Client Services"
                requiredFields={['service_name']}
              />
            )}
                  </div>
                )}
              </div>
            </div>
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Services...</div>}

      {viewMode === 'grid' ? (
        <div className="hubs-grid">
          {categories.map(cat => (
            <div key={cat.id} className="hub-card">
              <div className="hub-code-tag">{cat.code || 'NO CODE'}</div>
              <h3>{cat.name}</h3>
              <p className="hub-city">{cat.description || 'No description provided'}</p>
              <div className="hub-actions">
                {permissions.canUpdate && <button className="halo-button edit-btn" onClick={() => handleOpenModal(cat)} title="Edit Service">✎</button>}
                {permissions.canDelete && <button className="halo-button delete-btn" onClick={() => handleDelete(cat.id)} title="Delete Service">×</button>}
              </div>
            </div>
          ))}
          {categories.length === 0 && !loading && (
            <div className="empty-state">
              <p>No service categories yet. Create your first service!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view">
          <table className="management-table">
            <thead>
              <tr>
                <th>Service Name</th>
                <th>Code</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td className="name-cell">{cat.name}</td>
                  <td><code className="code-font">{cat.code || '—'}</code></td>
                  <td style={{ opacity: 0.7, fontSize: '0.85rem' }}>{cat.description || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      {permissions.canUpdate && <button className="icon-btn edit" onClick={() => handleOpenModal(cat)} title="Edit">✎</button>}
                      {permissions.canDelete && <button className="icon-btn delete" onClick={() => handleDelete(cat.id)} title="Delete">×</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {categories.length === 0 && !loading && (
            <div className="empty-state"><p>No service categories found.</p></div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingCat ? 'Edit Service' : 'Create New Service'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>
            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Service Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Full Maintenance, AMC"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Service Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. MAINT, AMC"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this service entail?"
                  rows={4}
                />
              </div>
              {statusMsg.text && (
                <div className={`status-message ${statusMsg.type}`}>{statusMsg.text}</div>
              )}
              <div className="modal-footer">
                <button type="button" className="halo-button cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (editingCat ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientServiceManagement;
