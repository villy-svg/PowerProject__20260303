import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { masterErrorHandler } from '../../services/core/masterErrorHandler';
import './HubManagement.css';
import HubCSVDownload from './HubCSVDownload';
import HubCSVImport from './HubCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';
import { useDuplicateDetection } from '../../hooks/useDuplicateDetection';
import { useManagementUI } from '../../hooks/useManagementUI';
import { IconEdit, IconTrash, IconX, IconPlus } from '../../components/Icons';

// Error boundary component
class HubManagementErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('HubManagement Error Boundary:', error, errorInfo);
    masterErrorHandler.handleComponentError(error, 'HubManagement', 'Component Mount');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Hub Management Error</h2>
          <p>Something went wrong loading the Hub Management component.</p>
          <details style={{ marginTop: '20px' }}>
            <summary>Error Details</summary>
            <pre style={{ textAlign: 'left', background: '#f5f5f5', padding: '10px' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px' }}>
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const HubManagement = ({ permissions = {}, isSubSidebarOpen, setIsSubSidebarOpen, setActiveVertical, onShowBottomNav }) => {
  const ui = useManagementUI({ storageKey: 'powerpod_hub_view' });
  const [hubs, setHubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', hub_code: '', city: '', status: 'active' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // MASTER-SLAVE: Unified Duplicate Detection
  const hubsWithDuplicateInfo = useDuplicateDetection(hubs, {
    fields: ['name'],
    sortByDuplicates: true
  });

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    if (!permissions?.canAccessConfig && permissions?.roleId !== 'master_admin') {
      setLoading(false);
      return;
    }
    console.log('🚀 HubManagement: fetchHubs called');
    setLoading(true);
    try {
      console.log('🔍 HubManagement: Querying hubs table...');
      const { data, error } = await supabase
        .from('hubs')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('🔍 HubManagement: Query result:', { data, error });

      if (error) {
        console.error('❌ HubManagement: Database error:', error);
        masterErrorHandler.handleDatabaseError(error, 'HubManagement - Fetch Hubs');
        setHubs([]);
      } else {
        console.log('✅ HubManagement: Successfully fetched hubs:', data?.length);
        setHubs(data || []);
      }
    } catch (err) {
      console.error('❌ HubManagement: Exception error:', err);
      masterErrorHandler.handleComponentError(err, 'HubManagement', 'Fetch Hubs');
      setHubs([]);
    } finally {
      console.log('🏁 HubManagement: fetchHubs completed, setting loading to false');
      setLoading(false);
    }
  };

  const handleOpenModal = (hub = null) => {
    if (hub) {
      ui.openEditModal(hub);
      setFormData({
        name: hub.name,
        hub_code: hub.hub_code || '',
        city: hub.city || '',
        status: hub.status || 'active'
      });
    } else {
      ui.openAddModal();
      setFormData({ name: '', hub_code: '', city: '', status: 'active' });
    }
    setStatusMsg({ type: '', text: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg({ type: '', text: '' });

    try {
      const hubData = {
        ...formData,
        updated_at: new Date().toISOString()
      };

      let result;
      if (ui.editingItem) {
        result = await supabase
          .from('hubs')
          .update(hubData)
          .eq('id', ui.editingItem.id)
          .select();
      } else {
        result = await supabase
          .from('hubs')
          .insert([hubData])
          .select();
      }

      if (result.error) {
        masterErrorHandler.handleDatabaseError(result.error, 'HubManagement - Submit Hub');
      } else {
        setStatusMsg({ type: 'success', text: `Hub ${ui.editingItem ? 'updated' : 'created'} successfully!` });
        setTimeout(() => {
          ui.closeModal();
          fetchHubs();
        }, 1000);
      }

    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'HubManagement', 'Submit Hub');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this charging hub?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('hubs').delete().eq('id', id);

      if (error) {
        masterErrorHandler.handleDatabaseError(error, 'HubManagement - Delete Hub');
      } else {
        fetchHubs();
      }
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'HubManagement', 'Delete Hub');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MasterPageHeader
        title="Hub Management"
        description="Create and manage global charging hub locations."
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        rightActions={
          permissions.canCreate && (
            <button className="halo-button master-action-btn" onClick={() => handleOpenModal()}>
              + Add New Hub
            </button>
          )
        }
        canAdd={permissions.canCreate}
        onAddClick={() => handleOpenModal()}
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
        expandedRight={
          <>
            <HubCSVDownload
              className="master-action-btn"
              data={hubs}
              label="Export Hubs"
              filename={`charging_hubs_export_${new Date().toISOString().split('T')[0]}.xlsx`}
            />
            <HubCSVDownload className="master-action-btn" label="Download Template" />
            {permissions.canCreate && (
              <HubCSVImport className="master-action-btn" label="Import Hubs" onImportComplete={fetchHubs} />
            )}
          </>
        }
      />

      {loading && !ui.isAddModalOpen && <div className="loading-spinner">Loading Hubs...</div>}

      {ui.viewMode === 'grid' ? (
        <div className="hubs-grid">
          {hubsWithDuplicateInfo.map(hub => (
            <div key={hub.id} className={`hub-card ${hub.isDuplicate ? 'duplicate-name' : ''}`}>
              {hub.isDuplicate && (
                <span className="duplicate-badge" style={{ position: 'absolute', top: '10px', right: '10px' }}>DUP</span>
              )}
              <div className={`status-badge ${hub.status}`}>{hub.status}</div>
              <div className="hub-code-tag">{hub.hub_code || 'NO CODE'}</div>
              <h3>{hub.name}</h3>
              <p className="hub-city">{hub.city || 'No city set'}</p>
              <div className="hub-actions">
                {permissions.canUpdate && (
                  <button className="halo-button edit-btn" onClick={() => handleOpenModal(hub)} title="Edit Hub">
                    <IconEdit size={16} />
                  </button>
                )}
                {permissions.canDelete && (
                  <button className="halo-button delete-btn" onClick={() => handleDelete(hub.id)} title="Delete Hub">
                    <IconTrash size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {hubs.length === 0 && !loading && (
            <div className="empty-state">
              <p>No hubs found. Create your first charging hub to get started!</p>
            </div>
          )}
        </div>
      ) : (
        <div className="hubs-list-view responsive-table-wrapper">
          <table className="management-table">
            <thead>
              <tr>
                <th>Hub Name</th>
                <th>Code</th>
                <th>City/Address</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hubsWithDuplicateInfo.map(hub => (
                <tr key={hub.id} className={hub.isDuplicate ? 'is-duplicate' : ''}>
                  <td className="name-cell">
                    {hub.name}
                    {hub.isDuplicate && <span className="duplicate-badge-mini">DUP</span>}
                  </td>
                  <td><code className="code-font">{hub.hub_code || '—'}</code></td>
                  <td>{hub.city || '—'}</td>
                  <td>
                    <span className={`status-pill ${hub.status}`}>{hub.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="table-actions">
                      {permissions.canUpdate && (
                        <button className="icon-btn edit" onClick={() => handleOpenModal(hub)} title="Edit">
                          <IconEdit size={16} />
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button className="icon-btn delete" onClick={() => handleDelete(hub.id)} title="Delete">
                          <IconTrash size={16} />
                        </button>
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
          <div className="modal-content hub-modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2>{ui.editingItem ? 'Edit Charging Hub' : 'Create New Hub'}</h2>
              <button className="close-modal" onClick={ui.closeModal}>
                <IconX size={20} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="vertical-task-form">
              <div className="form-row-grid">
                <div className="form-group">
                  <label>Hub Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Downtown Supercharger"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hub Code (Unique ID)</label>
                  <input
                    type="text"
                    value={formData.hub_code}
                    onChange={(e) => setFormData({ ...formData, hub_code: e.target.value })}
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
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. 5th Avenue, NY"
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
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
                <button type="button" className="halo-button cancel-btn" onClick={ui.closeModal}>Cancel</button>
                <button type="submit" className="halo-button save-btn" disabled={loading}>
                  {loading ? 'Saving...' : (ui.editingItem ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// Wrap with error boundary
const HubManagementWithErrorBoundary = ({ permissions }) => (
  <HubManagementErrorBoundary>
    <HubManagement permissions={permissions} />
  </HubManagementErrorBoundary>
);

export default HubManagementWithErrorBoundary;
