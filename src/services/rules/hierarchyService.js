/**
 * Hierarchy Service
 * Centralizes complex user-employee mapping rules and task visibility hierarchies.
 * Standardizes "over-and-above" RBAC logic for seniority-based restrictions.
 *
 * Canonical location: src/services/rules/hierarchyService.js
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
   * @param {Object} verticals - Map of dynamic verticals from backend (optional).
   * @returns {Array} Subset of tasks the user is allowed to see.
   */
  filterTasksByHierarchy(user, tasks, activeVertical, verticals = {}) {
    // Master Admin or Global Scope bypasses hierarchy filters IF they don't have a restricted seniority
    if (!user) return tasks;
    if (user.roleId === 'master_admin' && (user.seniority > 5 || !user.seniority)) return tasks;

    const seniority = Number(user.seniority ?? 100);
    const employeeId = user.employeeId;

    // RULE: Seniority <= 5
    // User can only see and work on:
    // 1. Tasks Assigned to them
    // 2. Tasks Created by their reportees or members in their tree
    if (seniority <= 5) {
      // If no employeeId is linked, they see nothing (security fallback)
      if (!employeeId) return [];
      
      const reporteeUserIds = user.reporteeUserIds || [];
      const taskMap = new Map((tasks || []).map(t => [t.id, t]));

      // 1. Identify tasks directly visible to the user
      const directMatches = (tasks || []).filter(task => {
        const creatorId = task.createdBy || task.created_by;
        const isAssignedToMe = task.assigned_to === employeeId;
        const isCreatedByTreeMember = reporteeUserIds.includes(creatorId) || (creatorId === user.id);
        return isAssignedToMe || isCreatedByTreeMember;
      });

      const directMatchIds = new Set(directMatches.map(t => t.id));
      const allVisibleTaskIds = new Set(directMatchIds);

      // 2. Identify and include all ancestors of direct matches to provide context
      directMatches.forEach(task => {
        let curr = task;
        // Ascend the tree
        while (curr.parentTask && taskMap.has(curr.parentTask)) {
          curr = taskMap.get(curr.parentTask);
          if (allVisibleTaskIds.has(curr.id)) break; // Already processed this path
          allVisibleTaskIds.add(curr.id);
        }
      });

      // 3. Return the union, marking non-direct matches as context-only
      return (tasks || [])
        .filter(t => allVisibleTaskIds.has(t.id))
        .map(t => ({
          ...t,
          isContextOnly: !directMatchIds.has(t.id)
        }));
    }

    // Default: Seniority > 5 sees all tasks in the vertical
    return tasks;
  }
};
