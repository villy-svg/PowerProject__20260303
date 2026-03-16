import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import '../ChargingHubs/HubManagement.css'; // Use shared styles
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

  useEffect(() => {
    fetchEmployees();
  }, []);

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

  return (
    <>
      <MasterPageHeader
        title="Employee Records Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        rightActions={
          <>
            <EmployeeCSVDownload className="master-action-btn" data={tasks} label="Export Team" />
            <EmployeeCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            <EmployeeCSVImport className="master-action-btn" label="Import Team" onImportComplete={() => window.location.reload()} />
            <button className="halo-button master-action-btn" onClick={() => setIsAddModalOpen(true)}>
              + Add Employee
            </button>
          </>
        }
      />

      {loading ? (
        <div className="loading-spinner">Loading Employees...</div>
      ) : employees.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '50px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
          <h3>Personnel Database Empty</h3>
          <p>Click "+ Add Employee" to insert your first structural record.</p>
        </div>
      ) : (
        <div className="hubs-grid" style={{ marginTop: '2rem' }}>
          {employees.map(emp => (
            <div key={emp.id} className={`hub-card ${emp.status === 'Inactive' ? 'inactive' : ''}`}>
              <div className="hub-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="hub-code-tag" style={{ margin: 0 }}>
                  {emp.department || 'NO DEPT'} | {emp.role || 'NO ROLE'}
                </div>
                <button 
                  className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
                  style={{ padding: '4px 12px', fontSize: '0.8rem', minWidth: 'auto' }}
                  onClick={() => toggleStatus(emp.id, emp.status)}
                >
                  {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
              <h3 style={{ margin: '0.5rem 0' }}>{emp.full_name}</h3>
              <p className="hub-city" style={{ margin: 0, opacity: 0.8 }}>
                📞 {emp.phone} <br />
                {emp.email && `✉️ ${emp.email}`}
              </p>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', opacity: 0.7 }}>
                Joined: {emp.hire_date || 'N/A'} <br />
                Status: <span style={{ color: emp.status === 'Active' ? 'var(--brand-green)' : '#ff4444', fontWeight: 'bold' }}>{emp.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee Record"
        className="large-modal"
      >
        <EmployeeForm onSubmit={handleAddEmployee} loading={isSaving} />
      </TaskModal>
    </>
  );
};

export default EmployeeManagement;
