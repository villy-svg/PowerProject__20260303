import React from 'react';

/**
 * ClientCard
 * Grid/Tile view item for a client.
 */
const ClientCard = ({ client, tasks = [], onEdit, onView, onDelete, onToggleStatus, permissions = {} }) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const p = phone.toString();
    return p.startsWith('+91') ? p : `+91 ${p.replace(/^\+?91/, '').trim()}`;
  };

  const getMatrixSummary = () => {
    if (!client.category_matrix || Object.keys(client.category_matrix).length === 0) return null;

    // Group vehicles by service
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
    }).join(' | ');
  };

  const matrixSummary = getMatrixSummary();

  return (
    <div
      className={`client-card ${client.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(client)}
      title="Double-click to view"
    >
      {/* Floating Card Actions */}
      <div className="client-card-actions">
        {permissions.canUpdate && (
          <button
            className="action-icon-btn edit-pencil"
            onClick={(e) => { e.stopPropagation(); onEdit(client); }}
            title="Edit Client"
            style={{ opacity: 0.5, filter: 'grayscale(1)' }}
          >
            ✎
          </button>
        )}
        {permissions.canDelete && (
          <button
            className="action-icon-btn delete"
            onClick={(e) => { e.stopPropagation(); onDelete(client.id); }}
            title="Delete"
          >
            ×
          </button>
        )}
        {permissions.canUpdate && (
          <button
            className={`halo-button status-toggle-btn ${client.status === 'Active' ? 'delete-btn' : 'save-btn'}`}
            style={{ padding: '2px 10px', fontSize: '0.8rem', minWidth: 'auto', fontWeight: 900 }}
            onClick={(e) => { e.stopPropagation(); onToggleStatus(client.id, client.status); }}
            title={client.status === 'Active' ? 'Move to Inactive' : 'Move to Active'}
          >
            {client.status === 'Active' ? '↓' : '↑'}
          </button>
        )}
      </div>

      {/* Badges Row */}
      <div className="client-card-badges" style={{ paddingRight: '120px' }}>
        {matrixSummary ? (
          <span className="dept-badge" title={matrixSummary}>{matrixSummary}</span>
        ) : (
          <span className="dept-badge">{client.category_code || 'NO CAT'}</span>
        )}
        <span className="billing-badge">{client.billing_model_code || 'NO MODEL'}</span>
        {pendingTasksCount > 0 && (
          <span className="pending-tasks-badge">
            {pendingTasksCount} Tasks
          </span>
        )}
      </div>

      {/* Name */}
      <h3 className="client-card-name">{client.name || 'Untitled Client'}</h3>

      {/* PoC Details */}
      <div className="client-card-poc">
        {client.poc_name && (
          <div className="poc-primary">
            <span className="poc-icon">👤</span>
            <span className="poc-name">{client.poc_name}</span>
          </div>
        )}
        <div className="poc-contact-info">
          <span className="poc-item">
            <span className="poc-icon">📞</span>
            {formatPhone(client.poc_phone)}
          </span>
          {client.poc_email && (
            <span className="poc-item">
              <span className="poc-icon">✉️</span>
              {client.poc_email}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="client-card-footer">
        <div className="client-category-label">
          {client.category_name && client.category_name !== 'Uncategorized' ? client.category_name : 'No Category'}
        </div>
        {client.status === 'Inactive' && (
          <div className="client-status-indicator inactive">
            {client.status}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCard;
