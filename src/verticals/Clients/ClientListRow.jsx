import React from 'react';

/**
 * ClientListRow
 * Row view item for a client.
 */
const ClientListRow = ({ client, tasks = [], onEdit, onView, onDelete, onToggleStatus, isMasterAdmin }) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const p = phone.toString();
    return p.startsWith('+91') ? p : `+91 ${p.replace(/^\+?91/, '').trim()}`;
  };

  return (
    <div
      className={`client-list-row ${client.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(client)}
      title="Double-click to view"
    >
      <div className="client-list-main-info">
        {/* Name */}
        <div className="client-list-name">{client.name}</div>

        {/* Badges */}
        <div className="client-list-badges">
          <span className="dept-badge">{client.category_code || 'NO CAT'}</span>
          <span className="billing-badge">{client.billing_model_code || 'NO MODEL'}</span>
          {pendingTasksCount > 0 && (
            <span className="priority-badge" style={{ backgroundColor: '#ff4444', color: 'white', border: 'none', marginLeft: '4px' }}>
              {pendingTasksCount}
            </span>
          )}
        </div>

        {/* PoC Contact */}
        <div className="client-list-poc" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {client.poc_name && (
            <>
              <span style={{ fontWeight: 600 }}>👤 {client.poc_name}</span>
              <span style={{ opacity: 0.3 }}>|</span>
            </>
          )}
          <span>📞 {formatPhone(client.poc_phone)}</span>
          {client.poc_email && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>✉️ {client.poc_email}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="employee-actions">
        <div
          style={{
            color: client.status === 'Active' ? 'var(--brand-green)' : '#ff4444',
            fontSize: '0.75rem',
            fontWeight: 700,
            marginRight: '1rem',
            alignSelf: 'center',
            opacity: client.status === 'Active' ? 1 : 0.5,
            textTransform: 'uppercase'
          }}
        >
          {client.status}
        </div>
        <button
          className="action-icon-btn edit-pencil"
          onClick={() => onEdit(client)}
          title="Edit Client"
          style={{ opacity: 0.5, filter: 'grayscale(1)', marginRight: '4px' }}
        >
          ✎
        </button>
        {isMasterAdmin && (
          <button className="action-icon-btn delete" onClick={() => onDelete(client.id)} title="Delete">×</button>
        )}
        <button
          className={`halo-button ${client.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
          style={{ padding: '2px 10px', fontSize: '0.8rem', minWidth: 'auto', marginLeft: '8px', fontWeight: 900 }}
          onClick={() => onToggleStatus(client.id, client.status)}
          title={client.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
        >
          {client.status === 'Active' ? '↓' : '↑'}
        </button>
      </div>
    </div>
  );
};

export default ClientListRow;
