import React from 'react';
import MasterPageHeader from '../layout/MasterPageHeader';
import UserList from './UserList';
import UserEditorModal from './UserEditorModal';
import PermissionSyncModal from './PermissionSyncModal';
import PresetCreationModal from './PresetCreationModal';
import { useUserManagement } from './useUserManagement';
import { userService } from '../../services/auth/userService';
import './UserManagement.css';

/**
 * UserManagement Component
 * Entry point for administrative user & permission management.
 * - currentUser: the logged-in admin (used to gate master-admin actions)
 */
const UserManagement = ({ currentUser, setActiveVertical, onShowBottomNav }) => {
  const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = React.useState(false);
  // 'actual' shows real users; 'preset' shows dummy preset profiles
  const [profileMode, setProfileMode] = React.useState('actual');

  const isMasterAdmin = currentUser?.roleId === 'master_admin';

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

  // Split users into actual vs preset by the fake email domain used at creation
  const PRESET_EMAIL_SUFFIX = '@preset.local';
  const actualUsers = users.filter(u => !u.email?.endsWith(PRESET_EMAIL_SUFFIX));
  const presetUsers = users.filter(u => u.email?.endsWith(PRESET_EMAIL_SUFFIX));
  const displayedUsers = profileMode === 'preset' ? presetUsers : actualUsers;

  // Group displayed users by employee role name (or a fallback bucket)
  const groupUsersByRole = (userList) => {
    const groups = {};
    userList.forEach(u => {
      const emp = u.linkedEmployee;
      // Try to get a human-readable role name from the employee record
      let roleCode = null;
      if (emp?.employee_roles) {
        if (Array.isArray(emp.employee_roles)) {
          roleCode = emp.employee_roles[0]?.role_code;
        } else {
          roleCode = emp.employee_roles.role_code;
        }
      }
      
      const roleLabel = roleCode
        ? roleCode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : 'Unlinked / No Employee Profile';
      if (!groups[roleLabel]) groups[roleLabel] = [];
      groups[roleLabel].push(u);
    });
    return groups;
  };

  const userGroups = groupUsersByRole(displayedUsers);

  const handleCreatePreset = async (name) => {
    setIsPresetModalOpen(false);
    setStatus({ type: '', text: '' });

    try {
      await userService.createPresetUser(name);
      // Allow DB trigger to fire then reload
      setTimeout(() => { window.location.reload(); }, 1000);
      setStatus({ type: 'success', text: `Preset Profile "${name}" created. The page will refresh shortly.` });
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', text: 'Failed to create preset. Ensure you are a master admin and the migration is applied.' });
    }
  };

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
            {/* Profile Mode Toggle */}
            <div className="view-toggle-group">
              <button
                className={`view-toggle-btn ${profileMode === 'actual' ? 'active' : ''}`}
                onClick={() => setProfileMode('actual')}
              >
                Users
              </button>
              <button
                className={`view-toggle-btn ${profileMode === 'preset' ? 'active' : ''}`}
                onClick={() => setProfileMode('preset')}
              >
                Presets
              </button>
            </div>

            <div className="header-divider"></div>

            {/* Layout view toggle */}
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

            {/* Create Preset — master admin only */}
            {isMasterAdmin && (
              <button
                className="halo-button header-action-btn"
                onClick={() => setIsPresetModalOpen(true)}
                title="Create a new dummy preset profile"
              >
                + Preset
              </button>
            )}
          </div>
        }
      />

      {status.text && (
        <div className={`status-banner ${status.type} user-management__section-gap`}>
          <span>{status.text}</span>
          <button className="action-icon-btn" onClick={() => setStatus({ type: '', text: '' })}>×</button>
        </div>
      )}

      {/* Grouped user list */}
      {Object.entries(userGroups).map(([roleLabel, groupUsers]) => (
        <div key={roleLabel} className="user-role-group">
          <div className="user-role-group-header">
            <span className="user-role-group-label">{roleLabel}</span>
            <span className="user-role-group-count">{groupUsers.length}</span>
          </div>
          <UserList
            users={groupUsers}
            viewMode={viewMode}
            onEdit={openEditor}
            onDeactivate={handleDeactivate}
            onReactivate={handleReactivate}
          />
        </div>
      ))}

      {displayedUsers.length === 0 && !loading && (
        <div className="empty-state user-management__empty-state">
          {profileMode === 'preset'
            ? 'No preset profiles yet. Click "+ Preset" to create one.'
            : 'No user profiles found.'}
        </div>
      )}

      {editingUser && (
        <UserEditorModal
          user={editingUser}
          users={profileMode === 'actual' ? presetUsers : []}
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

      {isPresetModalOpen && (
        <PresetCreationModal
          onClose={() => setIsPresetModalOpen(false)}
          onSave={handleCreatePreset}
          loading={loading}
        />
      )}
    </div>
  );
};

export default UserManagement;
