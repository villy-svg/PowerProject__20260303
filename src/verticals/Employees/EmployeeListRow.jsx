import React, { useState } from 'react';
import { IconEdit, IconTrash, IconChevronDown, IconChevronRight } from '../../components/Icons';

/**
 * EmployeeListRow
 * Row view item for an employee. (North Star: TaskListView / ListViewRow)
 */
const EmployeeListRow = ({
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
  isExpanded,
  onToggleExpand,
  isRowExpanded,
  onToggleRowExpand
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
      className={`list-task-row employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${isRowExpanded ? 'is-expanded' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button') || e.target.closest('.list-row-selection')) return;
        if (onToggleRowExpand) onToggleRowExpand();
      }}
      onDoubleClick={() => onView(emp)}
      style={{
        '--stage-color': emp.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'
      }}
    >
      <div className="list-row-main">
        {/* 1. Selection Checkbox */}
        <div className="list-row-selection" onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
          <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        {/* 2. Metadata (Badges) - Following ListViewRow North Star */}
        <div className="list-row-badges">
          <span className={`card-priority ${emp.status === 'Active' ? 'priority-completed' : 'priority-urgent'}`} style={{ minWidth: '70px', textAlign: 'center' }}>
            {emp.status}
          </span>
          <span className="dept-badge">{emp.dept_code || 'DEPT'}</span>
          <span
            className={`hub-badge ${!emp.hub_id ? 'null-hub' : ''} ${isEditingHub ? 'editing' : ''}`}
            onDoubleClick={handleHubDoubleClick}
          >
            {isEditingHub ? (
              <select
                className="hub-select-mini"
                value={selectedHubId}
                onChange={handleHubChange}
                onBlur={handleHubBlur}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              >
                <option value="ALL">ALL</option>
                {availableHubs?.map(h => <option key={h.id} value={h.id}>{h.hub_code}</option>)}
              </select>
            ) : (
              emp.hub_code || 'HUB'
            )}
          </span>
          <span className="role-badge">{emp.role_code || 'ROLE'}</span>
          {emp.is_app_user && <span className="app-user-badge-mini">USER</span>}
          {emp.isDuplicate && <span className="duplicate-badge-mini">DUP</span>}
        </div>

        {/* 3. Content (Name + Details) */}
        <div className="list-row-content" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--text-secondary)', opacity: 0.5, fontSize: '0.7rem', minWidth: '60px' }}>
            {emp.badge_id || emp.id.slice(0, 5)}
          </span>
          <span className="list-name" style={{ fontWeight: 700 }}>{emp.full_name}</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{emp.phone}</span>
        </div>
      </div>

      {/* 4. Controls (Actions) - Following ListViewRow North Star */}
      <div className="list-row-controls">
        {permissions.canUpdate && (
          <button className="card-edit-button" onClick={(e) => { e.stopPropagation(); onEdit(emp); }} title="Edit">
            <IconEdit size={14} />
          </button>
        )}
        {permissions.canUpdate && (
          <button
            className="card-deprio-button"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(emp.id, emp.status); }}
            title={emp.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
            style={{ color: emp.status === 'Active' ? 'inherit' : 'var(--brand-green)' }}
          >
            <IconChevronDown size={14} style={{ transform: emp.status === 'Active' ? 'none' : 'rotate(180deg)' }} />
          </button>
        )}
        {permissions.canDelete && (
          <button className="card-delete-button" onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }} title="Delete">
            <IconTrash size={14} />
          </button>
        )}
        <button 
          className="card-nav-button" 
          onClick={(e) => { e.stopPropagation(); if (onToggleRowExpand) onToggleRowExpand(); }}
          title={isRowExpanded ? "Collapse" : "Expand Details"}
        >
          {isRowExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
};

export default EmployeeListRow;
