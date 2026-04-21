import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import './Employees.css';
import EmployeeCSVDownload from './EmployeeCSVDownload';
import EmployeeCSVImport from './EmployeeCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';
import TaskModal from '../../components/TaskModal';
import EmployeeForm from './EmployeeForm';
import EmployeeCard from './EmployeeCard';
import EmployeeListRow from './EmployeeListRow';
import EmployeeTree from './EmployeeTree';
import EmployeeBulkUpdateModal from './EmployeeBulkUpdateModal';
import { useEmployees } from '../../hooks/useEmployees';
import { useManagementUI } from '../../hooks/useManagementUI';
import { matchesCriteria } from '../../utils/matchingAlgorithms';
import ConflictModal from '../../components/ConflictModal';
import { IconEdit, IconTrash, IconX, IconChevronDown } from '../../components/Icons';

/**
 * EmployeeManagement
 * 
 * The primary view for the Employee Manager vertical.
 * Displays employee records, profiles, and administrative summaries.
 */
const EmployeeManagement = ({ user, permissions, filters, setActiveVertical, onShowBottomNav, isSubSidebarOpen, setIsSubSidebarOpen }) => {
  const { employees, hubs, loading, fetchEmployees, addEmployee, updateEmployee, updateEmployeeHub, toggleStatus, deleteEmployee, bulkUpdateEmployees } = useEmployees();

  const ui = useManagementUI({ storageKey: 'powerpod_employee_view' });
  const [pendingConflict, setPendingConflict] = useState(null); // { formData, existingRecord }

  // Bulk Context
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (permissions?.canAccessEmployees) {
      fetchEmployees();
    }
  }, [fetchEmployees, permissions?.canAccessEmployees]);



  if (!permissions?.canAccessEmployees && !permissions?.scope === 'global') {
    return (
      <div className="empty-state-container">
        <div className="empty-state-icon">🔒</div>
        <h3>Access Restricted</h3>
        <p>You do not have permission to view the Employee List.</p>
      </div>
    );
  }

  const handleSave = async (formData, force = false) => {
    if (!force) {
      const matchingProbe = {
        full_name: formData.name,
        phone: formData.contactNumber,
        email: formData.emailId
      };

      const existingMatch = employees.find(emp =>
        emp.id !== (ui.editingItem?.id) &&
        matchesCriteria(matchingProbe, emp, {
          fields: ['full_name'],
          useFuzzy: true,
          threshold: 0.85,
          exactFields: ['phone']
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
        await updateEmployee(ui.editingItem.id, formData);
      } else {
        await addEmployee(formData);
      }
      ui.closeModal();
    } catch (err) {
      console.error('EmployeeManagement: Operation Error:', err);
      alert(`Operation failed: ${err.message}`);
    } finally {
      ui.setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this employee record?")) {
      try {
        await deleteEmployee(id);
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleBulkUpdate = async (updates) => {
    setIsBulkUpdating(true);
    try {
      await bulkUpdateEmployees(ui.selectedIds, updates);
      setIsBulkUpdateModalOpen(false);
      ui.clearSelection();
      alert(`Successfully updated ${ui.selectedIds.length} employees.`);
    } catch (err) {
      alert(`Bulk update failed: ${err.message}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = ui.showInactive || emp.status === 'Active';

    const matchesRole = !filters?.role?.length || filters.role.some(r =>
      r?.trim().toUpperCase() === emp.role_code?.trim().toUpperCase()
    );
    const matchesHub = !filters?.hub?.length || filters.hub.includes(emp.hub_id);
    const matchesDept = !filters?.department?.length || filters.department.some(d =>
      d?.trim().toUpperCase() === emp.dept_code?.trim().toUpperCase()
    );

    return matchesStatus && matchesRole && matchesHub && matchesDept;
  });

  const activeEmps = filteredEmployees.filter(emp => emp.status === 'Active');

  const activeEmpsByRole = activeEmps.reduce((acc, emp) => {
    const roleName = emp.role_code || emp.role || 'Unassigned Role';
    const seniorityNum = typeof emp.seniority_level === 'number' ? emp.seniority_level : 1;
    const sortKey = `${String(seniorityNum).padStart(3, '0')}|${roleName}`;

    if (!acc[sortKey]) acc[sortKey] = { roleName, overrideKey: sortKey, emps: [] };
    acc[sortKey].emps.push(emp);
    return acc;
  }, {});  const inactiveEmps = filteredEmployees.filter(emp => emp.status === 'Inactive');

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingEmployee(null);
    setIsViewOnly(false);
  };

  return (
    <>
      <MasterPageHeader
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={setIsSubSidebarOpen}
        onTrayVisibilityChange={handleTrayVisibilityChange}
        hideMenuClose={true}
        title="Employee Records Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        rightActions={
          permissions.canCreateEmployees && (
            <button className="halo-button master-action-btn" onClick={ui.openAddModal}>
              + Add Employee
            </button>
          )
        }
        canAdd={permissions.canCreateEmployees}
        onAddClick={ui.openAddModal}
        expandedLeft={
          <>
            <div className="view-mode-toggle">
              {['grid', 'list', 'tree'].map(mode => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${ui.viewMode === mode ? 'active' : ''}`}
                  onClick={() => ui.setViewMode(mode)}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                >
                  {mode === 'tree' ? 'Hierarchy' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              className={`halo-button toggle-inactive-btn ${ui.showInactive ? '' : 'hidden'}`}
              onClick={() => ui.setShowInactive(!ui.showInactive)}
              title={ui.showInactive ? "Hide Inactive" : "Show Inactive"}
            >
              <IconChevronDown size={14} style={{ marginRight: '4px', opacity: 0.8 }} />
              INACTIVE
            </button>
          </>
        }
        expandedRight={
          <>
            <EmployeeCSVDownload className="master-action-btn" data={employees} label="Export Team" />
            <EmployeeCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            {permissions.canCreateEmployees && (
              <EmployeeCSVImport className="master-action-btn" label="Import Team" onImportComplete={fetchEmployees} />
            )}
          </>
        }
      />

      {loading ? (
        <div className="loading-spinner">Loading Employees...</div>
      ) : employees.length === 0 ? (
        <div className="empty-state-container">
          <div className="empty-state-icon">👥</div>
          <h3>Personnel Database Empty</h3>
          <p>Click "+ Add Employee" to insert your first structural record.</p>
        </div>
      ) : ui.viewMode === 'tree' ? (
        <EmployeeTree
          employees={filteredEmployees}
          user={user}
          onEdit={ui.openEditModal}
          onView={ui.openViewModal}
          onDelete={handleDelete}
          onToggleStatus={toggleStatus}
          permissions={permissions}
          availableHubs={hubs}
          onUpdateHub={updateEmployeeHub}
          selectedIds={ui.selectedIds}
          onSelect={ui.handleSelectIndividual}
        />
      ) : (
        <div className="employees-container">
          {/* ACTIVE SECTION */}
          <div className="status-section">
            <h4 className="section-title">Active Team ({activeEmps.length})</h4>
            {activeEmps.length === 0 ? (
              <p className="empty-sub-state">No active employees found matching filters.</p>
            ) : (
              <div className="grouped-employee-sections">
                {Object.values(activeEmpsByRole)
                  .sort((a, b) => b.overrideKey.localeCompare(a.overrideKey))
                  .map(({ roleName, emps: empsInRole }) => (
                    <div key={roleName} className="role-group-section">
                      <h5 className="role-group-header">
                        <span>
                          {roleName} <span className="role-count">({empsInRole.length})</span>
                        </span>
                        <button
                          className="halo-button role-select-btn"
                          onClick={() => ui.handleSelectAll(empsInRole)}
                        >
                          {empsInRole.every(id => ui.selectedIds.includes(id.id)) ? 'Deselect Role' : 'Select Role'}
                        </button>
                      </h5>
                      <div className={ui.viewMode === 'grid' ? 'employee-grid' : 'responsive-table-wrapper employee-list'}>
                        {empsInRole.map(emp => (
                          ui.viewMode === 'grid' ? (
                            <EmployeeCard
                              key={emp.id}
                              emp={emp}
                              onEdit={ui.openEditModal}
                              onView={ui.openViewModal}
                              onDelete={handleDelete}
                              onToggleStatus={toggleStatus}
                              permissions={{
                                ...permissions,
                                canUpdate: permissions.canUpdateEmployees,
                                canDelete: permissions.canDeleteEmployees
                              }}
                              availableHubs={hubs}
                              onUpdateHub={updateEmployeeHub}
                              isSelected={ui.selectedIds.includes(emp.id)}
                              onSelect={ui.handleSelectIndividual}
                            />
                          ) : (
                            <EmployeeListRow
                              key={emp.id}
                              emp={emp}
                              onEdit={ui.openEditModal}
                              onView={ui.openViewModal}
                              onDelete={handleDelete}
                              onToggleStatus={toggleStatus}
                              permissions={{
                                ...permissions,
                                canUpdate: permissions.canUpdateEmployees,
                                canDelete: permissions.canDeleteEmployees
                              }}
                              availableHubs={hubs}
                              onUpdateHub={updateEmployeeHub}
                              isSelected={ui.selectedIds.includes(emp.id)}
                              onSelect={ui.handleSelectIndividual}
                              isExpanded={ui.expandedId === emp.id}
                              onToggleExpand={() => ui.setExpandedId(ui.expandedId === emp.id ? null : emp.id)}
                            />
                          )
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* INACTIVE SECTION */}
          {ui.showInactive && (
            <div className="status-section inactive-section">
              <div className="section-header-row">
                <h4 className="section-title inactive-title">Inactive / History ({inactiveEmps.length})</h4>
                <div className="section-divider"></div>
              </div>

              {inactiveEmps.length === 0 ? (
                <p className="empty-sub-state faded">No inactive records.</p>
              ) : (
                <div className={ui.viewMode === 'grid' ? 'employee-grid' : 'responsive-table-wrapper employee-list'}>
                  {inactiveEmps.map(emp => (
                    ui.viewMode === 'grid' ? (
                      <EmployeeCard
                        key={emp.id}
                        emp={emp}
                        onEdit={ui.openEditModal}
                        onView={ui.openViewModal}
                        onDelete={handleDelete}
                        onToggleStatus={toggleStatus}
                        permissions={permissions}
                        availableHubs={hubs}
                        onUpdateHub={updateEmployeeHub}
                      />
                    ) : (
                      <EmployeeListRow
                        key={emp.id}
                        emp={emp}
                        onEdit={ui.openEditModal}
                        onView={ui.openViewModal}
                        onDelete={handleDelete}
                        onToggleStatus={toggleStatus}
                        permissions={permissions}
                        availableHubs={hubs}
                        onUpdateHub={updateEmployeeHub}
                        isSelected={ui.selectedIds.includes(emp.id)}
                        onSelect={ui.handleSelectIndividual}
                        isExpanded={ui.expandedId === emp.id}
                        onToggleExpand={() => ui.setExpandedId(ui.expandedId === emp.id ? null : emp.id)}
                      />
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {ui.selectedIds.length > 0 && (
        <div className={`bulk-action-bar ${!ui.isTrayVisible ? 'tray-hidden' : ''}`}>
          <div className="bulk-info">
            {ui.selectedIds.length} Selected
          </div>
          <div className="bulk-actions">
            <button className="bulk-btn" onClick={() => setIsBulkUpdateModalOpen(true)} title="Bulk Update">
              <IconEdit size={18} />
              <span className="bulk-btn-text">Update</span>
            </button>
            <button className="bulk-btn cancel" onClick={ui.clearSelection} title="Cancel Selection">
              <IconX size={18} />
              <span className="bulk-btn-text">Cancel</span>
            </button>
          </div>
        </div>
      )}

      <TaskModal
        isOpen={ui.isAddModalOpen}
        onClose={ui.closeModal}
        title={ui.isViewOnly ? "View Employee Record" : (ui.editingItem ? "Edit Employee Record" : "Add New Employee Record")}
        className="large-modal"
      >
        <EmployeeForm
          onSubmit={handleSave}
          onCancel={ui.closeModal}
          isViewOnly={ui.isViewOnly}
          initialData={ui.editingItem ? {
            id: ui.editingItem.id,
            name: ui.editingItem.full_name,
            contactNumber: ui.editingItem.phone,
            emailId: ui.editingItem.email,
            gender: ui.editingItem.gender,
            dob: ui.editingItem.dob,
            doj: ui.editingItem.hire_date,
            hub_id: ui.editingItem.hub_id || 'ALL',
            role_id: ui.editingItem.role_id,
            department_id: ui.editingItem.department_id,
            accountNumber: ui.editingItem.account_number,
            ifscCode: ui.editingItem.ifsc_code,
            accountName: ui.editingItem.account_name,
            panNumber: ui.editingItem.pan_number,
            emp_code: ui.editingItem.emp_code,
            badge_id: ui.editingItem.badge_id,
            manager_id: ui.editingItem.manager_id
          } : {}}
          loading={ui.isSaving}
        />
      </TaskModal>

      <ConflictModal
        isOpen={!!pendingConflict}
        onClose={() => setPendingConflict(null)}
        title="Potential Duplicate Detected"
        description="We found a similar employee record in the database. Are you sure you want to create a new entry or update the existing one?"
        conflicts={pendingConflict ? [pendingConflict.existingRecord] : []}
        strategy="REPLACE_ALL_OR_SELECT"
        entityName="Employees"
        onResolve={() => {
          const data = pendingConflict.formData;
          setPendingConflict(null);
          handleSave(data, true); // Force save
        }}
        renderConflictTile={(emp) => (
          <div className="conflict-emp-tile">
            <h5 style={{ color: 'var(--brand-green)', margin: '0 0 4px 0' }}>{emp.full_name}</h5>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{emp.email || 'No Email'}</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{emp.phone || 'No Phone'}</p>
          </div>
        )}
      />

      <TaskModal
        isOpen={isBulkUpdateModalOpen}
        onClose={() => setIsBulkUpdateModalOpen(false)}
        title="Bulk Update Employees"
      >
        <EmployeeBulkUpdateModal
          selectedCount={ui.selectedIds.length}
          onUpdate={handleBulkUpdate}
          loading={isBulkUpdating}
        />
      </TaskModal>
    </>
  );
};

export default EmployeeManagement;
;
