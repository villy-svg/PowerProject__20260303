import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import '../ChargingHubs/HubManagement.css'; // Use shared styles
import './EmployeeManagement.css';
import EmployeeCSVDownload from './EmployeeCSVDownload';
import EmployeeCSVImport from './EmployeeCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';
import TaskModal from '../../components/TaskModal';
import EmployeeForm from './EmployeeForm';

/**
 * EmployeeManagement
 * 
 * The primary view for the Employee Manager vertical.
 * Displays employee records, profiles, and administrative summaries.
 */
const EmployeeManagement = ({ user, permissions, tasks = [] }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_employee_view') || 'grid');
  const [showInactive, setShowInactive] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    localStorage.setItem('powerpod_employee_view', viewMode);
  }, [viewMode]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true });
      
    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      setEmployees(data || []);
    }
    setLoading(false);
  };

  const handleAddEmployee = async (formData) => {
    setIsSaving(true);
    const employeeData = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: formData.hub_id || null,
      role: formData.role || null,
      department: formData.department || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      status: 'Active',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('employees').insert([employeeData]);
    
    if (error) {
      alert(`Error adding employee: ${error.message}`);
    } else {
      setIsAddModalOpen(false);
      fetchEmployees();
    }
    setIsSaving(false);
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    
    // Optimistic UI update
    setEmployees(prev => prev.map(emp => 
      emp.id === id ? { ...emp, status: newStatus } : emp
    ));

    const { error } = await supabase
      .from('employees')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      alert(`Status update failed: ${error.message}`);
      // Revert optimism on error
      fetchEmployees();
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this employee record?")) return;
    
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      alert(`Delete failed: ${error.message}`);
    } else {
      setEmployees(prev => prev.filter(emp => emp.id !== id));
    }
  };

  const [editingEmployee, setEditingEmployee] = useState(null);
  
  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setIsAddModalOpen(true);
  };

  const handleUpdateEmployee = async (formData) => {
    if (!editingEmployee) return;
    setIsSaving(true);
    
    const updateData = {
      full_name: formData.name,
      phone: formData.contactNumber,
      email: formData.emailId || null,
      gender: formData.gender,
      dob: formData.dob,
      hire_date: formData.doj || null,
      hub_id: formData.hub_id || null,
      role: formData.role || null,
      department: formData.department || null,
      account_number: formData.accountNumber,
      ifsc_code: formData.ifscCode,
      account_name: formData.accountName,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', editingEmployee.id);
    
    if (error) {
      alert(`Error updating employee: ${error.message}`);
    } else {
      setIsAddModalOpen(false);
      setEditingEmployee(null);
      fetchEmployees();
    }
    setIsSaving(false);
  };

  const filteredEmployees = employees.filter(emp => showInactive || emp.status === 'Active');
  const isMasterAdmin = permissions?.roleId === 'master_admin';

  return (
    <>
      <MasterPageHeader
        title="Employee Records Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        leftActions={
          <>
            <div className="view-mode-toggle">
              <button 
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                Grid
              </button>
              <button 
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                List
              </button>
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
              <div key={emp.id} className={`employee-card ${emp.status === 'Inactive' ? 'inactive' : ''}`}>
                <div className="employee-card-badges">
                  <span className="dept-badge">{emp.department || 'NO DEPT'}</span>
                  <span className="role-badge">{emp.role || 'NO ROLE'}</span>
                  <div style={{ marginLeft: 'auto' }} className="employee-actions">
                    {isMasterAdmin && (
                      <>
                        <button className="action-icon-btn edit" onClick={() => handleEditEmployee(emp)} title="Edit">✎</button>
                        <button className="action-icon-btn delete" onClick={() => handleDeleteEmployee(emp.id)} title="Delete">×</button>
                      </>
                    )}
                    <button 
                      className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
                      style={{ padding: '2px 10px', fontSize: '0.7rem', minWidth: 'auto', marginLeft: '4px' }}
                      onClick={() => toggleStatus(emp.id, emp.status)}
                    >
                      {emp.status === 'Active' ? 'OFF' : 'ON'}
                    </button>
                  </div>
                </div>
                
                <h3 className="employee-card-name">{emp.full_name}</h3>
                
                <div className="employee-card-contact">
                  <span>📞 {emp.phone}</span>
                  {emp.email && <span>✉️ {emp.email}</span>}
                </div>

                <div className="employee-card-footer">
                  <div className="join-date">Joined: {emp.hire_date || 'N/A'}</div>
                  <div className="employee-status" style={{ color: emp.status === 'Active' ? 'var(--brand-green)' : '#ff4444' }}>
                    {emp.status}
                  </div>
                </div>
              </div>
            ) : (
              <div key={emp.id} className={`employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''}`}>
                <div className="list-main-info">
                  <div className="list-name">{emp.full_name}</div>
                  <div className="list-meta-badges">
                    <span className="dept-badge">{emp.department || 'DEPT'}</span>
                    <span className="role-badge">{emp.role || 'ROLE'}</span>
                  </div>
                  <div className="list-contact">
                    {emp.phone} {emp.email && `| ${emp.email}`}
                  </div>
                </div>

                <div className="employee-actions">
                  <div className="employee-status" style={{ color: emp.status === 'Active' ? 'var(--brand-green)' : '#ff4444', fontSize: '0.75rem', fontWeight: 700, marginRight: '1rem', alignSelf: 'center' }}>
                    {emp.status}
                  </div>
                  {isMasterAdmin && (
                    <>
                      <button className="action-icon-btn edit" onClick={() => handleEditEmployee(emp)} title="Edit">✎</button>
                      <button className="action-icon-btn delete" onClick={() => handleDeleteEmployee(emp.id)} title="Delete">×</button>
                    </>
                  )}
                  <button 
                    className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
                    style={{ padding: '4px 12px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '8px' }}
                    onClick={() => toggleStatus(emp.id, emp.status)}
                  >
                    {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
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
          onSubmit={editingEmployee ? handleUpdateEmployee : handleAddEmployee} 
          initialData={editingEmployee ? {
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
    </>
  );
};

export default EmployeeManagement;
