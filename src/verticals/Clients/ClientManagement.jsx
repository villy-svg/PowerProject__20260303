import React, { useState, useEffect } from 'react';
import { useClients } from '../../hooks/useClients';
import '../ChargingHubs/HubManagement.css';
import './ClientManagement.css';
import ClientCSVDownload from './ClientCSVDownload';
import ClientCSVImport from './ClientCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';
import TaskModal from '../../components/TaskModal';
import ClientForm from './ClientForm';
import ClientCard from './ClientCard';
import ClientListRow from './ClientListRow';
import ConflictModal from '../../components/ConflictModal';
import { matchesCriteria } from '../../utils/matchingAlgorithms';

/**
 * ClientManagement
 *
 * Primary view for the Client Manager vertical.
 * Displays client records grouped by category.
 */
const ClientManagement = ({ user, permissions, filters, tasks = [], setActiveVertical, onShowBottomNav }) => {
  const { clients, categories, billingModels, loading, fetchClients, addClient, updateClient, toggleStatus, deleteClient } = useClients();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_client_view') || 'grid');
  const [showInactive, setShowInactive] = useState(true);
  const [editingClient, setEditingClient] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [pendingConflict, setPendingConflict] = useState(null);

  useEffect(() => {
    if (permissions?.canAccessClients) {
      fetchClients();
    }
  }, [fetchClients, permissions?.canAccessClients]);

  useEffect(() => {
    localStorage.setItem('powerpod_client_view', viewMode);
  }, [viewMode]);

  if (!permissions?.canAccessClients && !(permissions?.scope === 'global')) {
    return (
      <div className="empty-state" style={{ marginTop: '100px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }}>🔒</div>
        <h3>Access Restricted</h3>
        <p>You do not have permission to view the Client List.</p>
      </div>
    );
  }

  const handleSave = async (formData, force = false) => {
    if (!force) {
      const matchingProbe = {
        name: formData.name,
        poc_email: formData.poc_email,
        poc_phone: formData.poc_phone,
      };

      const existingMatch = clients.find(c =>
        c.id !== (editingClient?.id) &&
        matchesCriteria(matchingProbe, { full_name: c.name, phone: c.poc_phone, email: c.poc_email }, {
          fields: ['full_name'],
          useFuzzy: true,
          threshold: 0.88,
          exactFields: ['email'],
        })
      );

      if (existingMatch) {
        setPendingConflict({ formData, existingRecord: existingMatch });
        return;
      }
    }

    setIsSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await addClient(formData);
      }
      setIsAddModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      console.error('ClientManagement: Operation Error:', err);
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to permanently delete this client record?')) {
      try {
        await deleteClient(id);
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setIsViewOnly(false);
    setIsAddModalOpen(true);
  };

  const openViewModal = (client) => {
    setEditingClient(client);
    setIsViewOnly(true);
    setIsAddModalOpen(true);
  };

  // Apply filters from sub-sidebar
  const filteredClients = clients.filter(c => {
    const matchesStatus = showInactive || c.status === 'Active';
    
    // Vehicle Category Filter: client is included if ANY of its selected vehicle IDs are in the filter
    const selectedVehicleIds = Object.keys(c.category_matrix || {}).filter(vId => 
      Object.values(c.category_matrix[vId] || {}).some(checked => checked)
    );
    const matchesVehicle = !filters?.vehicle?.length || filters.vehicle.some(v => selectedVehicleIds.includes(v));

    // Service Category Filter: client is included if ANY of its selected service IDs are in the filter
    const selectedServiceIds = [];
    Object.values(c.category_matrix || {}).forEach(services => {
      Object.entries(services).forEach(([sId, checked]) => {
        if (checked && !selectedServiceIds.includes(sId)) selectedServiceIds.push(sId);
      });
    });
    const matchesService = !filters?.service?.length || filters.service.some(s => selectedServiceIds.includes(s));

    const matchesBilling = !filters?.billing_model?.length || filters.billing_model.includes(c.billing_model_id);
    
    return matchesStatus && matchesVehicle && matchesService && matchesBilling;
  });

  const activeClients = filteredClients.filter(c => c.status === 'Active');
  const inactiveClients = filteredClients.filter(c => c.status === 'Inactive');

  // Group active clients by billing model
  const activeByBillingModel = activeClients.reduce((acc, client) => {
    const key = client.billing_model_name || 'No Billing Model';
    if (!acc[key]) acc[key] = { billingModelName: key, clients: [] };
    acc[key].clients.push(client);
    return acc;
  }, {});

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingClient(null);
    setIsViewOnly(false);
  };

  const isMasterAdmin = user?.roleId === 'master_admin';

  const clientCardProps = (client) => ({
    key: client.id,
    client,
    tasks: tasks.filter(t => t.assigned_client_id === client.id),
    onEdit: openEditModal,
    onView: openViewModal,
    onDelete: handleDelete,
    onToggleStatus: toggleStatus,
    permissions: {
      ...permissions,
      canUpdate: permissions.canUpdateClients,
      canDelete: permissions.canDeleteClients
    },
  });

  return (
    <>
      <MasterPageHeader
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        title="Client Records Manager"
        description="Centralized database for client profiles, billing arrangements, and point-of-contact information."
        rightActions={
          permissions.canCreateClients && (
            <button
              className="halo-button master-action-btn"
              onClick={() => { setEditingClient(null); setIsAddModalOpen(true); }}
            >
              + Add Client
            </button>
          )
        }
        expandedLeft={
          <>
            <div className="view-mode-toggle">
              {['grid', 'list'].map(mode => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              className={`halo-button toggle-depri-btn ${!showInactive ? 'active' : ''}`}
              onClick={() => setShowInactive(!showInactive)}
              title={showInactive ? 'Hide Inactive' : 'Show Inactive'}
              style={{ fontWeight: 600, textDecoration: showInactive ? 'none' : 'line-through' }}
            >
              INACTIVE
            </button>
          </>
        }
        expandedRight={
          <>
            <ClientCSVDownload data={clients} label="Export Clients" className="master-action-btn" />
            <ClientCSVDownload isTemplate label="Download Template" className="master-action-btn" />
            {permissions.canCreateClients && (
              <ClientCSVImport label="Import Clients" onImportComplete={fetchClients} className="master-action-btn" />
            )}
          </>
        }
      />

      {loading ? (
        <div className="loading-spinner">Loading Clients...</div>
      ) : clients.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '50px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🏢</div>
          <h3>Client Database Empty</h3>
          <p>Click "+ Add Client" to insert your first client record.</p>
        </div>
      ) : (
        <div style={{ marginTop: '1rem' }}>
          {/* ACTIVE SECTION */}
          <div className="status-section">
            <h4 className="client-section-title">Active Clients ({activeClients.length})</h4>
            {activeClients.length === 0 ? (
              <p className="client-empty-sub-state">No active clients found matching filters.</p>
            ) : (
              <div className="grouped-employee-sections">
                {Object.values(activeByBillingModel)
                  .sort((a, b) => a.billingModelName.localeCompare(b.billingModelName))
                  .map(({ billingModelName, clients: clientsInModel }) => (
                    <div key={billingModelName} className="role-group-section" style={{ marginBottom: '2.5rem' }}>
                      <h5 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--brand-green)',
                        opacity: 0.9,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        paddingBottom: '0.5rem',
                      }}>
                        {billingModelName} <span style={{ opacity: 0.5, fontSize: '0.8rem', marginLeft: '6px' }}>({clientsInModel.length})</span>
                      </h5>
                      <div className={viewMode === 'grid' ? 'client-grid' : 'responsive-table-wrapper client-list'}>
                        {clientsInModel.map(client =>
                          viewMode === 'grid'
                            ? <ClientCard {...clientCardProps(client)} />
                            : <ClientListRow {...clientCardProps(client)} />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* INACTIVE SECTION */}
          {showInactive && (
            <div className="status-section inactive-section" style={{ marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                <h4 className="client-section-title" style={{ margin: 0, opacity: 0.5 }}>Inactive / History ({inactiveClients.length})</h4>
                <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>
              {inactiveClients.length === 0 ? (
                <p className="client-empty-sub-state" style={{ opacity: 0.3 }}>No inactive records.</p>
              ) : (
                <div className={viewMode === 'grid' ? 'client-grid' : 'client-list'} style={{ opacity: 0.6 }}>
                  {inactiveClients.map(client =>
                    viewMode === 'grid'
                      ? <ClientCard {...clientCardProps(client)} />
                      : <ClientListRow {...clientCardProps(client)} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit / View Modal */}
      <TaskModal
        isOpen={isAddModalOpen}
        onClose={handleCloseModal}
        title={isViewOnly ? 'View Client Record' : (editingClient ? 'Edit Client Record' : 'Add New Client')}
        className="large-modal"
      >
        <ClientForm
          onSubmit={handleSave}
          onCancel={handleCloseModal}
          isViewOnly={isViewOnly}
          initialData={editingClient ? {
            id: editingClient.id,
            name: editingClient.name,
            billing_model_id: editingClient.billing_model_id || '',
            category_matrix: editingClient.category_matrix || {},
            poc_name: editingClient.poc_name || '',
            poc_phone: editingClient.poc_phone || '',
            poc_email: editingClient.poc_email || '',
          } : {}}
          loading={isSaving}
        />
      </TaskModal>

      {/* Conflict Modal */}
      <ConflictModal
        isOpen={!!pendingConflict}
        onClose={() => setPendingConflict(null)}
        title="Potential Duplicate Detected"
        description="We found a similar client record. Are you sure you want to create a new entry?"
        conflicts={pendingConflict ? [pendingConflict.existingRecord] : []}
        strategy="REPLACE_ALL_OR_SELECT"
        entityName="Clients"
        onResolve={() => {
          const data = pendingConflict.formData;
          setPendingConflict(null);
          handleSave(data, true);
        }}
        renderConflictTile={(c) => (
          <div className="conflict-emp-tile">
            <h5 style={{ color: 'var(--brand-green)', margin: '0 0 4px 0' }}>{c.name}</h5>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{c.poc_email || 'No Email'}</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{c.poc_phone || 'No Phone'}</p>
          </div>
        )}
      />
    </>
  );
};

export default ClientManagement;
