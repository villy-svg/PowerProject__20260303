/**
 * src/constants/roles.js
 * Central permission schema for PowerProject.
 * Defines Create, Read, Update, and Delete (CRUD) capabilities per role.
 */

export const DEFAULT_ROLE_PERMISSIONS = {
  master_admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canAccessConfig: true,
    canManageRoles: true,
    scope: 'global' // Can see all verticals
  },
  vertical_admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false, // Restricted by default, only Master Admin deletes
    canAccessConfig: true,
    canManageRoles: false,
    scope: 'assigned' // Restricted to assignedVertical
  },
  master_viewer: {
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canAccessConfig: false,
    canManageRoles: false,
    scope: 'global' // Can see all verticals but no editing
  },
  vertical_viewer: {
    canCreate: false,
    canRead: true,
    canUpdate: false,
    canDelete: false,
    canAccessConfig: false,
    canManageRoles: false,
    scope: 'assigned' // Only sees assignedVertical
  }
};

export const ROLE_LIST = [
  { id: 'master_admin', label: 'Master Admin', icon: '👑' },
  { id: 'vertical_admin', label: 'Vertical Admin', icon: '🏢' },
  { id: 'master_viewer', label: 'Master Viewer', icon: '👁️' },
  { id: 'vertical_viewer', label: 'Vertical Viewer', icon: '👤' }
];