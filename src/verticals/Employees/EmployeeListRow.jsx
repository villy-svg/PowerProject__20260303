import React, { useState } from 'react';
import { IconEdit, IconTrash, IconChevronDown, IconChevronRight } from '../../components/Icons';

/**
 * EmployeeListRow
 * Row view item for an employee, refactored to match Task Board aesthetics.
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
  onToggleExpand
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
      className={`list-task-row employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button') || e.target.closest('.list-row-selection')) return;
        onToggleExpand();
      }}
      onDoubleClick={() => onView(emp)}
    >
      <div className="list-row-main">
        {/* 1. Selection Checkbox */}
        <div className="list-row-selection" onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
          <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        {/* 2. Identity Block */}
        <div className="list-row-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="id-line" style={{ fontSize: '0.75rem', minWidth: '60px' }}>{emp.badge_id}</span>
            <span className="list-name">{emp.full_name}</span>
            {emp.isDuplicate && (
              <span className="duplicate-badge-mini" title={`${emp.duplicateCount} duplicates`}>DUP</span>
            )}
          </div>
        </div>

        {/* 3. Badges / Metadata */}
        <div className="list-row-badges">
          <span className="dept-badge">{emp.dept_code || 'NO DEPT'}</span>
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
              emp.hub_code || 'NO HUB'
            )}
          </span>
          <span className="role-badge">{emp.role_code || 'NO ROLE'}</span>
          {emp.is_app_user && <span className="app-user-badge-mini">USER</span>}
          {emp.manager_name && emp.manager_name !== 'None' && (
            <span className="manager-info" style={{ opacity: 0.7, fontSize: '0.7rem' }}>👤 {emp.manager_name}</span>
          )}
        </div>
      </div>

      {/* 4. Controls (Hover/Expand) */}
      <div className="list-row-controls">
        {permissions.canUpdate && (
          <button className="card-edit-button" onClick={(e) => { e.stopPropagation(); onEdit(emp); }} title="Edit">
            <IconEdit size={14} />
          </button>
        )}
        {permissions.canDelete && (
          <button className="card-delete-button" onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }} title="Delete">
            <IconTrash size={14} />
          </button>
        )}
        {emp.status !== 'Inactive' && permissions.canUpdate && (
          <button
            className="card-deprio-button"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(emp.id, emp.status); }}
            title="Move to Inactive"
          >
            <IconChevronDown size={14} />
          </button>
        )}
        <button 
          className="card-nav-button" 
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          title={isExpanded ? "Collapse" : "Expand Details"}
        >
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>
      </div>
    </div>
  );
};

export default EmployeeListRow;
