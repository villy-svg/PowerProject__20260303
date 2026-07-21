import React, { useState } from 'react';
import { IconEdit, IconTrash, IconChevronDown } from '../../components/ui/Icons';
import { resolvePriorityLabel } from '../../registry/verticalRegistry';

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
  className = '',
  remarks = []
}) => {
  const [isEditingHub, setIsEditingHub] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState(emp.hub_id || 'ALL');
  const [showRemarksDropdown, setShowRemarksDropdown] = useState(false);

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
        {emp.is_app_user ? (
          <span className="app-user-badge-mini" title="Has App Access">USER</span>
        ) : (
          <span className="badge-base badge-danger u-text-xs" title="Not onboarded">NOT USER</span>
        )}
        {emp.isDuplicate && <span className="duplicate-badge-mini">DUP</span>}
        {(!emp.account_number || !emp.ifsc_code || !emp.account_name || !emp.pan_number) && (
          <span className="badge-base badge-danger u-text-xs">BANK MISSING</span>
        )}
      </div>

      {/* Row 2: Title (Name) */}
      <div className="card-row-2">
        <h3 className="card-task-name employee-card-name u-text-lg u-my-4">
          {emp.full_name || 'Unnamed Employee'}
        </h3>
      </div>

      {/* Detail Row (Contact) - Clean and Neutralized */}
      <div className="employee-card-contact u-flex-col u-flex-gap-2 u-text-sm u-opacity-60 u-mt-4">
        <div className="u-flex-wrap-gap-8">
          <span>ID: {emp.badge_id || emp.id.slice(0, 8)}</span>
          {emp.hire_date && <span className="u-fw-600 u-text-brand-green">📅 Joined: {new Date(emp.hire_date).toLocaleDateString()}</span>}
          <span>📞 {emp.phone || 'N/A'}</span>
          {emp.email && <span className="u-opacity-80">✉️ {emp.email}</span>}
        </div>
        {emp.manager_name && emp.manager_name !== 'None' && (
          <div className="manager-info">👤 Mgr: {emp.manager_name}</div>
        )}
      </div>

      {/* Row 3: Controls (Actions) */}
      <div className="card-row-3">
        <div className="card-navigation">
          <button
            className={`role-select-btn halo-button ${showRemarksDropdown ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowRemarksDropdown(!showRemarksDropdown); }}
            title="Toggle Remarks summary"
          >
            {showRemarksDropdown ? 'Hide Remarks' : `Remarks (${remarks.length})`}
          </button>
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

      {showRemarksDropdown && (
        <div className="card-remarks-dropdown" onClick={(e) => e.stopPropagation()}>
          {remarks.length === 0 ? (
            <div className="remark-empty-state">No remarks assigned</div>
          ) : (
            remarks.map((r) => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default EmployeeCard;
