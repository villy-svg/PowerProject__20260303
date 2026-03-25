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
  className = '',
  hasChildren,
  isExpanded,
  onToggle
}) => {
  const isCurrentUser = emp.email === user?.email || emp.user_id === user?.id;
  const isAccessibleReportee = user?.reporteeUserIds?.includes(emp.user_id);

  return (
    <div 
      className={`employee-tree-card ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${isCurrentUser ? 'is-current-user' : ''} ${isAccessibleReportee ? 'is-accessible-reportee' : ''} ${className}`}
      onDoubleClick={() => onEdit(emp)}
    >
      {/* Tree Toggle */}
      <div className="tree-toggle-container">
        {hasChildren ? (
          <button 
            className="tree-toggle-btn" 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className="toggle-icon">{isExpanded ? '−' : '+'}</span>
          </button>
        ) : (
          <div className="tree-toggle-spacer" />
        )}
      </div>

      <div className="selection-area" onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
        <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>

      <div className="tree-card-content">
        <div className="tree-card-header">
          <h3 className="tree-card-name">
            {emp.full_name}
          </h3>
          {hasChildren && (
            <span className="reportee-count-badge" title={`${emp.children?.length || 0} Direct Reportees`}>
              {emp.children?.length || 0}
            </span>
          )}
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
