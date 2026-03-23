/**
 * Hierarchy Service
 * Centralizes complex user-employee mapping rules and task visibility hierarchies.
 * Standardizes "over-and-above" RBAC logic for seniority-based restrictions.
 *
 * Canonical location: src/services/core/hierarchyService.js
 */

export const hierarchyService = {
  /**
   * Determines the seniority level and employee ID for a user profile.
   * Expected to be used during the profile assembly in profileService.js.
   *
   * @param {Object} profile - Raw user_profile record.
   * @param {Object|null} employee - Linked employee record (joined or separate fetch).
   * @param {Object|null} role - Linked employee_role record.
   * @returns {{ employeeId: string|null, seniority: number }}
   */
  resolveUserHierarchy(profile, employee, role) {
    return {
      employeeId: profile?.employee_id || employee?.id || null,
      seniority: role?.seniority_level || 100, // 100 = Default high seniority for non-employees
    };
  },

  /**
   * Enforces task visibility rules based on seniority and vertical context.
   *
   * @param {Object} user - The current normalized user object.
   * @param {Array} tasks - Pre-filtered tasks (by vertical/status).
   * @param {string} activeVertical - The current UI vertical context.
   * @returns {Array} Subset of tasks the user is allowed to see.
   */
  filterTasksByHierarchy(user, tasks, activeVertical) {
    if (!user || user.roleId === 'master_admin') return tasks;

    const seniority = user.seniority ?? 100;
    const employeeId = user.employeeId;

    // HUB VISIBILITY RULE:
    // Seniority <= 2 (e.g., junior field staff) only see tasks assigned to them.
    const isHubVertical = ['CHARGING_HUBS', 'hub_tasks', 'daily_hub_tasks'].includes(activeVertical);
    
    if (isHubVertical && seniority <= 2) {
      // If no employeeId is linked, they see nothing (security fallback)
      if (!employeeId) return [];
      
      return (tasks || []).filter(task => {
        // Strict assignment check
        return task.assigned_to === employeeId;
      });
    }

    return tasks;
  }
};
