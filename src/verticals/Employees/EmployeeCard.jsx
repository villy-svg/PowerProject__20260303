import React, { useState } from 'react';
import { IconEdit, IconTrash, IconChevronDown } from '../../components/Icons';

/**
 * EmployeeCard
 * Grid/Tile view item for an employee. (North Star: TaskCard structure)
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
      className={`task-card-master employee-card ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${className}`}
      onDoubleClick={() => onView(emp)}
      title="Double-click to view"
      style={{
        borderLeft: `2px solid ${emp.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'}`,
        '--stage-color': emp.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'
      }}
    >
      {/* Row 0: Header (Selection) */}
      <div className="card-header-row">
        <div className="task-selection-area card-selection" onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
          <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>
      </div>

      {/* Row 1: Metadata (Badges) */}
      <div className="card-row-1">
        <span className={`card-priority ${emp.status === 'Active' ? 'priority-completed' : 'priority-urgent'}`}>
          {emp.status}
        </span>
        <span className="dept-badge">{emp.dept_code || 'NO DEPT'}</span>
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
        <span className="role-badge">{emp.role_code || 'NO ROLE'}</span>
        {emp.is_app_user && <span className="app-user-badge-mini" title="Has App Access">USER</span>}
        {emp.isDuplicate && <span className="duplicate-badge-mini">DUP</span>}
        {(!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number) && (
          <span className="badge-base badge-danger" style={{ fontSize: '0.6rem' }}>BANK MISSING</span>
        )}
      </div>

      {/* Row 2: Title (Name) */}
      <div className="card-row-2">
        <h3 className="card-task-name employee-card-name" style={{ fontSize: '1.05rem', margin: '4px 0' }}>
          {emp.full_name || 'Unnamed Employee'}
        </h3>
      </div>

      {/* Detail Row (Contact) - Clean and Neutralized */}
      <div className="employee-card-contact" style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span>ID: {emp.badge_id || emp.id}</span>
          <span>📞 {emp.phone || 'N/A'}</span>
          {emp.email && <span style={{ opacity: 0.8 }}>✉️ {emp.email}</span>}
        </div>
        {emp.manager_name && emp.manager_name !== 'None' && (
          <div className="manager-info">👤 Mgr: {emp.manager_name}</div>
        )}
      </div>

      {/* Row 3: Controls (Actions) */}
      <div className="card-row-3">
        <div className="card-navigation">
          {/* Symmetrical placeholder for TaskCard alignment */}
        </div>
        
        <div className="task-management-actions">
          {permissions.canUpdate && (
            <button
              className="action-icon-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(emp); }}
              title="Edit Employee"
            >
              <IconEdit size={14} />
            </button>
          )}
          {permissions.canUpdate && (
            <button
              className="action-icon-btn"
              onClick={(e) => { e.stopPropagation(); onToggleStatus(emp.id, emp.status); }}
              title={emp.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
              style={{ color: emp.status === 'Active' ? 'inherit' : 'var(--brand-green)' }}
            >
              <IconChevronDown size={14} style={{ transform: emp.status === 'Active' ? 'none' : 'rotate(180deg)' }} />
            </button>
          )}
          {permissions.canDelete && (
            <button
              className="action-icon-btn delete"
              onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }}
              title="Delete"
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeCard;
