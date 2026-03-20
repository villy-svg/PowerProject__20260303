import React, { useState } from 'react';

/**
 * EmployeeCard
 * Grid/Tile view item for an employee.
 */
const EmployeeCard = ({ emp, onEdit, onView, onDelete, onToggleStatus, permissions = {}, availableHubs, onUpdateHub }) => {
  const [isEditingHub, setIsEditingHub] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState(emp.hub_id || 'ALL');

  const handleHubDoubleClick = (e) => {
    e.stopPropagation();
    if (!permissions.canUpdate) return;
    setIsEditingHub(true);
    setSelectedHubId(emp.hub_id || 'ALL');
  };

  const handleHubChange = async (e) => {
    e.stopPropagation();
    const newHubId = e.target.value;
    setSelectedHubId(newHubId);
    setIsEditingHub(false);
    if (onUpdateHub && newHubId !== (emp.hub_id || 'ALL')) {
      await onUpdateHub(emp.id, newHubId);
    }
  };

  const handleHubBlur = () => {
    setIsEditingHub(false);
  };

  return (
    <div 
      className={`employee-card ${emp.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(emp)}
      title="Double-click to view"
    >
      <div className="employee-card-badges">
        {emp.isDuplicate && (
          <span className="duplicate-badge" title={`${emp.duplicateCount} potential duplicates found`}>DUP</span>
        )}
        {!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number ? (
          <span className="bank-missing-badge" style={{ 
            backgroundColor: 'rgba(255, 68, 68, 0.1)', 
            color: '#ff4444', 
            border: '1px solid rgba(255, 68, 68, 0.4)',
            padding: '2px 8px', 
            borderRadius: '20px', 
            fontSize: '0.65rem', 
            fontWeight: 800,
            textTransform: 'uppercase'
          }}>Bank Missing</span>
        ) : null}
        <span className="dept-badge">{emp.dept_code || emp.department || 'NO DEPT'}</span>
        <span 
          className="hub-badge" 
          onDoubleClick={handleHubDoubleClick} 
          title="Double-click to change primary hub"
          style={{ cursor: 'pointer', padding: isEditingHub ? '0 4px' : undefined }}
        >
          {isEditingHub ? (
            <select 
              value={selectedHubId} 
              onChange={handleHubChange} 
              onBlur={handleHubBlur}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              style={{ 
                background: 'var(--card-bg, #1a1a1a)', 
                color: 'inherit', 
                border: 'none', 
                outline: 'none', 
                cursor: 'pointer',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                fontWeight: 'inherit'
              }}
            >
              <option value="ALL">ALL</option>
              {availableHubs?.map(h => <option key={h.id} value={h.id}>{h.hub_code}</option>)}
            </select>
          ) : (
            emp.hub_code || 'NO HUB'
          )}
        </span>
        <span className="role-badge">{emp.role_code || emp.role || 'NO ROLE'}</span>
        <div style={{ marginLeft: 'auto' }} className="employee-actions">
          {permissions.canUpdate && (
            <button 
              className="action-icon-btn edit-pencil" 
              onClick={() => onEdit(emp)} 
              title="Edit Employee"
              style={{ opacity: 0.5, filter: 'grayscale(1)' }}
            >
              ✎
            </button>
          )}
          {permissions.canDelete && (
            <button className="action-icon-btn delete" onClick={() => onDelete(emp.id)} title="Delete">×</button>
          )}
          {permissions.canUpdate && (
            <button 
              className={`halo-button ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
              style={{ padding: '2px 10px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '4px', fontWeight: 900 }}
              onClick={() => onToggleStatus(emp.id, emp.status)}
              title={emp.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
            >
              {emp.status === 'Active' ? '↓' : '↑'}
            </button>
          )}
        </div>
      </div>
      
      <h3 className="employee-card-name">{emp.full_name}</h3>
      
      <div className="employee-card-contact" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: 'inherit' }}>ID: {emp.badge_id}</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span>📞 {emp.phone ? (emp.phone.toString().startsWith('+91') ? emp.phone : `+91 ${emp.phone.toString().replace(/^\+?91/, '').trim()}`) : 'N/A'}</span>
        {emp.email && (
          <>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>✉️ {emp.email}</span>
          </>
        )}
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
