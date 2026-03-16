import React from 'react';

/**
 * EmployeeCard
 * Grid/Tile view item for an employee.
 */
const EmployeeCard = ({ emp, onEdit, onDelete, onToggleStatus, isMasterAdmin }) => {
  return (
    <div 
      className={`employee-card ${emp.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onEdit(emp)}
      title="Double-click to edit"
    >
      <div className="employee-card-badges">
        {emp.isDuplicate && (
          <span className="duplicate-badge" title={`${emp.duplicateCount} potential duplicates found`}>DUP</span>
        )}
        <span className="dept-badge">{emp.dept_code || emp.department || 'NO DEPT'}</span>
        <span className="hub-badge">{emp.hub_code || 'NO HUB'}</span>
        <span className="role-badge">{emp.role_code || emp.role || 'NO ROLE'}</span>
        <div style={{ marginLeft: 'auto' }} className="employee-actions">
          <button 
            className="action-icon-btn edit-pencil" 
            onClick={() => onEdit(emp)} 
            title="Edit Employee"
            style={{ opacity: 0.5, filter: 'grayscale(1)' }}
          >
            ✎
          </button>
          {isMasterAdmin && (
            <button className="action-icon-btn delete" onClick={() => onDelete(emp.id)} title="Delete">×</button>
          )}
          <button 
            className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
            style={{ padding: '2px 10px', fontSize: '0.7rem', minWidth: 'auto', marginLeft: '4px' }}
            onClick={() => onToggleStatus(emp.id, emp.status)}
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
  );
};

export default EmployeeCard;
