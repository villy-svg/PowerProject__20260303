// @prod-critical
import React from 'react';
import MasterPageHeader from '../layout/MasterPageHeader';
import UserList from './UserList';
import UserEditorModal from './UserEditorModal';
import PermissionSyncModal from './PermissionSyncModal';
import PresetCreationModal from './PresetCreationModal';
import { useUserManagement } from './useUserManagement';
import { userService } from '../../services/auth/userService';
import { useLayoutShell } from '../../app/shells/useLayoutShell';
import { useAppNavigation } from '../../app/contexts/AppNavigationContext';
import './UserManagement.css';
import MassSyncProgressModal from './MassSyncProgressModal';
/**
 * CATEGORY METADATA
 * Defines display label, description, and semantic color token per lifecycle category.
 * colorToken maps to CSS modifier classes in UserManagement.css.
 */
const CATEGORY_ORDER = ['unactivated', 'unlinked', 'active', 'inactive'];
const CATEGORY_META = {
  unactivated: {
    label: 'Pending Activation',
    description: 'Employee is active but user account has not yet been activated.',
    colorToken: 'warning',
  },
  unlinked: {
    label: 'Unlinked Users',
    description: 'No employee record is linked to this account.',
    colorToken: 'neutral',
  },
  active: {
    label: 'Active Users',
    description: 'Fully active accounts with verified employee records.',
    colorToken: 'success',
  },
  inactive: {
    label: 'Inactive Users',
    description: 'Deactivated accounts, or accounts linked to an inactive employee.',
    colorToken: 'danger',
  },
};

/**
 * UserCategorySection — Presentational component
 * Renders a single lifecycle category block with a header and nested role sub-groups.
 * Extracted to keep UserManagement.jsx modular (avoids God Component violation).
 */
