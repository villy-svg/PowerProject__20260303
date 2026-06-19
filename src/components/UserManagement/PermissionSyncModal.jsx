import React, { useState } from 'react';
import { IconX } from '../Icons';

/**
 * PermissionSyncModal Component
 * Allows an admin to clone an exact set of permissions (role, verticals, features)
 * from one Exporting User to multiple Importing Users.
 */
const PermissionSyncModal = ({ users, onClose, onSave, loading }) => {
  const [sourceUserId, setSourceUserId] = useState('');
  const [targetUserIds, setTargetUserIds] = useState([]);

  // Only active users should be eligible for syncing
  const activeUsers = users.filter(u => u.is_active !== false);

  const handleTargetToggle = (userId) => {
    setTargetUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const allEligible = activeUsers.filter(u => u.id !== sourceUserId).map(u => u.id);
    if (targetUserIds.length === allEligible.length) {
      setTargetUserIds([]);
    } else {
      setTargetUserIds(allEligible);
    }
  };

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
              <select 
                value={sourceUserId} 
                onChange={(e) => {
                  setSourceUserId(e.target.value);
                  // Remove the new source from targets if it was previously selected
                  setTargetUserIds(prev => prev.filter(id => id !== e.target.value));
                }}
                className="master-dropdown"
                required
              >
                <option value="" className="dropdown-fallback-option">Select the source user...</option>
                {activeUsers.map(u => (
                  <option key={u.id} value={u.id} className="dropdown-fallback-option">
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
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
              {sourceUserId && (
                <button type="button" onClick={handleSelectAll} className="select-all-btn">
                  {targetUserIds.length > 0 && targetUserIds.length === activeUsers.length - 1 ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            <div className="form-input-container multi-select-container">
              {!sourceUserId ? (
                <p className="empty-state-text">
                  Please select a source user first.
                </p>
              ) : (
                <div className="checkbox-list">
                  {activeUsers.filter(u => u.id !== sourceUserId).map(u => (
                    <label key={u.id} className={`checkbox-item ${targetUserIds.includes(u.id) ? 'selected' : ''}`}>
                      <input 
                        type="checkbox" 
                        checked={targetUserIds.includes(u.id)}
                        onChange={() => handleTargetToggle(u.id)}
                        className="custom-checkbox"
                      />
                      <div className="user-info">
                        <span className="user-name">{u.name}</span>
                        <span className="user-email">{u.email}</span>
                      </div>
                    </label>
                  ))}
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
