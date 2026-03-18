import React from 'react';

/**
 * ClientCard
 * Grid/Tile view item for a client.
 */
const ClientCard = ({ client, tasks = [], onEdit, onView, onDelete, onToggleStatus, isMasterAdmin }) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const p = phone.toString();
    return p.startsWith('+91') ? p : `+91 ${p.replace(/^\+?91/, '').trim()}`;
  };

  return (
    <div
      className={`client-card ${client.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(client)}
      title="Double-click to view"
    >
      {/* Badges Row */}
      <div className="client-card-badges">
        <span className="dept-badge">{client.category_code || 'NO CAT'}</span>
        <span className="billing-badge">{client.billing_model_code || 'NO MODEL'}</span>
        {pendingTasksCount > 0 && (
          <span className="priority-badge" style={{ backgroundColor: '#ff4444', color: 'white', border: 'none' }}>
            {pendingTasksCount} Task{pendingTasksCount > 1 ? 's' : ''}
          </span>
        )}
        <div style={{ marginLeft: 'auto' }} className="employee-actions">
          <button
            className="action-icon-btn edit-pencil"
            onClick={() => onEdit(client)}
            title="Edit Client"
            style={{ opacity: 0.5, filter: 'grayscale(1)' }}
          >
            ✎
          </button>
          {isMasterAdmin && (
            <button className="action-icon-btn delete" onClick={() => onDelete(client.id)} title="Delete">×</button>
          )}
          <button
            className={`halo-button ${client.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
            style={{ padding: '2px 10px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '4px', fontWeight: 900 }}
            onClick={() => onToggleStatus(client.id, client.status)}
            title={client.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
          >
            {client.status === 'Active' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      {/* Name */}
      <h3 className="client-card-name">{client.name}</h3>

      {/* PoC Details */}
      <div className="client-card-poc">
        {client.poc_name && (
          <span style={{ fontWeight: 600 }}>👤 {client.poc_name}</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>📞 {formatPhone(client.poc_phone)}</span>
          {client.poc_email && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>✉️ {client.poc_email}</span>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="client-card-footer">
        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
          {client.category_name && client.category_name !== 'Uncategorized' ? client.category_name : 'No Category'}
        </div>
        <div className="client-status" style={{ color: client.status === 'Active' ? 'var(--brand-green)' : '#ff4444' }}>
          {client.status}
        </div>
      </div>
    </div>
  );
};

export default ClientCard;
