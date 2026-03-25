import React, { useState } from 'react';

/**
 * EmployeeListRow
 * Row view item for an employee.
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
  onSelect
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
      className={`employee-list-row ${emp.status === 'Inactive' ? 'inactive' : ''} ${isSelected ? 'selected' : ''}`}
      onDoubleClick={() => onView(emp)}
      title="Double-click to view"
    >
      <div className="list-row-inner">
        {/* COLUMN 1: Identity & Management */}
        <div className="list-col col-identity">
          <div className="col-row-1">
            <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`} onClick={(e) => { e.stopPropagation(); onSelect(emp.id); }}>
              {isSelected && '✓'}
            </div>
            <span className="list-name">{emp.full_name}</span>
          </div>
          <div className="col-row-2 management-info">
            <span className="contact-item-id">{emp.badge_id}</span>
            {emp.manager_name && emp.manager_name !== 'None' && (
              <span className="manager-info">👤 {emp.manager_name}</span>
            )}
            {emp.isDuplicate && (
              <span className="duplicate-badge-mini" title={`${emp.duplicateCount} duplicates`}>DUP</span>
            )}
          </div>
        </div>

        {/* COLUMN 2: Organization & User/Badges */}
        <div className="list-col col-org">
          <div className="col-row-1">
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
          </div>
          <div className="col-row-2 system-badges">
            {emp.is_app_user && <span className="app-user-badge-mini">USER</span>}
            {(!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number) && (
              <span className="bank-missing-badge-mini">Bank Missing</span>
            )}
          </div>
        </div>

        {/* COLUMN 3: Contact */}
        <div className="list-col col-contact">
          <div className="col-row-1">
            <span className="contact-item">{emp.phone ? (emp.phone.toString().startsWith('+91') ? emp.phone : `+91 ${emp.phone.toString().replace(/^\+?91/, '').trim()}`) : 'N/A'}</span>
          </div>
          <div className="col-row-2">
            {emp.email && <span className="contact-item email-id">{emp.email}</span>}
          </div>
        </div>

        {/* COLUMN 4: Actions & Status */}
        <div className="list-col col-actions">
          <div className="col-row-1 actions-row">
            {permissions.canUpdate && (
              <button className="action-icon-btn edit-pencil-btn" onClick={() => onEdit(emp)} title="Edit">✎</button>
            )}
            {permissions.canDelete && (
              <button className="action-icon-btn delete" onClick={() => onDelete(emp.id)} title="Delete">×</button>
            )}
          </div>
          <div className="col-row-2 status-row">
            {emp.status === 'Inactive' ? (
              <div className="employee-status-indicator inactive">{emp.status}</div>
            ) : (
              permissions.canUpdate && (
                <button
                  className="status-toggle-btn"
                  onClick={() => onToggleStatus(emp.id, emp.status)}
                  title="Move to Inactive"
                >
                  ↓
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeListRow;
