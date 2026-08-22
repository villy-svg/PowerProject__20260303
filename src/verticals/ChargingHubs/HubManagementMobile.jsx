import React from 'react';
import { IconEdit, IconTrash } from '../../components/ui/Icons';

const HubManagementMobile = ({ 
  hubsWithDuplicateInfo, 
  loading, 
  permissions, 
  onEdit, 
  onDelete 
}) => {
  return (
    <div className="hubs-grid">
      {hubsWithDuplicateInfo.map(hub => (
        <div key={hub.id} className={`hub-card ${hub.isDuplicate ? 'duplicate-name' : ''}`}>
          {hub.isDuplicate && (
            <span className="duplicate-badge">DUP</span>
          )}
          <div className="hub-card-top-row">
            <h3 className="hub-code-large">{hub.hub_code || 'NO CODE'}</h3>
            <div className={`status-badge ${hub.status?.toLowerCase()}`}>{hub.status}</div>
          </div>
          
          <div className="hub-card-bottom-row">
            <p className="hub-name-small">{hub.name}</p>
            <span className="divider">|</span>
            <p className="hub-city">{hub.city || 'No city set'}</p>
            <div className="hub-actions">
              {permissions.canUpdate && (
                <button className="halo-button edit-btn" onClick={() => onEdit(hub)} title="Edit Hub">
                  <IconEdit size={16} />
                </button>
              )}
              {permissions.canDelete && (
                <button className="halo-button delete-btn" onClick={() => onDelete(hub.id)} title="Delete Hub">
                  <IconTrash size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      {hubsWithDuplicateInfo.length === 0 && !loading && (
        <div className="empty-state">
          <p>No hubs found. Create your first charging hub to get started!</p>
        </div>
      )}
    </div>
  );
};

export default HubManagementMobile;
