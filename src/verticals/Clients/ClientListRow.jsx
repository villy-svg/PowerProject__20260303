import React from 'react';
import { IconEdit, IconTrash, IconChevronDown, IconChevronRight } from '../../components/Icons';

/**
 * ClientListRow
 * Row view item for a client, refactored to match Task Board aesthetics.
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
  return (
    <div
      className={`list-task-row client-list-row ${client.status === 'Inactive' ? 'inactive' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        onToggleExpand();
      }}
      onDoubleClick={() => onView(client)}
    >
      <div className="list-row-main">
        {/* 1. Identity Block */}
        <div className="list-row-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="list-name">{client.name}</span>
            {client.billing_model_name && (
              <span className="billing-badge" style={{ fontSize: '0.65rem' }}>{client.billing_model_name}</span>
            )}
            {tasks.length > 0 && (
              <span className="pending-tasks-badge" title={`${tasks.length} pending tasks`}>
                {tasks.length} TASKS
              </span>
            )}
          </div>
          {isExpanded && (
            <div className="list-row-subline" style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>
              <span style={{ marginRight: '16px' }}>👤 {client.poc_name || 'No POC'}</span>
              <span>📧 {client.poc_email || 'No Email'}</span>
            </div>
          )}
        </div>

        {/* 2. Badges / Metadata (Hidden on mobile if not expanded) */}
        {!isExpanded && (
          <div className="list-row-badges">
            <span className="poc-name-mini">{client.poc_name || 'No POC'}</span>
            <span className="category-code-mini">
              {Object.keys(client.category_matrix || {}).length} VEHICLES
            </span>
          </div>
        )}
      </div>

      {/* 3. Controls (Hover/Expand) */}
      <div className="list-row-controls">
        {permissions.canUpdate && (
          <button className="card-edit-button" onClick={(e) => { e.stopPropagation(); onEdit(client); }} title="Edit">
            <IconEdit size={14} />
          </button>
        )}
        {permissions.canDelete && (
          <button className="card-delete-button" onClick={(e) => { e.stopPropagation(); onDelete(client.id); }} title="Delete">
            <IconTrash size={14} />
          </button>
        )}
        {client.status !== 'Inactive' && permissions.canUpdate && (
          <button
            className="card-deprio-button"
            onClick={(e) => { e.stopPropagation(); onToggleStatus(client.id, client.status); }}
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

export default ClientListRow;
