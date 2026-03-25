import { useMemo, useCallback } from 'react';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';

/**
 * useTaskPermissions Hook
 * Centralizes all security and permission logic for task management.
 */
export const useTaskPermissions = ({
  user,
  permissions,
  activeVertical,
  rootVerticalId
}) => {
  // 1. Feature-specific CRUD flags
  const featureBaseName = useMemo(() => 
    activeVertical.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''),
    [activeVertical]
  );

  const fCanCreate = useMemo(() => permissions[`canCreate${featureBaseName}`] ?? permissions.canCreate, [permissions, featureBaseName]);
  const fCanUpdate = useMemo(() => permissions[`canUpdate${featureBaseName}`] ?? permissions.canUpdate, [permissions, featureBaseName]);
  const fCanDelete = useMemo(() => permissions[`canDelete${featureBaseName}`] ?? permissions.canDelete, [permissions, featureBaseName]);

  // 2. Vertical Access Check
  const hasVerticalAccess = useMemo(() => {
    if (permissions.scope === 'global') return true;
    const assigned = user?.assignedVerticals || [];
    return (
      assigned.includes(rootVerticalId) ||
      assigned.includes(activeVertical) ||
      assigned.includes(activeVertical.toUpperCase())
    );
  }, [user, permissions.scope, rootVerticalId, activeVertical]);

  // 3. Final CRUD Permission Flags
  const canUserCreate = fCanCreate && hasVerticalAccess;
  const canUserUpdate = fCanUpdate && hasVerticalAccess;
  const canUserDelete = fCanDelete && hasVerticalAccess;

  // 4. Hierarchy Management Permission
  // Replaces generic canUserUpdate for hierarchy-mutating actions (DND, add subtask).
  const canManageHierarchy = useCallback((task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;
    
    // Managers/Seniors can manage anything
    if (user.seniority > MANAGER_SENIORITY_THRESHOLD) return true;

    // Others can only manage tasks they created
    const isCreator = (task.createdBy || task.created_by) === user.id;
    return isCreator;
  }, [user.seniority, user.id]);

  return {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy
  };
};
