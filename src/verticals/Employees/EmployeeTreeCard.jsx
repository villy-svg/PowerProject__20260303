import React from 'react';

/**
 * EmployeeTreeCard
 * A simplified card for the hierarchy tree view.
 * Displays only Name, Role Code, and Hub Code.
 */
const EmployeeTreeCard = ({ 
  emp, 
  user,
  onEdit, 
  onDelete, 
  permissions = {},
  isSelected = false,
  onSelect,
  className = ''
}) => {
  const isCurrentUser = emp.email === user?.email || emp.user_id === user?.id;

  return (
    <div 
      className={`employee-tree-card ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${isCurrentUser ? 'is-current-user' : ''} ${className}`}
      title="Double-click to view"
    >
      <div className="card-selection" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          onChange={() => onSelect(emp.id)} 
          className="selection-checkbox"
        />
      </div>

      <div className="tree-card-content">
        <div className="tree-card-header">
          <h3 className="employee-card-name">{emp.full_name}</h3>
          {isCurrentUser && <span className="current-user-badge">YOU</span>}
        </div>
        
        <div className="tree-card-details">
          <span className="role-badge">{emp.role_code || 'NO ROLE'}</span>
          <span className="hub-badge">{emp.hub_code || 'NO HUB'}</span>
        </div>
      </div>

      <div className="tree-card-actions">
        {permissions.canUpdate && (
          <button 
            className="action-icon-btn edit-pencil" 
            onClick={(e) => { e.stopPropagation(); onEdit(emp); }} 
            title="Edit Employee"
          >
            ✎
          </button>
        )}
        {permissions.canDelete && (
          <button 
            className="action-icon-btn delete" 
            onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }} 
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default EmployeeTreeCard;
