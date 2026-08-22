import React from 'react';
import { IconEdit, IconTrash } from '../../components/ui/Icons';

const HubManagementDesktop = ({ 
  hubsWithDuplicateInfo, 
  loading, 
  permissions, 
  onEdit, 
  onDelete 
}) => {
  return (
    <div className="hubs-list-view responsive-table-wrapper">
      <table className="management-table">
        <thead>
          <tr>
            <th>Hub Name</th>
            <th>Code</th>
            <th>City/Address</th>
            <th>Status</th>
            <th className="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {hubsWithDuplicateInfo.map(hub => (
            <tr key={hub.id} className={hub.isDuplicate ? 'is-duplicate' : ''}>
              <td className="name-cell">
                {hub.name}
                {hub.isDuplicate && <span className="duplicate-badge-mini">DUP</span>}
              </td>
              <td><code className="code-font">{hub.hub_code || '—'}</code></td>
              <td>{hub.city || '—'}</td>
              <td>
                <span className={`status-pill ${hub.status}`}>{hub.status}</span>
              </td>
              <td className="actions-col">
                <div className="table-actions">
                  {permissions.canUpdate && (
                    <button className="icon-btn edit" onClick={() => onEdit(hub)} title="Edit">
                      <IconEdit size={16} />
                    </button>
                  )}
                  {permissions.canDelete && (
                    <button className="icon-btn delete" onClick={() => onDelete(hub.id)} title="Delete">
                      <IconTrash size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {hubsWithDuplicateInfo.length === 0 && !loading && (
            <tr>
              <td colSpan="5" className="empty-state">
                <p>No hubs found. Create your first charging hub to get started!</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default HubManagementDesktop;
