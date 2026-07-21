import React, { useState } from 'react';
import { IconEdit, IconTrash, IconChevronDown, IconChevronRight, IconComment } from '../../components/ui/Icons';
import { resolvePriorityLabel } from '../../registry/verticalRegistry';

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
  isRowExpanded,
  onToggleRowExpand,
  remarks = []
}) => {
  const [isEditingHub, setIsEditingHub] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState(emp.hub_id || 'ALL');
  const [showRemarks, setShowRemarks] = useState(false);

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
          <span className={`card-priority u-w-70 u-text-center ${emp.status === 'Active' ? 'priority-completed' : 'priority-urgent'}`}>
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
        <div className="list-row-content u-flex-center-gap-12">
          <span className="u-text-secondary u-opacity-50 u-text-xs u-w-60">
            {emp.badge_id || emp.id.slice(0, 5)}
          </span>
          <span className="list-name u-fw-700">{emp.full_name}</span>
          <span className="u-text-sm u-opacity-50">{emp.phone}</span>
        </div>
      </div>

      {/* 4. Controls (Actions) - Following ListViewRow North Star */}
      <div className="list-row-controls">
        {permissions.canUpdate && (
          <button className="card-edit-button" onClick={(e) => { e.stopPropagation(); onEdit(emp); }} title="Edit Employee Profile">
            <IconEdit size={14} />
          </button>
        )}
        {permissions.canUpdate && (
          <button
            className="card-deprio-button"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(emp.id, emp.status); }}
            title={emp.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
            style={{ color: emp.status === 'Active' ? 'inherit' : 'var(--brand-green)' }}
          >
            <IconChevronDown size={14} style={{ transform: emp.status === 'Active' ? 'none' : 'rotate(180deg)' }} />
          </button>
        )}
        {permissions.canDelete && (
          <button className="card-delete-button" onClick={(e) => { e.stopPropagation(); onDelete(emp.id); }} title="Delete Employee Permanently">
            <IconTrash size={14} />
          </button>
        )}
        <button
          className={`card-nav-button ${showRemarks ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); setShowRemarks(!showRemarks); }}
          title={showRemarks ? "Hide Remarks Summary" : `Show Remarks Summary (${remarks.length})`}
          style={{ color: showRemarks ? 'var(--brand-green)' : 'inherit' }}
        >
          <IconComment size={14} />
        </button>
        <button 
          className="card-nav-button" 
          onClick={(e) => { e.stopPropagation(); if (onToggleRowExpand) onToggleRowExpand(); }}
          title={isRowExpanded ? "Collapse Details" : "Expand Details"}
        >
          {isRowExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </button>
      </div>

      {/* 5. Expanded Details (North Star: TaskListView details) */}
      {isRowExpanded && (
        <div className="list-row-details fade-in list-row-expanded-details">
          <div className="details-grid details-grid-auto">
            <div className="detail-col">
              <h6 className="detail-col-header">Personal Info</h6>
              <div className="u-flex-col-gap-4">
                <div>🎂 DOB: {emp.dob ? new Date(emp.dob).toLocaleDateString() : 'Not set'}</div>
                <div>📅 Joined: {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : 'N/A'}</div>
                <div>👤 Gender: {emp.gender || 'N/A'}</div>
              </div>
            </div>
            <div className="detail-col">
              <h6 className="detail-col-header">Bank Details</h6>
              <div className="u-flex-col-gap-4">
                <div>💳 Acc: {emp.account_number || 'Missing'}</div>
                <div>🏦 IFSC: {emp.ifsc_code || 'Missing'}</div>
                <div>🆔 PAN: {emp.pan_number || 'Missing'}</div>
              </div>
            </div>
            <div className="detail-col">
              <h6 className="detail-col-header">Organization</h6>
              <div className="u-flex-col-gap-4">
                <div>🏢 Dept: {emp.dept_code}</div>
                <div>📍 Hub: {emp.hub_code}</div>
                <div>👤 Manager: {emp.manager_name}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remarks Drawer */}
      {showRemarks && (
        <div className="list-row-details fade-in list-row-remarks-drawer">
          <h6 className="remarks-drawer-header">Remarks Summary ({remarks.length})</h6>
          {remarks.length === 0 ? (
            <div className="remark-empty-state u-opacity-50 u-py-4">No remarks assigned</div>
          ) : (
            <div className="remarks-list-container">
              {remarks.map((r) => (
                <div key={r.id} className="remark-summary-item" title={r.description || r.text}>
                  <span className="remark-summary-text">{r.text}</span>
                  <div className="remark-summary-meta">
                    <span className={`result-badge badge-sm-uppercase pri-${(r.priority || 'Medium').toLowerCase()}`}>
                      {resolvePriorityLabel(r.priority, r.verticalId)}
                    </span>
                    <span className={`result-badge badge-sm-uppercase stage-${(r.stageId || 'BACKLOG').toLowerCase().replace(/_/g, '-')}`}>
                      {r.stageId || 'Backlog'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeListRow;
