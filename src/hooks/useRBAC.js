import { useMemo } from 'react';
 import { getPermissionsForLevel } from '../constants/roles';
 import { hierarchyService } from '../services/rules/hierarchyService';

/**
 * useRBAC Hook
 * Computes the effective permission set for the current user and active vertical.
 * Extracted from App.jsx to keep all security/access-control logic in one place.
 *
 * @param {Object|null} user         - The normalized user object from profileService.
 * @param {string|null} activeVertical - The currently selected vertical key.
 * @returns {Object} permissions     - Flat permissions object passed to all components.
 */
export const useRBAC = (user, activeVertical, verticals = {}) => {
  const permissions = useMemo(() => {
    // Not yet loaded
    if (!user) return { scope: 'loading' };

    const roleId = user.roleId;
    const isMasterScope = roleId?.startsWith('master_');
    const baseCaps = user.baseCapabilities || {};

    // -----------------------------------------------------------------------
    // Master Scope: global access, all features visible
    // -----------------------------------------------------------------------
    if (isMasterScope) {
      const masterPerms = {
        ...baseCaps,
        scope: 'global',
        roleId,
        canManageRoles: roleId === 'master_admin',
        canAccessClients: true,
        canAccessClientTasks: true,
        canAccessLeadsFunnel: true,
        canAccessEmployees: true,
        canAccessEmployeeTasks: true,
        canAccessHubTasks: true,
        canAccessDailyHubTasks: true,
        canAccessDailyTaskTemplates: true,
      };

      // Ensure feature-specific CRUD flags match global CRUD flags for master roles
      const features = [
        'Clients', 'ClientTasks', 'LeadsFunnel', 
        'Employees', 'EmployeeTasks', 'HubTasks', 'DailyHubTasks', 'DailyTaskTemplates'
      ];

      features.forEach(feat => {
        masterPerms[`canCreate${feat}`] = !!baseCaps.canCreate;
        masterPerms[`canRead${feat}`]   = !!baseCaps.canRead;
        masterPerms[`canUpdate${feat}`] = !!baseCaps.canUpdate;
        masterPerms[`canDelete${feat}`] = !!baseCaps.canDelete;
      });

      return masterPerms;
    }

    // -----------------------------------------------------------------------
    // Vertical Scope: derive permissions from vertical + feature assignments
    // -----------------------------------------------------------------------
    const current = activeVertical || 'home';

    // Normalize sub-views back to their root vertical ID
    const rootVerticalId = 
      (current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates') ? verticals.CHARGING_HUBS?.id :
      (current === verticals.CLIENTS?.id || current === 'client_tasks' || current === 'leads_funnel') ? verticals.CLIENTS?.id :
      (current === verticals.EMPLOYEES?.id || current === 'employee_tasks') ? verticals.EMPLOYEES?.id :
      current.toUpperCase();

    const permData = user.verticalPermissions?.[rootVerticalId];
    const level = permData?.level || 'none';
    const featureLevels = permData?.features || {};

    // Base capabilities at the vertical level
    const verticalCaps = getPermissionsForLevel(level);

    // Build final permissions map
    const finalPerms = {
      ...verticalCaps,
      roleId,
      scope: 'assigned',
      canAccessConfig: level === 'admin',
    };

    // Feature-granular CRUD flags
    // Pattern: canAccessClients, canCreateClients, canUpdateClients, etc.
    Object.keys(featureLevels).forEach(fId => {
      const fLvl = featureLevels[fId];
      const featureCaps = getPermissionsForLevel(fLvl);
      const featureName = fId.replace('canAccess', '');

      // Boolean visibility flag (used by sidebar and sub-feature guards)
      finalPerms[fId] = fLvl !== 'none';

      // Granular CRUD — effective = minimum of vertical and feature access
      finalPerms[`canCreate${featureName}`] = verticalCaps.canCreate && featureCaps.canCreate;
      finalPerms[`canRead${featureName}`] = verticalCaps.canRead && featureCaps.canRead;
      finalPerms[`canUpdate${featureName}`] = verticalCaps.canUpdate && featureCaps.canUpdate;
      finalPerms[`canDelete${featureName}`] = verticalCaps.canDelete && featureCaps.canDelete;
    });

    finalPerms.canViewKanbanHierarchy = hierarchyService.canViewKanbanHierarchy(user);

     return finalPerms;
  }, [user, activeVertical, verticals]);

  return permissions;
};
