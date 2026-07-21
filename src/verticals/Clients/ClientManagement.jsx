import React, { useState, useEffect } from 'react';
import { useClients } from '../../hooks/useClients';
import '../ChargingHubs/HubManagement.css';
import './ClientManagement.css';
import ClientCSVDownload from './ClientCSVDownload';
import ClientCSVImport from './ClientCSVImport';
import MasterPageHeader from '../../components/layout/MasterPageHeader';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { IconChevronDown, IconPlus } from '../../components/ui/Icons';
import TaskModal from '../../components/modals/TaskModal';
import ClientForm from './ClientForm';
import ClientCard from './ClientCard';
import ClientListRow from './ClientListRow';
import ConflictModal from '../../components/modals/ConflictModal';
import { useManagementUI } from '../../hooks/useManagementUI';
import { matchesCriteria } from '../../utils/matchingAlgorithms';
import RBACManageButton from '../../components/ui/RBACManageButton';

/**
 * ClientManagement
 *
 * Primary view for the Client Manager vertical.
 * Displays client records grouped by category.
 */
const ClientManagement = ({ user, permissions, filters, tasks = [], setActiveVertical, onShowBottomNav, isSubSidebarOpen, setIsSubSidebarOpen, SidebarComponent, onFilterChange, onReset, onBatchFilter, verticals, activeVertical }) => {
  const { clients, categories, billingModels, loading, fetchClients, addClient, updateClient, toggleStatus, deleteClient } = useClients();

  const ui = useManagementUI({ storageKey: 'powerpod_client_view' });
  const [pendingConflict, setPendingConflict] = useState(null);
  const isScrollVisible = useScrollDirection(10, 100);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);

  useEffect(() => {
    if (permissions?.canAccessClients) {
      fetchClients();
    }
  }, [fetchClients, permissions?.canAccessClients]);

  if (!permissions?.canAccessClients && !(permissions?.scope === 'global')) {
    return (
      <div className="empty-state client-management__loading-center">
        <div className="client-management__loading-icon">🔒</div>
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
        c.id !== (ui.editingItem?.id) &&
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

    ui.setIsSaving(true);
    try {
      if (ui.editingItem) {
        await updateClient(ui.editingItem.id, formData);
      } else {
        await addClient(formData);
      }
      ui.closeModal();
    } catch (err) {
      console.error('ClientManagement: Operation Error:', err);
      alert(`Operation failed: ${err.message}`);
    } finally {
      ui.setIsSaving(false);
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

  // Apply filters from sub-sidebar
  const filteredClients = clients.filter(c => {
    const matchesStatus = ui.showInactive || c.status === 'Active';
    
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

  return (
    <>
      <MasterPageHeader
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        hideMenuClose={true}
        title="Client Records Manager"
        description="Centralized database for client profiles, billing arrangements, and point-of-contact information."
        SidebarComponent={SidebarComponent}
        onFilterChange={onFilterChange}
        onReset={onReset}
        onBatchFilter={onBatchFilter}
        filters={filters}
        tasks={tasks}
        permissions={permissions}
        user={user}
        verticals={verticals}
        activeVertical={activeVertical}
        rightActions={
          <>
            {permissions.canCreateClients && (
              <button
                className="halo-button master-action-btn"
                onClick={ui.openAddModal}
              >
                + Add Client
              </button>
            )}
            {/* Master Admin: Manage RBAC for Clients List */}
            <RBACManageButton
              user={user}
              verticalId="clients"
              featureId="canAccessClients"
              label="Clients List"
            />
          </>
        }
        canAdd={permissions.canCreateClients}
        onAddClick={ui.openAddModal}
        expandedLeft={
          <>
            <div className="view-mode-toggle">
              {['grid', 'list'].map(mode => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${ui.viewMode === mode ? 'active' : ''}`}
                  onClick={() => ui.setViewMode(mode)}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              className={`halo-button toggle-depri-btn ${!ui.showInactive ? 'active' : ''}`}
              onClick={() => ui.setShowInactive(!ui.showInactive)}
              title={ui.showInactive ? 'Hide Inactive' : 'Show Inactive'}
              style={{ fontWeight: 600, textDecoration: ui.showInactive ? 'none' : 'line-through' }}
            >
              <IconChevronDown size={14} className="u-mr-4 u-opacity-80" />
              INACTIVE
            </button>
          </>
        }
        expandedRight={
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
                  <ClientCSVDownload data={clients} label="Export Clients" className="master-action-btn" />
                  <ClientCSVDownload isTemplate label="Download Template" className="master-action-btn" />
                  {permissions.canCreateClients && (
                    <ClientCSVImport label="Import Clients" onImportComplete={() => {
                      fetchClients();
                      setIsActionsDropdownOpen(false);
                    }} className="master-action-btn" />
                  )}
                </div>
              )}
            </div>
          </div>
        }
      />

      {loading ? (
        <div className="loading-spinner">Loading Clients...</div>
      ) : clients.length === 0 ? (
        <div className="empty-state u-mt-3rem">
          <div className="client-management__empty-icon">🏢</div>
          <h3>Client Database Empty</h3>
          <p>Click "+ Add Client" to insert your first client record.</p>
        </div>
      ) : (
        <div className="u-mt-1rem">
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
                    <div key={billingModelName} className="role-group-section client-management__content-area">
                      <h5 className="client-management__section-header">
                        {billingModelName} <span className="u-opacity-50 u-text-xs u-ml-6">({clientsInModel.length})</span>
                      </h5>
                      <div className={ui.viewMode === 'grid' ? 'client-grid' : 'responsive-table-wrapper client-list'}>
                        {clientsInModel.map(client => {
                          const props = {
                            client,
                            tasks: tasks.filter(t => t.assigned_client_id === client.id),
                            onEdit: ui.openEditModal,
                            onView: ui.openViewModal,
                            onDelete: handleDelete,
                            onToggleStatus: toggleStatus,
                            permissions: {
                              ...permissions,
                              canUpdate: permissions.canUpdateClients,
                              canDelete: permissions.canDeleteClients
                            }
                          };
                          return ui.viewMode === 'grid'
                            ? <ClientCard key={client.id} {...props} />
                            : <ClientListRow 
                                key={client.id} 
                                {...props} 
                                isExpanded={ui.expandedId === client.id}
                                onToggleExpand={() => ui.setExpandedId(ui.expandedId === client.id ? null : client.id)}
                              />;
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* INACTIVE SECTION */}
          {ui.showInactive && (
            <div className="status-section inactive-section client-management__inactive-section">
              <div className="u-flex-center-gap-10 u-mb-24">
                <h4 className="client-section-title u-m-0 u-opacity-50">Inactive / History ({inactiveClients.length})</h4>
                <div className="client-management__divider-line" />
              </div>
              {inactiveClients.length === 0 ? (
                <p className="client-empty-sub-state u-opacity-30">No inactive records.</p>
              ) : (
                <div className={ui.viewMode === 'grid' ? 'client-grid' : 'client-list'} style={{ opacity: 0.6 }}>
                  {inactiveClients.map(client => {
                    const props = {
                      client,
                      tasks: tasks.filter(t => t.assigned_client_id === client.id),
                      onEdit: ui.openEditModal,
                      onView: ui.openViewModal,
                      onDelete: handleDelete,
                      onToggleStatus: toggleStatus,
                      permissions: {
                        ...permissions,
                        canUpdate: permissions.canUpdateClients,
                        canDelete: permissions.canDeleteClients
                      }
                    };
                    return ui.viewMode === 'grid'
                      ? <ClientCard key={client.id} {...props} />
                      : <ClientListRow 
                          key={client.id} 
                          {...props} 
                          isExpanded={ui.expandedId === client.id}
                          onToggleExpand={() => ui.setExpandedId(ui.expandedId === client.id ? null : client.id)}
                        />;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit / View Modal */}
      <TaskModal
        isOpen={ui.isAddModalOpen}
        onClose={ui.closeModal}
        title={ui.isViewOnly ? 'View Client Record' : (ui.editingItem ? 'Edit Client Record' : 'Add New Client')}
        className="large-modal"
      >
        <ClientForm
          onSubmit={handleSave}
          onCancel={ui.closeModal}
          isViewOnly={ui.isViewOnly}
          initialData={ui.editingItem ? {
            id: ui.editingItem.id,
            name: ui.editingItem.name,
            billing_model_id: ui.editingItem.billing_model_id || '',
            category_matrix: ui.editingItem.category_matrix || {},
            poc_name: ui.editingItem.poc_name || '',
            poc_phone: ui.editingItem.poc_phone || '',
            poc_email: ui.editingItem.poc_email || '',
          } : {}}
          loading={ui.isSaving}
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
            <h5 className="u-text-brand-green u-m-0 u-mb-4">{c.name}</h5>
            <p className="u-text-sm u-opacity-70">{c.poc_email || 'No Email'}</p>
            <p className="u-text-sm u-opacity-70">{c.poc_phone || 'No Phone'}</p>
          </div>
        )}
      />
    </>
  );
};

export default ClientManagement;