const UserCategorySection = ({ categoryKey, roleGroups, viewMode, onEdit, onDeactivate, onReactivate }) => {
  const meta = CATEGORY_META[categoryKey];
  const totalCount = Object.values(roleGroups).reduce((sum, arr) => sum + arr.length, 0);

  if (totalCount === 0) return null;

  return (
    <div className={`user-category-section user-category-section--${meta.colorToken}`}>
      <div className="user-category-header">
        <div className="user-category-header-left">
          <span className="user-category-label">{meta.label}</span>
          <span className="user-category-desc">{meta.description}</span>
        </div>
        <span className={`user-category-badge user-category-badge--${meta.colorToken}`}>{totalCount}</span>
      </div>

      {/* Role sub-groups within this category */}
      {Object.entries(roleGroups).map(([roleLabel, groupUsers]) => (
        <div key={roleLabel} className="user-role-group">
          <div className="user-role-group-header">
            <span className="user-role-group-label">{roleLabel}</span>
            <span className="user-role-group-count">{groupUsers.length}</span>
          </div>
          <UserList
            users={groupUsers}
            viewMode={viewMode}
            onEdit={onEdit}
            onDeactivate={onDeactivate}
            onReactivate={onReactivate}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * UserManagement Component
 * Entry point for administrative user & permission management.
 * - currentUser: the logged-in admin (used to gate master-admin actions)
 */
const UserManagement = ({ currentUser, setActiveVertical, onShowBottomNav }) => {
  const { shellType } = useLayoutShell();
  const { setIsMobileMenuOpen } = useAppNavigation();
  const isMobile = shellType === 'mobile';

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
    massSyncStatus,
    setMassSyncStatus,
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

  const effectiveViewMode = isMobile ? 'grid' : viewMode;

  // Split users into actual vs preset by the fake email domain used at creation
  const PRESET_EMAIL_SUFFIX = '@preset.local';
  const actualUsers = users.filter(u => !u.email?.endsWith(PRESET_EMAIL_SUFFIX));
  const presetUsers = users.filter(u => u.email?.endsWith(PRESET_EMAIL_SUFFIX));
  const displayedUsers = profileMode === 'preset' ? presetUsers : actualUsers;

  // ─── Categorize & Group ─────────────────────────────────────────────────
  // Step 1: Classify each user into one of 4 lifecycle categories via a
  // strict priority waterfall (first match wins — categories are mutually exclusive).
  //
  //   Unlinked    → no linkedEmployee at all (checked first to guard .status access)
  //   Inactive    → employee exists but status = 'Inactive'
  //   Unactivated → employee active, but user.is_active = false
  //   Active      → employee active AND user.is_active = true
  //
  // Step 2: Within each category, sub-group by human-readable employee role name.
  const getRoleLabel = (u) => {
    const emp = u.linkedEmployee;
    if (!emp) return 'No Employee Profile';
    let roleCode = null;
    if (emp.employee_roles) {
      roleCode = Array.isArray(emp.employee_roles)
        ? emp.employee_roles[0]?.role_code
        : emp.employee_roles.role_code;
    }
    return roleCode
      ? roleCode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : 'Unknown Role';
  };

  const categorizeAndGroup = (userList) => {
    // Initialise all 4 buckets so they always exist in the result
    const buckets = { unactivated: {}, unlinked: {}, active: {}, inactive: {} };

    userList.forEach(u => {
      // Waterfall — order matters
      let category;
      if (!u.linkedEmployee) {
        category = 'unlinked';
      } else if (u.linkedEmployee.status === 'Inactive') {
        category = 'inactive';
      } else if (u.is_active === false) {
        category = 'unactivated';
      } else {
        category = 'active';
      }

      const roleLabel = getRoleLabel(u);
      if (!buckets[category][roleLabel]) buckets[category][roleLabel] = [];
      buckets[category][roleLabel].push(u);
    });

    return buckets;
  };

  const userCategories = categorizeAndGroup(displayedUsers);

  // Is every category empty? (Used for the empty-state guard below)
  const allEmpty = CATEGORY_ORDER.every(
    key => Object.keys(userCategories[key]).length === 0
  );

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
        hideMenuClose={isMobile}
        expandedLeft={
          <div className={isMobile ? "user-mgmt-mobile-menu" : "view-mode-toggle view-mode-toggle--expanded"}>
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

            {!isMobile && <div className="header-divider"></div>}

            {/* Layout view toggle */}
            {!isMobile && (
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
            )}

            {!isMobile && (
              <button
                className="halo-button header-action-btn"
                onClick={() => setIsSyncModalOpen(true)}
                title="Clone permissions from one user to multiple others"
              >
                Mass Sync
              </button>
            )}

            {/* Create Preset — master admin only (Desktop) */}
            {!isMobile && isMasterAdmin && (
              <button
                className="halo-button header-action-btn"
                onClick={() => setIsPresetModalOpen(true)}
                title="Create a new dummy preset profile"
              >
                + Preset
              </button>
            )}

            {/* Mobile Actions Row */}
            {isMobile && (
              <div className="mobile-actions-row">
                <button
                  className="halo-button header-action-btn"
                  onClick={() => setIsSyncModalOpen(true)}
                >
                  Mass Sync
                </button>
                {isMasterAdmin && (
                  <button
                    className="halo-button header-action-btn"
                    onClick={() => setIsPresetModalOpen(true)}
                  >
                    Preset
                  </button>
                )}
                <button
                  className="halo-button header-action-btn mobile-menu-close-custom"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Close
                </button>
              </div>
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

      {/* Lifecycle category sections — rendered in prescribed order */}
      {CATEGORY_ORDER.map(categoryKey => (
        <UserCategorySection
          key={categoryKey}
          categoryKey={categoryKey}
          roleGroups={userCategories[categoryKey]}
          viewMode={effectiveViewMode}
          onEdit={openEditor}
          onDeactivate={handleDeactivate}
          onReactivate={handleReactivate}
        />
      ))}

      {allEmpty && !loading && (
        <div className="empty-state-container">
          <div className="empty-state-icon">👥</div>
          <h3 className="empty-state-title">
            {profileMode === 'preset' ? 'No Presets' : 'No Users'}
          </h3>
          <p className="empty-state-text">
            {profileMode === 'preset'
              ? 'No preset profiles yet. Click "+ Preset" to create one.'
              : 'No user profiles found.'}
          </p>
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
          onSave={(sourceId, targetIds) => {
            handleMassSyncPermissions(sourceId, targetIds);
            setIsSyncModalOpen(false);
          }}
          loading={loading}
        />
      )}

      {massSyncStatus.isOpen && (
        <MassSyncProgressModal 
          status={massSyncStatus}
          onClose={() => setMassSyncStatus({ isOpen: false, results: [], isComplete: false })}
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
