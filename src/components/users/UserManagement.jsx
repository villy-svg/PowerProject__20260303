import React from 'react';
import MasterPageHeader from '../layout/MasterPageHeader';
import UserList from './UserList';
import UserEditorModal from './UserEditorModal';
import PermissionSyncModal from './PermissionSyncModal';
import { useUserManagement } from './useUserManagement';
import './UserManagement.css';

/**
 * UserManagement Component (Refactored)
 * Entry point for administrative user & permission management.
 * Now modularized for extreme safety and auditability.
 */
const UserManagement = ({ setActiveVertical, onShowBottomNav }) => {
  const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);

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
    handleMassSyncPermissions,
    loadPresetPermissions,
    handleDeactivate,
    handleReactivate,
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
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        expandedLeft={
          <div className="view-mode-toggle view-mode-toggle--expanded">
            <div className="view-toggle-group">
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
            
            <div className="header-divider"></div>

            <button 
              className="halo-button header-action-btn" 
              onClick={() => setIsSyncModalOpen(true)}
              title="Clone permissions from one user to multiple others"
            >
              Mass Sync
            </button>
          </div>
        }
      />

      {status.text && (
        <div className={`status-banner ${status.type}`} style={{ marginTop: '20px' }}>
          <span>{status.text}</span>
          <button className="action-icon-btn" onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      <UserList 
        users={users} 
        viewMode={viewMode} 
        onEdit={openEditor}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
      />

      {editingUser && (
        <UserEditorModal
          user={editingUser}
          users={users}
          loadPresetPermissions={loadPresetPermissions}
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

      {isSyncModalOpen && (
        <PermissionSyncModal
          users={users}
          onClose={() => setIsSyncModalOpen(false)}
          onSave={async (sourceId, targetIds) => {
            await handleMassSyncPermissions(sourceId, targetIds);
            setIsSyncModalOpen(false);
          }}
          loading={loading}
        />
      )}
    </div>
  );
};

export default UserManagement;
