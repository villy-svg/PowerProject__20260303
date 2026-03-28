import React, { useState, useEffect } from 'react';
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
import { matchesCriteria } from '../../utils/matchingAlgorithms';
import ConflictModal from '../../components/ConflictModal';

/**
 * EmployeeManagement
 * 
 * The primary view for the Employee Manager vertical.
 * Displays employee records, profiles, and administrative summaries.
 */
const EmployeeManagement = ({ user, permissions, filters }) => {
  const { employees, hubs, loading, fetchEmployees, addEmployee, updateEmployee, updateEmployeeHub, toggleStatus, deleteEmployee, bulkUpdateEmployees } = useEmployees();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_employee_view') || 'grid');
  const [showInactive, setShowInactive] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [pendingConflict, setPendingConflict] = useState(null); // { formData, existingRecord }

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  useEffect(() => {
    if (permissions?.canAccessEmployees) {
      fetchEmployees();
    }
  }, [fetchEmployees, permissions?.canAccessEmployees]);

  useEffect(() => {
    localStorage.setItem('powerpod_employee_view', viewMode);
  }, [viewMode]);

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
        emp.id !== (editingEmployee?.id) &&
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

    setIsSaving(true);
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, formData);
      } else {
        await addEmployee(formData);
      }
      setIsAddModalOpen(false);
      setEditingEmployee(null);
    } catch (err) {
      console.error('EmployeeManagement: Operation Error:', err);
      alert(`Operation failed: ${err.message}`);
    } finally {
      setIsSaving(false);
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

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setIsViewOnly(false);
    setIsAddModalOpen(true);
  };

  const openViewModal = (emp) => {
    setEditingEmployee(emp);
    setIsViewOnly(true);
    setIsAddModalOpen(true);
  };

  const handleSelectIndividual = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredEmps) => {
    const allFilteredIds = filteredEmps.map(e => e.id);
    const areAllSelected = allFilteredIds.every(id => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleBulkUpdate = async (updates) => {
    setIsBulkUpdating(true);
    try {
      await bulkUpdateEmployees(selectedIds, updates);
      setIsBulkUpdateModalOpen(false);
      setSelectedIds([]);
      alert(`Successfully updated ${selectedIds.length} employees.`);
    } catch (err) {
      alert(`Bulk update failed: ${err.message}`);
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = showInactive || emp.status === 'Active';

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
  }, {});

  const inactiveEmps = filteredEmployees.filter(emp => emp.status === 'Inactive');

  return (
    <>
      <MasterPageHeader
        title="Employee Records Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        leftActions={
          <>
            <div className="view-mode-toggle">
              {['grid', 'list', 'tree'].map(mode => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} View`}
                >
                  {mode === 'tree' ? 'Hierarchy' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>

            <button
              className={`halo-button toggle-inactive-btn ${showInactive ? '' : 'hidden'}`}
              onClick={() => setShowInactive(!showInactive)}
              title={showInactive ? "Hide Inactive" : "Show Inactive"}
            >
              INACTIVE
            </button>
          </>
        }
        rightActions={
          <>
            <EmployeeCSVDownload className="master-action-btn" data={employees} label="Export Team" />
            <EmployeeCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            {permissions.canCreateEmployees && (
              <>
                <EmployeeCSVImport className="master-action-btn" label="Import Team" onImportComplete={fetchEmployees} />
                <button className="halo-button master-action-btn" onClick={() => { setEditingEmployee(null); setIsAddModalOpen(true); }}>
                  + Add Employee
                </button>
              </>
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
      ) : viewMode === 'tree' ? (
        <EmployeeTree
          employees={filteredEmployees}
          user={user}
          onEdit={openEditModal}
          onView={openViewModal}
          onDelete={handleDelete}
          onToggleStatus={toggleStatus}
          permissions={permissions}
          availableHubs={hubs}
          onUpdateHub={updateEmployeeHub}
          selectedIds={selectedIds}
          onSelect={handleSelectIndividual}
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
                          onClick={() => handleSelectAll(empsInRole)}
                        >
                          {empsInRole.every(id => selectedIds.includes(id.id)) ? 'Deselect Role' : 'Select Role'}
                        </button>
                      </h5>
                      <div className={viewMode === 'grid' ? 'employee-grid' : 'responsive-table-wrapper employee-list'}>
                        {empsInRole.map(emp => (
                          viewMode === 'grid' ? (
                            <EmployeeCard
                              key={emp.id}
                              emp={emp}
                              onEdit={openEditModal}
                              onView={openViewModal}
                              onDelete={handleDelete}
                              onToggleStatus={toggleStatus}
                              permissions={{
                                ...permissions,
                                canUpdate: permissions.canUpdateEmployees,
                                canDelete: permissions.canDeleteEmployees
                              }}
                              availableHubs={hubs}
                              onUpdateHub={updateEmployeeHub}
                              isSelected={selectedIds.includes(emp.id)}
                              onSelect={handleSelectIndividual}
                            />
                          ) : (
                            <EmployeeListRow
                              key={emp.id}
                              emp={emp}
                              onEdit={openEditModal}
                              onView={openViewModal}
                              onDelete={handleDelete}
                              onToggleStatus={toggleStatus}
                              permissions={{
                                ...permissions,
                                canUpdate: permissions.canUpdateEmployees,
                                canDelete: permissions.canDeleteEmployees
                              }}
                              availableHubs={hubs}
                              onUpdateHub={updateEmployeeHub}
                              isSelected={selectedIds.includes(emp.id)}
                              onSelect={handleSelectIndividual}
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
          {showInactive && (
            <div className="status-section inactive-section">
              <div className="section-header-row">
                <h4 className="section-title inactive-title">Inactive / History ({inactiveEmps.length})</h4>
                <div className="section-divider"></div>
              </div>

              {inactiveEmps.length === 0 ? (
                <p className="empty-sub-state faded">No inactive records.</p>
              ) : (
                <div className={viewMode === 'grid' ? 'employee-grid' : 'responsive-table-wrapper employee-list'}>
                  {inactiveEmps.map(emp => (
                    viewMode === 'grid' ? (
                      <EmployeeCard
                        key={emp.id}
                        emp={emp}
                        onEdit={openEditModal}
                        onView={openViewModal}
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
                        onEdit={openEditModal}
                        onView={openViewModal}
                        onDelete={handleDelete}
                        onToggleStatus={toggleStatus}
                        permissions={permissions}
                        availableHubs={hubs}
                        onUpdateHub={updateEmployeeHub}
                        isSelected={selectedIds.includes(emp.id)}
                        onSelect={handleSelectIndividual}
                      />
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Bulk Action Toolbar */}
      {selectedIds.length > 0 && (
        <div className="bulk-action-toolbar">
          <div className="bulk-info">
            {selectedIds.length} Selected
          </div>
          <div className="bulk-actions">
            <button className="bulk-btn" onClick={() => setIsBulkUpdateModalOpen(true)}>
              Bulk Update
            </button>
            <button className="bulk-btn secondary" onClick={() => setSelectedIds([])}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <TaskModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingEmployee(null); setIsViewOnly(false); }}
        title={isViewOnly ? "View Employee Record" : (editingEmployee ? "Edit Employee Record" : "Add New Employee Record")}
        className="large-modal"
      >
        <EmployeeForm
          onSubmit={handleSave}
          isViewOnly={isViewOnly}
          initialData={editingEmployee ? {
            id: editingEmployee.id,
            name: editingEmployee.full_name,
            contactNumber: editingEmployee.phone,
            emailId: editingEmployee.email,
            gender: editingEmployee.gender,
            dob: editingEmployee.dob,
            doj: editingEmployee.hire_date,
            hub_id: editingEmployee.hub_id || 'ALL',
            role_id: editingEmployee.role_id,
            department_id: editingEmployee.department_id,
            accountNumber: editingEmployee.account_number,
            ifscCode: editingEmployee.ifsc_code,
            accountName: editingEmployee.account_name,
            panNumber: editingEmployee.pan_number,
            emp_code: editingEmployee.emp_code,
            badge_id: editingEmployee.badge_id,
            manager_id: editingEmployee.manager_id
          } : {}}
          loading={isSaving}
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
          selectedCount={selectedIds.length}
          onUpdate={handleBulkUpdate}
          loading={isBulkUpdating}
        />
      </TaskModal>
    </>
  );
};

export default EmployeeManagement;
