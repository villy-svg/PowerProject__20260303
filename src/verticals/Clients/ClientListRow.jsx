import React from 'react';
import { IconEdit, IconTrash, IconChevronDown, IconChevronRight } from '../../components/Icons';

/**
 * ClientListRow
 * Row view item for a client. (North Star: TaskListView / ListViewRow)
 */
const ClientListRow = ({
  client,
  tasks = [],
  onEdit,
  onView,
  onDelete,
  onToggleStatus,
  permissions = {},
  isExpanded,
  onToggleExpand
}) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  return (
    <div
      className={`list-task-row client-list-row ${client.status === 'Inactive' ? 'inactive' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        onToggleExpand();
      }}
      onDoubleClick={() => onView(client)}
      style={{
        '--stage-color': client.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'
      }}
    >
      <div className="list-row-main">
        {/* 1. Badges / Metadata - Following ListViewRow North Star */}
        <div className="list-row-badges">
          <span className={`card-priority ${client.status === 'Active' ? 'priority-completed' : 'priority-urgent'}`} style={{ minWidth: '70px', textAlign: 'center' }}>
            {client.status}
          </span>
          <span className="billing-badge hub-badge" style={{ fontSize: '0.65rem' }}>{client.billing_model_code || 'MODEL'}</span>
          {pendingTasksCount > 0 && (
            <span className="badge-base badge-info">
              {pendingTasksCount} TASKS
            </span>
          )}
          <span className="dept-badge" style={{ opacity: 0.7 }}>
            {Object.keys(client.category_matrix || {}).length} VEH
          </span>
        </div>

        {/* 2. Content (Name + Subline) */}
        <div className="list-row-content" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="list-name" style={{ fontWeight: 700 }}>{client.name}</span>
          {client.poc_name && (
            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>👤 {client.poc_name}</span>
          )}
          {client.poc_phone && (
            <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>📞 {client.poc_phone}</span>
          )}
        </div>
      </div>

      {/* 3. Controls (Actions) - Following ListViewRow North Star */}
      <div className="list-row-controls">
        {permissions.canUpdate && (
          <button className="card-edit-button" onClick={(e) => { e.stopPropagation(); onEdit(client); }} title="Edit">
            <IconEdit size={14} />
          </button>
        )}
        {permissions.canUpdate && (
          <button
            className="card-deprio-button"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(client.id, client.status); }}
            title={client.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
            style={{ color: client.status === 'Active' ? 'inherit' : 'var(--brand-green)' }}
          >
            <IconChevronDown size={14} style={{ transform: client.status === 'Active' ? 'none' : 'rotate(180deg)' }} />
          </button>
        )}
        {permissions.canDelete && (
          <button className="card-delete-button" onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} title="Delete">
            <IconTrash size={14} />
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

export default ClientListRow;
