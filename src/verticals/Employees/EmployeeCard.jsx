import React, { useState } from 'react';

/**
 * EmployeeCard
 * Grid/Tile view item for an employee.
 */
const EmployeeCard = ({ 
  emp, 
  onEdit, 
  onView, 
  onDelete, 
  onToggleStatus, 
  permissions = {}, 
  availableHubs, 
  onUpdateHub,
  isSelected = false,
  onSelect,
  className = ''
}) => {
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
      className={`employee-card ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${className}`}
      onDoubleClick={() => onView(emp)}
      title="Double-click to view"
    >
      <div className="employee-card-badges">
        {emp.is_app_user && (
          <span className="app-user-badge-mini" title="Has App Access">APP USER</span>
        )}
        {emp.isDuplicate && (
          <span className="duplicate-badge-mini" title={`${emp.duplicateCount} potential duplicates found`}>DUP</span>
        )}
        {(!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number) && (
          <span className="bank-missing-badge-mini">Bank Missing</span>
        )}
      </div>

      <div className="selection-area card-selection" onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
        <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>

      <div className="employee-card-header">
        <div className="card-main-meta">
          <span className="dept-badge">{emp.dept_code || emp.department || 'NO DEPT'}</span>
          <span 
            className={`hub-badge ${!emp.hub_id ? 'null-hub' : ''} ${isEditingHub ? 'editing' : ''}`} 
            onDoubleClick={handleHubDoubleClick} 
            title="Double-click to change primary hub"
          >
            {isEditingHub ? (
              <select 
                value={selectedHubId} 
                onChange={handleHubChange} 
                onBlur={handleHubBlur}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="hub-select-mini"
              >
                <option value="ALL">ALL</option>
                {availableHubs?.map(h => <option key={h.id} value={h.id}>{h.hub_code}</option>)}
              </select>
            ) : (
              emp.hub_code || 'NO HUB'
            )}
          </span>
          <span className="role-badge">{emp.role_code || emp.role || 'NO ROLE'}</span>
        </div>
        <div className="card-status-actions">
          <div className={`employee-status-indicator ${emp.status === 'Active' ? 'active' : 'inactive'}`}>
            {emp.status}
          </div>
          {permissions.canUpdate && (
            <button 
              className={`halo-button status-toggle-btn ${emp.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
              onClick={() => onToggleStatus(emp.id, emp.status)}
              title={emp.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
            >
              {emp.status === 'Active' ? '↓' : '↑'}
            </button>
          )}
        </div>
      </div>
      
      <h3 className="employee-card-name">{emp.full_name}</h3>
      
      <div className="employee-card-contact">
        <span><span className="contact-label">ID:</span> {emp.badge_id}</span>
        <span>📞 {emp.phone ? (emp.phone.toString().startsWith('+91') ? emp.phone : `+91 ${emp.phone.toString().replace(/^\+?91/, '').trim()}`) : 'N/A'}</span>
        {emp.email && (
          <span>✉️ {emp.email}</span>
        )}
        {emp.manager_name && emp.manager_name !== 'None' && (
          <span className="manager-info">👤 Mgr: {emp.manager_name}</span>
        )}
      </div>

      <div className="employee-card-footer">
        <div className="join-date">Joined: {emp.hire_date || 'N/A'}</div>
      </div>
    </div>
  );
};

export default EmployeeCard;
