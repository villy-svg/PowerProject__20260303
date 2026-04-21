import React from 'react';
import MasterPageHeader from './MasterPageHeader';
import UserList from './UserManagement/UserList';
import UserEditorModal from './UserManagement/UserEditorModal';
import { useUserManagement } from './UserManagement/useUserManagement';
import './UserManagement.css';

/**
 * UserManagement Component (Refactored)
 * Entry point for administrative user & permission management.
 * Now modularized for extreme safety and auditability.
 */
const UserManagement = () => {
  const {
    users,
    loading,
    viewMode,
    setViewMode,
    status,
    setStatus,
    editingUser,
    openEditor,
    closeEditor,
    handleSyncPermissions,
    editRoleScope,
    setEditRoleScope,
    editRoleLevel,
    handleLevelChange,
    editVerticalPermissions,
    updateVerticalLevel,
    updateFeatureLevel,
    expandedFeatures,
    setExpandedFeatures
  } = useUserManagement();

  if (loading && users.length === 0) {
    return (
      <div className="user-mgmt-loading">
        <div className="halo-spinner"></div>
        <span>Loading secure user records...</span>
      </div>
    );
  }

  return (
    <div className="management-view-container">
      <MasterPageHeader
        title="User Management"
        description="Configure application roles, vertical access, and granular feature-level permissions."
        expandedLeft={
          <div className="view-mode-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        }
      />

      {status.text && (
        <div className={`status-banner ${status.type}`} style={{ marginTop: '20px' }}>
          <span>{status.text}</span>
          <button className="status-close" onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      <UserList 
        users={users} 
        viewMode={viewMode} 
        onEdit={openEditor} 
      />

      {editingUser && (
        <UserEditorModal
          user={editingUser}
          roleScope={editRoleScope}
          setRoleScope={setEditRoleScope}
          roleLevel={editRoleLevel}
          onLevelChange={handleLevelChange}
          verticalPermissions={editVerticalPermissions}
          onVerticalLevelChange={updateVerticalLevel}
          onFeatureLevelChange={updateFeatureLevel}
          expandedVertical={expandedFeatures}
          setExpandedVertical={setExpandedFeatures}
          onClose={closeEditor}
          onSave={handleSyncPermissions}
          loading={loading}
        />
      )}
    </div>
  );
};

export default UserManagement;
