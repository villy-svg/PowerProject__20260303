import React from 'react';
import '../ChargingHubs/HubManagement.css'; // Use shared styles
import EmployeeCSVDownload from './EmployeeCSVDownload';
import EmployeeCSVImport from './EmployeeCSVImport';
import MasterPageHeader from '../../components/MasterPageHeader';

/**
 * EmployeeManagement
 * 
 * The primary view for the Employee Manager vertical.
 * Displays employee records, profiles, and administrative summaries.
 */
const EmployeeManagement = ({ user, permissions, tasks = [] }) => {
  return (
    <div className="hub-management-container" style={{ padding: 0 }}>
      <MasterPageHeader
        title="Employee Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        rightActions={
          <>
            <EmployeeCSVDownload className="add-hub-main-btn" data={tasks} label="Export Employee Data" />
            <EmployeeCSVDownload className="add-hub-main-btn" isTemplate label="Download Template" />
            <EmployeeCSVImport className="add-hub-main-btn" onImportComplete={() => window.location.reload()} />
            <button className="halo-button add-hub-main-btn" onClick={() => alert('Add Employee logic coming soon')}>
              + Add New Employee
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
    </div>
  );
};

export default EmployeeManagement;
