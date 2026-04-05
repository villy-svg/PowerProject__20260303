import React from 'react';

/**
 * ClientListRow
 * Row view item for a client.
 */
const ClientListRow = ({ client, tasks = [], onEdit, onView, onDelete, onToggleStatus, permissions = {} }) => {
  const pendingTasksCount = tasks.filter(t => t.stage !== 'Done').length;

  const formatPhone = (phone) => {
    if (!phone) return 'N/A';
    const p = phone.toString();
    return p.startsWith('+91') ? p : `+91 ${p.replace(/^\+?91/, '').trim()}`;
  };

  const getMatrixSummaryGroups = () => {
    if (!client.category_matrix || Object.keys(client.category_matrix).length === 0) return [];
    
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
    });
  };

  const matrixSummaryGroups = getMatrixSummaryGroups();

  return (
    <div
      className={`client-list-row ${client.status === 'Inactive' ? 'inactive' : ''}`}
      onDoubleClick={() => onView(client)}
      title="Double-click to view"
    >
      <div className="list-row-inner">
        {/* COLUMN 1: Identity & Services */}
        <div className="list-col col-identity">
          <div className="col-row-1">
            <span className="list-name">{client.name}</span>
          </div>
          <div className="col-row-2 management-info">
            {client.poc_name && <span className="poc-name-mini" style={{ marginRight: '12px' }}>{client.poc_name}</span>}
            {matrixSummaryGroups && matrixSummaryGroups.length > 0 ? (
              matrixSummaryGroups.map((group, idx) => (
                <span key={idx} className="matrix-summary-mini" title={group}>
                  {group}
                </span>
              ))
            ) : (
              <span className="category-code-mini">{client.category_code || 'NO CATEGORY'}</span>
            )}
          </div>
        </div>

        {/* COLUMN 2: Business & Tasks */}
        <div className="list-col col-business">
          <div className="col-row-1">
            <span className="billing-badge">{client.billing_model_code || 'NO MODEL'}</span>
          </div>
          <div className="col-row-2">
            {pendingTasksCount > 0 && (
              <span className="pending-tasks-badge">
                {pendingTasksCount} Pending Tasks
              </span>
            )}
          </div>
        </div>

        {/* COLUMN 3: Contact */}
        <div className="list-col col-contact">
          <div className="col-row-1">
            <span className="contact-item">{formatPhone(client.poc_phone)}</span>
          </div>
          <div className="col-row-2">
            {client.poc_email && <span className="contact-item email-id">{client.poc_email}</span>}
          </div>
        </div>

        {/* COLUMN 4: Actions & Status */}
        <div className="list-col col-actions">
          <div className="col-row-1 actions-row">
            {permissions.canUpdate && (
              <button className="action-icon-btn edit-pencil-btn" onClick={() => onEdit(client)} title="Edit">✎</button>
            )}
            {permissions.canDelete && (
              <button className="action-icon-btn delete" onClick={() => onDelete(client.id)} title="Delete">×</button>
            )}
          </div>
          <div className="col-row-2 status-row">
            {client.status === 'Inactive' ? (
              <div className="employee-status-indicator inactive">{client.status}</div>
            ) : (
              permissions.canUpdate && (
                <button
                  className="status-toggle-btn"
                  onClick={() => onToggleStatus(client.id, client.status)}
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

export default ClientListRow;
