import React, { useState } from 'react';
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

  const handleAddEmployee = async (formData) => {
    setIsSaving(true);
    console.log('Adding employee:', formData);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setIsAddModalOpen(false);
      alert('Employee record created successfully (Simulated)');
    }, 1000);
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

      <div className="empty-state" style={{ marginTop: '100px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
        <h3>Personnel Database Initializing</h3>
        <p>This section will house your full employee roster, including department links and functional roles.</p>
        <p style={{ marginTop: '1rem', color: 'var(--brand-green)', fontWeight: 600 }}>Stay tuned for the record management rollout.</p>
      </div>

      <TaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee Record"
      >
        <EmployeeForm onSubmit={handleAddEmployee} loading={isSaving} />
      </TaskModal>
    </>
  );
};

export default EmployeeManagement;
