import React, { useState } from 'react';
import { IconX } from '../ui/Icons';
import BaseDropdown from '../ui/BaseDropdown';
import '../../styles/ManagementForms.css';

/**
 * PermissionSyncModal Component
 * Allows an admin to clone an exact set of permissions (role, verticals, features)
 * from one Exporting User to multiple Importing Users.
 */
const PermissionSyncModal = ({ users, onClose, onSave, loading }) => {
  const [sourceUserId, setSourceUserId] = useState('');
  const [targetUserIds, setTargetUserIds] = useState([]);

  // Use all users so that even inactive users can be targeted/sourced
  const userOptions = users.map(u => ({
    label: `${u.name} (${u.email})`,
    value: u.id
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sourceUserId || targetUserIds.length === 0) return;
    onSave(sourceUserId, targetUserIds);
  };

  return (
    <div className="edit-modal-overlay">
      <div className="edit-modal user-role-modal sync-modal">
        <header className="modal-header">
          <div className="modal-title-group">
            <h3>Clone Permissions</h3>
            <span className="modal-subtitle">Mass sync access across multiple users</span>
          </div>
          <button className="close-modal" onClick={onClose}>
            <IconX size={20} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="vertical-task-form">
          {/* 1. Exporting User */}
          <div className="form-group">
            <label className="section-label">
              1. Permission Exporting User (Source)
            </label>
            <div className="form-input-container">
              <BaseDropdown
                id="source-user-select"
                value={sourceUserId}
                onChange={(val) => {
                  setSourceUserId(val);
                  // Remove the new source from targets if it was previously selected
                  setTargetUserIds(prev => prev.filter(id => id !== val));
                }}
                options={userOptions}
                placeholder="Select the source user..."
                mode="single"
                searchable={true}
                fuzzySearch={true}
                displayMode="compact"
              />
            </div>
            <p className="sync-help-text">
              This user's Access Scope, Capability Level, Vertical Access, and Feature Overrides will be copied exactly.
            </p>
          </div>

          {/* 2. Importing Users */}
          <div className="form-group">
            <div className="form-group-header">
              <label className="section-label">
                2. Permission Importing Users (Targets)
              </label>
            </div>
            
            <div className="form-input-container" style={{ minHeight: 'auto', padding: '0', background: 'transparent', border: 'none' }}>
              {!sourceUserId ? (
                <div className="form-input-container" style={{ opacity: 0.5 }}>
                  <p className="empty-state-text" style={{ margin: 0, padding: '8px', fontSize: '0.9rem' }}>
                    Please select a source user first.
                  </p>
                </div>
              ) : (
                <div style={{ width: '100%' }}>
                  <BaseDropdown
                    id="target-users-select"
                    value={targetUserIds}
                    onChange={setTargetUserIds}
                    options={userOptions.filter(opt => opt.value !== sourceUserId)}
                    placeholder="Select target users..."
                    mode="multi"
                    searchable={true}
                    fuzzySearch={true}
                    selectAll={true}
                    displayMode="pills"
                    closeOnSelectMobile={false}
                  />
                </div>
              )}
            </div>
            <p className="sync-help-text warning-text">
              Warning: Selected users will have their current permissions completely wiped and replaced.
            </p>
          </div>

          <div className="modal-actions">
            <button type="button" className="halo-button cancel-btn" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button 
              type="submit" 
              className={`halo-button save-btn ${(!sourceUserId || targetUserIds.length === 0) ? 'disabled' : ''}`}
              disabled={loading || !sourceUserId || targetUserIds.length === 0}
            >
              {loading ? 'Syncing...' : `Sync to ${targetUserIds.length} User(s)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PermissionSyncModal;
