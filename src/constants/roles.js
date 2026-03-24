/**
 * src/constants/roles.js
 * Central permission schema for PowerProject.
 * Defines Create, Read, Update, and Delete (CRUD) capabilities per role.
 */
 
export const MANAGER_SENIORITY_THRESHOLD = 6;
 
export const DEFAULT_ROLE_PERMISSIONS = {
  // --- MASTER SCOPE (Global Access) ---
  master_admin: {
    canCreate: true, canRead: true, canUpdate: true, canDelete: true,
    canAccessConfig: true, canManageRoles: true, scope: 'global'
  },
  master_editor: {
    canCreate: true, canRead: true, canUpdate: true, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'global'
  },
  master_contributor: {
    canCreate: true, canRead: true, canUpdate: false, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'global'
  },
  master_viewer: {
    canCreate: false, canRead: true, canUpdate: false, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'global'
  },

  // --- VERTICAL SCOPE (Assigned Access Only) ---
  vertical_admin: {
    canCreate: true, canRead: true, canUpdate: true, canDelete: true,
    canAccessConfig: true, canManageRoles: false, scope: 'assigned'
  },
  vertical_editor: {
    canCreate: true, canRead: true, canUpdate: true, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'assigned'
  },
  vertical_contributor: {
    canCreate: true, canRead: true, canUpdate: false, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'assigned'
  },
  vertical_viewer: {
    canCreate: false, canRead: true, canUpdate: false, canDelete: false,
    canAccessConfig: false, canManageRoles: false, scope: 'assigned'
  }
};

export const ROLE_LEVELS = [
  { id: 'viewer', label: 'Viewer', description: 'Read Only' },
  { id: 'contributor', label: 'Contributor', description: 'Read + Create' },
  { id: 'editor', label: 'Editor', description: 'Read + Create + Update' },
  { id: 'admin', label: 'Admin', description: 'Full CRUD' }
];

export const ROLE_SCOPES = [
  { id: 'master', label: 'Master', description: 'Global access across all verticals' },
  { id: 'vertical', label: 'Vertical', description: 'Restricted to assigned verticals' }
];

export const ROLE_LIST = Object.keys(DEFAULT_ROLE_PERMISSIONS).map(id => ({
  id,
  label: id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
  icon: id.includes('master') ? '👑' : '🏢'
}));

/**
 * Returns permissions flags for a given capability level.
 * @param {string} level - 'admin', 'editor', 'contributor', or 'viewer'
 * @returns {object} CRUD flags
 */
export const getPermissionsForLevel = (level) => {
  switch (level) {
    case 'admin':
      return { canCreate: true, canRead: true, canUpdate: true, canDelete: true };
    case 'editor':
      return { canCreate: true, canRead: true, canUpdate: true, canDelete: false };
    case 'contributor':
      return { canCreate: true, canRead: true, canUpdate: false, canDelete: false };
    case 'viewer':
    default:
      return { canCreate: false, canRead: true, canUpdate: false, canDelete: false };
  }
};