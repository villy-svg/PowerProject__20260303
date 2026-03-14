import React from 'react';
import '../ChargingHubs/HubManagement.css'; 
import EmployeeCSVDownload from './EmployeeCSVDownload';
import EmployeeCSVImport from './EmployeeCSVImport';

const EmployeeManagement = ({ user, permissions, tasks = [] }) => {
  console.log('🚩 DEBUG: EmployeeManagement Rendered', { user: !!user, tasksCount: tasks?.length });

  return (
    <div className="hub-management-container" style={{ padding: '20px', border: '2px solid red' }}>
      <header className="hub-header" style={{ border: '1px solid blue' }}>
        <div className="header-info">
          <h1>Employee Records [DEBUG ACTIVE]</h1>
          <p>If you see this red border, the component is rendering.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,0,0,0.1)' }}>
          <EmployeeCSVDownload data={tasks} label="DOWNLOAD DATA" />
          <EmployeeCSVDownload isTemplate label="DOWNLOAD TEMPLATE" />
          <EmployeeCSVImport onImportComplete={() => window.location.reload()} />
          <button className="halo-button add-hub-main-btn" onClick={() => alert('Add Employee')}>
            + ADD NEW EMPLOYEE
          </button>
        </div>
      </header>

      <div className="empty-state" style={{ marginTop: '50px' }}>
        <h3>Records View</h3>
        <p>User Role: {user?.roleId || 'Unknown'}</p>
        <p>Tasks Loaded: {tasks?.length || 0}</p>
      </div>
    </div>
  );
};

export default EmployeeManagement;
