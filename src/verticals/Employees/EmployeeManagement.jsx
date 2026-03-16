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
    <>
      <MasterPageHeader
        title="Employee Manager"
        description="Centralized database for personnel profiles, performance tracking, and organizational assignments."
        rightActions={
          <>
            <EmployeeCSVDownload className="master-action-btn" data={tasks} label="Export Employee Data" />
            <EmployeeCSVDownload className="master-action-btn" isTemplate label="Download Template" />
            <EmployeeCSVImport className="master-action-btn" onImportComplete={() => window.location.reload()} />
            <button className="halo-button master-action-btn" onClick={() => alert('Add Employee logic coming soon')}>
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
    </>
  );
};

export default EmployeeManagement;
