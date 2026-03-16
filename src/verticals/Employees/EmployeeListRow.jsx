import React from 'react';

/**
 * EmployeeListRow
 * Row view item for an employee.
 */
const EmployeeListRow = ({ emp, onEdit, onDelete, onToggleStatus, isMasterAdmin }) => {
  return (
    <div className={`employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''}`}>
      <div className="list-main-info">
        <div className="list-name">
          {emp.full_name}
          {emp.isDuplicate && (
            <span className="duplicate-badge-mini" style={{ marginLeft: '8px' }} title={`${emp.duplicateCount} potential duplicates found`}>DUP</span>
          )}
        </div>
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
            <button className="action-icon-btn edit" onClick={() => onEdit(emp)} title="Edit">✎</button>
            <button className="action-icon-btn delete" onClick={() => onDelete(emp.id)} title="Delete">×</button>
          </>
        )}
        <button 
          className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
          style={{ padding: '4px 12px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '8px' }}
          onClick={() => onToggleStatus(emp.id, emp.status)}
        >
          {emp.status === 'Active' ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
};

export default EmployeeListRow;
