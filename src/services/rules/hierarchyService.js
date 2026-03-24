import { MANAGER_SENIORITY_THRESHOLD } from '../../constants/roles';

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
   * @param {Object} permissions - Computed permission set for the current user.
   * @returns {Array} Subset of tasks the user is allowed to see.
   */
  filterTasksByHierarchy(user, tasks, activeVertical, verticals = {}, permissions = {}) {
    // Master Admin or Global Scope bypasses hierarchy filters IF they don't have a restricted seniority
    if (!user) return tasks;
    
    const seniority = Number(user.seniority ?? 100);
    const employeeId = user.employeeId;
    
    // Core Restricted Rule: Seniority-based only (future-proof)
    const isRestrictedScope = seniority <= MANAGER_SENIORITY_THRESHOLD;

    // RULE: Assigned Scope AND Seniority <= MANAGER_SENIORITY_THRESHOLD
    // User can only see and work on:
    // 1. Tasks Assigned to them
    // 2. Tasks Created by their reportees or members in their tree
    if (isRestrictedScope) {
      // If no employeeId is linked for a restricted user, they can only see tasks they created
      // previously we returned [], which hid their own created tasks if they weren't linked yet.
      // if (!employeeId) return []; 
      
      const reporteeUserIds = user.reporteeUserIds || [];
      const taskMap = new Map((tasks || []).map(t => [t.id, t]));

      const directMatches = (tasks || []).filter(task => {
        const creatorId = task.createdBy || task.created_by;
        const assigneeId = task.assigned_to || task.employee_id;
        
        const isAssignedToMe = (assigneeId === employeeId) || (assigneeId === user.id);
        const isCreatedByMe = (creatorId === user.id) || (creatorId === user.employeeId);
        const isCreatedByTreeMember = (reporteeUserIds || []).includes(creatorId) || 
                                      (user.reporteeEmployeeIds || []).includes(creatorId) || 
                                      isCreatedByMe;
        
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

    // Default: Seniority > MANAGER_SENIORITY_THRESHOLD sees all tasks in the vertical
    return tasks;
  },

  /**
   * Calculates the total and completed recursive descendants for a given task.
   * Useful for progress badges in the Kanban board.
   * 
   * @param {string} taskId 
   * @param {Array} tasks 
   * @returns {{ total: number, completed: number }}
   */
  getRecursiveTaskStats(taskId, tasks) {
    if (!taskId || !tasks || tasks.length === 0) return { total: 0, completed: 0 };

    const taskMap = new Map();
    tasks.forEach(t => {
      const parentId = t.parentTask;
      if (parentId) {
        if (!taskMap.has(parentId)) taskMap.set(parentId, []);
        taskMap.get(parentId).push(t);
      }
    });

    const countRecursive = (id) => {
      const children = taskMap.get(id) || [];
      let total = children.length;
      let completed = children.filter(c => c.stageId === 'COMPLETED').length;
      
      children.forEach(child => {
        const stats = countRecursive(child.id);
        total += stats.total;
        completed += stats.completed;
      });
      
      return { total, completed };
    };

    return countRecursive(taskId);
  },

  /**
   * Determines if the user should see the project-level drill-down board or the flat assignee board.
   * @param {Object} user 
   * @returns {boolean}
   */
  canViewKanbanHierarchy(user) {
    if (!user) return false;
    return (user.seniority || 0) > MANAGER_SENIORITY_THRESHOLD;
  }
};
