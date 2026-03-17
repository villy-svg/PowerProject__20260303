import React from 'react';

/**
 * EmployeeListRow
 * Row view item for an employee.
 */
const EmployeeListRow = ({ emp, onEdit, onView, onDelete, onToggleStatus, isMasterAdmin }) => {
  return (
    <div 
      className={`employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(emp)}
      title="Double-click to view"
    >
      <div className="list-main-info">
        <div className="list-name">
          {emp.full_name}
          {emp.isDuplicate && (
            <span className="duplicate-badge-mini" style={{ marginLeft: '8px' }} title={`${emp.duplicateCount} potential duplicates found`}>DUP</span>
          )}
          {(!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number) && (
            <span className="bank-missing-badge-mini" style={{ 
              marginLeft: '8px', 
              backgroundColor: 'rgba(255, 68, 68, 0.1)', 
              color: '#ff4444', 
              border: '1px solid rgba(255, 68, 68, 0.4)',
              padding: '1px 6px', 
              borderRadius: '20px', 
              fontSize: '0.6rem', 
              fontWeight: 800,
              textTransform: 'uppercase'
            }}>Bank Missing</span>
          )}
        </div>
        <div className="list-meta-badges">
          <span className="dept-badge">{emp.dept_code || emp.department || 'NO DEPT'}</span>
          <span className="hub-badge">{emp.hub_code || 'NO HUB'}</span>
          <span className="role-badge">{emp.role_code || emp.role || 'NO ROLE'}</span>
        </div>
        <div className="list-contact" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'inherit', marginRight: '8px' }}>ID: {emp.badge_id}</span>
          <span style={{ opacity: 0.3, marginRight: '8px' }}>|</span>
          <span style={{ marginRight: '8px' }}>📞 {emp.phone ? (emp.phone.toString().startsWith('+91') ? emp.phone : `+91 ${emp.phone.toString().replace(/^\+?91/, '').trim()}`) : 'N/A'}</span>
          {emp.email && (
            <>
              <span style={{ opacity: 0.3, marginRight: '8px' }}>|</span>
              <span>✉️ {emp.email}</span>
            </>
          )}
        </div>
      </div>

      <div className="employee-actions">
        <div className="employee-status" style={{ color: emp.status === 'Active' ? 'var(--brand-green)' : '#ff4444', fontSize: '0.75rem', fontWeight: 700, marginRight: '1rem', alignSelf: 'center', opacity: emp.status === 'Active' ? 1 : 0.5 }}>
          {emp.status}
        </div>
        <button 
          className="action-icon-btn edit-pencil" 
          onClick={() => onEdit(emp)} 
          title="Edit Employee"
          style={{ opacity: 0.5, filter: 'grayscale(1)', marginRight: '4px' }}
        >
          ✎
        </button>
        {isMasterAdmin && (
          <button className="action-icon-btn delete" onClick={() => onDelete(emp.id)} title="Delete">×</button>
        )}
        <button 
          className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
          style={{ padding: '2px 10px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '8px', fontWeight: 900 }}
          onClick={() => onToggleStatus(emp.id, emp.status)}
          title={emp.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
        >
          {emp.status === 'Active' ? '↓' : '↑'}
        </button>
      </div>
    </div>
  );
};

export default EmployeeListRow;
