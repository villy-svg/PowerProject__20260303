import React from 'react';
import { IconEdit, IconTrash, IconChevronDown } from '../../components/Icons';

/**
 * ClientCard
 * Grid/Tile view item for a client. (North Star: TaskCard structure)
 */
const ClientCard = ({ client, tasks = [], onEdit, onView, onDelete, onToggleStatus, permissions = {} }) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const p = phone.toString();
    return p.startsWith('+91') ? p : `+91 ${p.replace(/^\+?91/, '').trim()}`;
  };

  const getMatrixSummaryGroups = () => {
    if (!client.category_matrix || Object.keys(client.category_matrix).length === 0) return [];
    
    const serviceToVehicles = {};
    Object.entries(client.category_matrix).forEach(([vId, services]) => {
      Object.entries(services).forEach(([sId, checked]) => {
        if (checked) {
          if (!serviceToVehicles[sId]) serviceToVehicles[sId] = [];
          serviceToVehicles[sId].push(vId);
        }
      });
    });

    return Object.entries(serviceToVehicles).map(([sId, vIds]) => {
      const sCode = client.service_categories?.[sId]?.code || '???';
      const vCodes = vIds
        .map(vId => client.vehicle_categories?.[vId]?.code || '???')
        .join(', ');
      return `${sCode}: ${vCodes}`;
    });
  };

  const matrixSummaryGroups = getMatrixSummaryGroups();

  return (
    <div
      className={`task-card-master client-card ${client.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(client)}
      title="Double-click to view"
      style={{
        borderLeft: `2px solid ${client.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'}`,
        '--stage-color': client.status === 'Active' ? 'var(--brand-green)' : 'var(--priority-urgent)'
      }}
    >
      {/* Row 0: Header (Selection - Placeholder for symmetry) */}
      <div className="card-header-row">
        {/* Placeholder if clients get selection checkbox later */}
      </div>

      {/* Row 1: Metadata (Badges) */}
      <div className="card-row-1">
        <span className={`card-priority ${client.status === 'Active' ? 'priority-completed' : 'priority-urgent'}`}>
          {client.status}
        </span>
        {matrixSummaryGroups && matrixSummaryGroups.length > 0 ? (
          matrixSummaryGroups.map((group, idx) => (
            <span key={idx} className="dept-badge" title={group}>
              {group}
            </span>
          ))
        ) : (
          <span className="dept-badge">{client.category_code || 'NO CAT'}</span>
        )}
        <span className="billing-badge hub-badge">{client.billing_model_code || 'NO MODEL'}</span>
        {pendingTasksCount > 0 && (
          <span className="badge-base badge-info">
            {pendingTasksCount} Tasks
          </span>
        )}
      </div>

      {/* Row 2: Title (Name) */}
      <div className="card-row-2">
        <h3 className="card-task-name client-card-name" style={{ fontSize: '1.05rem', margin: '4px 0' }}>
          {client.name || 'Untitled Client'}
        </h3>
      </div>

      {/* Detail Row (PoC) */}
      <div className="client-card-poc" style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', opacity: 0.6, marginTop: '4px' }}>
        {client.poc_name && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span>👤 {client.poc_name}</span>
            <span>📞 {formatPhone(client.poc_phone)}</span>
          </div>
        )}
        {client.category_name && client.category_name !== 'Uncategorized' && (
          <div style={{ fontStyle: 'italic', opacity: 0.8 }}>{client.category_name}</div>
        )}
      </div>

      {/* Row 3: Controls (Actions) */}
      <div className="card-row-3">
        <div className="card-navigation">
          {/* Spacer */}
        </div>
        
        <div className="task-management-actions">
          {permissions.canUpdate && (
            <button
              className="action-icon-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(client); }}
              title="Edit Client"
            >
              <IconEdit size={14} />
            </button>
          )}
          {permissions.canUpdate && (
            <button
              className="action-icon-btn"
              onClick={(e) => { e.stopPropagation(); onToggleStatus(client.id, client.status); }}
              title={client.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
              style={{ color: client.status === 'Active' ? 'inherit' : 'var(--brand-green)' }}
            >
              <IconChevronDown size={14} style={{ transform: client.status === 'Active' ? 'none' : 'rotate(180deg)' }} />
            </button>
          )}
          {permissions.canDelete && (
            <button
              className="action-icon-btn delete"
              onClick={(e) => { e.stopPropagation(); onDelete(client.id); }}
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

export default ClientCard;
