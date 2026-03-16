import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import '../ChargingHubs/HubManagement.css'; // Use shared styles
import './EmployeeManagement.css';
import EmployeeCSVDownload from './EmployeeCSVDownload';
import EmployeeCSVImport from './EmployeeCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';
import TaskModal from '../../components/TaskModal';
import EmployeeForm from './EmployeeForm';
import EmployeeCard from './EmployeeCard';
import EmployeeListRow from './EmployeeListRow';
import { useEmployees } from '../../hooks/useEmployees';
import { matchesCriteria } from '../../utils/matchingAlgorithms';
import ConflictModal from '../../components/ConflictModal';

/**
 * EmployeeManagement
 * 
 * The primary view for the Employee Manager vertical.
 * Displays employee records, profiles, and administrative summaries.
 */
const EmployeeManagement = ({ permissions, filters }) => {
  const { employees, loading, fetchEmployees, addEmployee, updateEmployee, toggleStatus, deleteEmployee } = useEmployees();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_employee_view') || 'grid');
  const [showInactive, setShowInactive] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [pendingConflict, setPendingConflict] = useState(null); // { formData, existingRecord }

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    localStorage.setItem('powerpod_employee_view', viewMode);
  }, [viewMode]);

  const handleSave = async (formData, force = false) => {
    if (!force) {
      // MASTER-SLAVE: Use master criteria logic
      // MASTER-SLAVE: Map form fields to match DB criteria
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
    setIsAddModalOpen(true);
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = showInactive || emp.status === 'Active';
    
    // Apply Subsidebar Filters
    const matchesRole = !filters?.role?.length || filters.role.includes(emp.role_code);
    const matchesHub = !filters?.hub?.length || filters.hub.includes(emp.hub_id);
    const matchesDept = !filters?.department?.length || filters.department.includes(emp.dept_code);

    return matchesStatus && matchesRole && matchesHub && matchesDept;
  });

  const isMasterAdmin = permissions?.roleId === 'master_admin';

  return (
    <>
      <MasterPageHeader
        title="Employee Records Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        leftActions={
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
              title={showInactive ? "Hide Inactive" : "Show Inactive"}
              style={{ fontWeight: 600, textDecoration: showInactive ? 'none' : 'line-through' }}
            >
              INAC
            </button>
          </>
        }
        rightActions={
          <>
            <EmployeeCSVDownload className="master-action-btn" data={employees} label="Export Team" />
            <EmployeeCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            <EmployeeCSVImport className="master-action-btn" label="Import Team" onImportComplete={fetchEmployees} />
            <button className="halo-button master-action-btn" onClick={() => { setEditingEmployee(null); setIsAddModalOpen(true); }}>
              + Add Employee
            </button>
          </>
        }
      />

      {loading ? (
        <div className="loading-spinner">Loading Employees...</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '50px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
          <h3>Personnel Database Empty</h3>
          <p>Click "+ Add Employee" to insert your first structural record.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'employee-grid' : 'employee-list'} style={{ marginTop: '1rem' }}>
          {filteredEmployees.map(emp => (
            viewMode === 'grid' ? (
              <EmployeeCard 
                key={emp.id} 
                emp={emp} 
                onEdit={openEditModal} 
                onDelete={handleDelete} 
                onToggleStatus={toggleStatus} 
                isMasterAdmin={isMasterAdmin} 
              />
            ) : (
              <EmployeeListRow 
                key={emp.id} 
                emp={emp} 
                onEdit={openEditModal} 
                onDelete={handleDelete} 
                onToggleStatus={toggleStatus} 
                isMasterAdmin={isMasterAdmin} 
              />
            )
          ))}
        </div>
      )}

      <TaskModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setEditingEmployee(null); }}
        title={editingEmployee ? "Edit Employee Record" : "Add New Employee Record"}
        className="large-modal"
      >
        <EmployeeForm 
          onSubmit={handleSave} 
          initialData={editingEmployee ? {
            id: editingEmployee.id,
            name: editingEmployee.full_name,
            contactNumber: editingEmployee.phone,
            emailId: editingEmployee.email,
            gender: editingEmployee.gender,
            dob: editingEmployee.dob,
            doj: editingEmployee.hire_date,
            hub_id: editingEmployee.hub_id,
            role: editingEmployee.role,
            department: editingEmployee.department,
            accountNumber: editingEmployee.account_number,
            ifscCode: editingEmployee.ifsc_code,
            accountName: editingEmployee.account_name
          } : {}}
          loading={isSaving} 
        />
      </TaskModal>

      {/* Unified Conflict Resolution Modal */}
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
    </>
  );
};

export default EmployeeManagement;
