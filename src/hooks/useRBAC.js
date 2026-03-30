import { useMemo } from 'react';
import { getPermissionsForLevel, getMinLevel } from '../constants/roles';
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
    const canViewKanbanHierarchy = hierarchyService.canViewKanbanHierarchy(user);

    // -----------------------------------------------------------------------
    // Master Scope: global access, all features visible
    // -----------------------------------------------------------------------
    if (isMasterScope) {
      const masterPerms = {
        ...baseCaps,
        scope: 'global',
        roleId,
        level: roleId.replace('master_', ''),
        canManageRoles: roleId === 'master_admin',
        canAccessClients: true,
        canAccessClientTasks: true,
        canAccessLeadsFunnel: true,
        canAccessEmployees: true,
        canAccessEmployeeTasks: true,
        canAccessHubTasks: true,
        canAccessDailyHubTasks: true,
        canAccessDailyTaskTemplates: true,
        canViewKanbanHierarchy,
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
    const verticalLevel = permData?.level || 'none';
    const featureLevels = permData?.features || {};

    // 1. Calculate effective capabilities at the vertical root level
    const verticalCaps = getPermissionsForLevel(verticalLevel);
    
    // 2. Determine the active feature name (if any) to set the board's effective base level
    // This allows a "Contributor" on a specific board to be treated as a Contributor globally within that view.
    const isFeatureView = current.includes('_') && current !== verticals.CHARGING_HUBS?.id;
    let activeFeatureLevel = verticalLevel; // Default to vertical level
    
    if (isFeatureView || current === verticals.CHARGING_HUBS?.id) {
        // Find matching feature key, e.g. "hub_tasks" -> "canAccessHubTasks"
        let featureKey;
        if (current === verticals.CHARGING_HUBS?.id) featureKey = 'canAccessHubTasks'; // Default board for Hubs
        else {
            const featureName = current.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
            featureKey = `canAccess${featureName}`;
        }
        
        // Scenario 1 & 2: Get specific feature level if it exists, otherwise fallback to vertical level.
        // THEN cap it by the vertical level using getMinLevel (Scenario 2).
        const rawFeatureLevel = featureLevels[featureKey] || verticalLevel;
        activeFeatureLevel = getMinLevel(verticalLevel, rawFeatureLevel);
    }
    
    // 3. The base view caps are now derived from the active feature's capped level, not just the vertical
    // This solves Scenario 1 where `editor` on vertical but `contributor` on board allows edits incorrectly.
    const effectiveCaps = getPermissionsForLevel(activeFeatureLevel);

    // Build final permissions map, starting with effectiveCaps
    const finalPerms = {
      ...effectiveCaps,
      roleId,
      scope: 'assigned',
      canAccessConfig: verticalLevel === 'admin',
      canViewKanbanHierarchy,
    };

    // 4. Feature-granular CRUD flags
    // Cap all granular features by the vertical level (Scenario 2 cascade)
    Object.keys(featureLevels).forEach(fId => {
      const dbFeatureLevel = featureLevels[fId];
      // Cascading downgrade: feature cannot exceed vertical level
      const cappedLevel = getMinLevel(verticalLevel, dbFeatureLevel);
      const featureCaps = getPermissionsForLevel(cappedLevel);
      const featureName = fId.replace('canAccess', '');

      // Boolean visibility flag (used by sidebar and sub-feature guards)
      finalPerms[fId] = cappedLevel !== 'none';

      // Granular CRUD — derived from the capped permission level
      finalPerms[`canCreate${featureName}`] = featureCaps.canCreate;
      finalPerms[`canRead${featureName}`]   = featureCaps.canRead;
      finalPerms[`canUpdate${featureName}`] = featureCaps.canUpdate;
      finalPerms[`canDelete${featureName}`] = featureCaps.canDelete;
    });

     return finalPerms;
  }, [user, activeVertical, verticals]);

  return permissions;
};
