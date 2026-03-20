import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import '../ChargingHubs/HubManagement.css';
import MasterPageHeader from '../../components/MasterPageHeader';
import ClientCategoryCSVDownload from './ClientCategoryCSVDownload';
import ClientCategoryCSVImport from './ClientCategoryCSVImport';

/**
 * ClientCategoryManagement
 * CRUD sub-view for client categories (mirrors DepartmentManagement).
 */
const ClientCategoryManagement = ({ permissions = {} }) => {
  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '', default_service_code: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => { 
    fetchCategories();
    fetchServices();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('client_categories')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setCategories(data || []);
    else console.error('ClientCategory fetch error:', error);
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('client_services')
      .select('id, name, code')
      .order('name');
    if (!error) setServices(data || []);
  };

  const handleOpenModal = (cat = null) => {
    if (cat) {
      setEditingCat(cat);
      setFormData({ 
        name: cat.name, 
        code: cat.code || '', 
        description: cat.description || '',
        default_service_code: cat.default_service_code || ''
      });
    } else {
      setEditingCat(null);
      setFormData({ name: '', code: '', description: '', default_service_code: '' });
    }
    setIsModalOpen(true);
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    const payload = { 
      ...formData, 
      updated_at: new Date().toISOString() 
    };
    let error;

    if (editingCat) {
      ({ error } = await supabase.from('client_categories').update(payload).eq('id', editingCat.id));
    } else {
      ({ error } = await supabase.from('client_categories').insert([payload]));
    }

    if (error) {
      setStatusMsg({ type: 'error', text: `Error: ${error.message}` });
    } else {
      setStatusMsg({ type: 'success', text: `Category ${editingCat ? 'updated' : 'created'} successfully!` });
      setTimeout(() => { setIsModalOpen(false); fetchCategories(); }, 1000);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category? Clients using it will be unlinked.')) return;
    setLoading(true);
    const { error } = await supabase.from('client_categories').delete().eq('id', id);
    if (error) alert(`Delete failed: ${error.message}`);
    else fetchCategories();
    setLoading(false);
  };

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="Client Category Manager"
        description="Define and manage client categories for segmenting your client base."
        leftActions={
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
        rightActions={
          <>
            <ClientCategoryCSVDownload 
              className="master-action-btn" 
              data={categories} 
              label="Export Categories" 
              tableName="client_categories"
              entityName="Client Categories"
              headers={['Category Name', 'Code', 'Default Service', 'Description']}
            />
            <ClientCategoryCSVDownload 
              className="master-action-btn" 
              isTemplate 
              label="Download Template" 
              tableName="client_categories"
              entityName="Client Categories"
              headers={['Category Name', 'Code', 'Default Service', 'Description']}
            />
            {permissions.canCreate && (
              <>
                <ClientCategoryCSVImport 
                  className="master-action-btn" 
                  label="Import Categories" 
                  onImportComplete={fetchCategories} 
                  tableName="client_categories"
                  entityName="Client Categories"
                  requiredFields={['category_name']}
                />
                <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
                  + New Category
                </button>
              </>
            )}
          </>
        }
      />

      {loading && !isModalOpen && <div className="loading-spinner">Loading Categories...</div>}

      {viewMode === 'grid' ? (
        <div className="hubs-grid">
          {categories.map(cat => (
            <div key={cat.id} className="hub-card">
              <div className="hub-code-tag">{cat.code || 'NO CODE'}</div>
              <h3>{cat.name}</h3>
              <p className="hub-city">{cat.description || 'No description provided'}</p>
              {cat.default_service_code && (
                <div style={{ marginTop: '8px', fontSize: '0.8rem' }}>
                  <span style={{ opacity: 0.6 }}>Default Service: </span>
                  <code style={{ color: 'var(--brand-green)', fontWeight: 600 }}>{cat.default_service_code}</code>
                </div>
              )}
              <div className="hub-actions">
                {permissions.canUpdate && <button className="halo-button edit-btn" onClick={() => handleOpenModal(cat)}>Edit</button>}
                {permissions.canDelete && <button className="halo-button delete-btn" onClick={() => handleDelete(cat.id)}>Delete</button>}
              </div>
            </div>
          ))}
          {categories.length === 0 && !loading && (
            <div className="empty-state">
              <p>No categories yet. Create your first client category!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view">
          <table className="management-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Code</th>
                <th>Default Service</th>
                <th>Description</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td className="name-cell">{cat.name}</td>
                  <td><code className="code-font">{cat.code || '—'}</code></td>
                  <td><code className="code-font" style={{ color: 'var(--brand-green)' }}>{cat.default_service_code || '—'}</code></td>
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
            <div className="empty-state"><p>No categories found.</p></div>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{editingCat ? 'Edit Category' : 'Create New Category'}</h2>
              <button className="close-modal" onClick={() => setIsModalOpen(false)}>&times;</button>
            </header>
            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Category Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Enterprise, SME, Retail"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Category Code</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ENT, SME, RTL"
                  />
                </div>
                <div className="form-group">
                  <label>Default Client Service</label>
                  <select
                    className="master-dropdown"
                    value={formData.default_service_code}
                    onChange={(e) => setFormData({ ...formData, default_service_code: e.target.value })}
                  >
                    <option value="">-- No Default Service --</option>
                    {services.map(svc => (
                      <option key={svc.id} value={svc.code}>
                        {svc.name} ({svc.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What type of clients belong to this category?"
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

export default ClientCategoryManagement;
