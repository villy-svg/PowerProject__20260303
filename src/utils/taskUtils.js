/**
 * taskUtils
 * Utility functions for task display and RBAC logic.
 * 
 * IMPORTANT: assigned_to is now a uuid[] array.
 * Use isAssignee(task, user) helper for all membership checks.
 */

/**
 * Internal helper: checks if a user is in the task's assigned_to array.
 * Handles both employeeId and auth user.id comparisons.
 */
const isAssignee = (task, user) => {
  if (!task?.assigned_to?.length) return false;
  return (
    (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
    (user?.id && task.assigned_to.includes(user.id))
  );
};

export const taskUtils = {
  /**
   * PUBLIC: Checks if a user is in the task's assigned_to array.
   * Handles both employeeId and auth user.id comparisons.
   * This is the public counterpart to the private `const isAssignee` above.
   * Use this when calling from outside this file (hooks, components).
   *
   * @param {Object} task - The task entity. Must have an `assigned_to` array.
   * @param {Object} user - The current logged-in user. Has `.id` and optionally `.employeeId`.
   * @returns {boolean} True if the user is assigned to the task.
   */
  isAssignee(task, user) {
    if (!task?.assigned_to?.length) return false;
    return (
      (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
      (user?.id && task.assigned_to.includes(user.id))
    );
  },

  /**
   * Evaluates if user meets the seniority threshold for management.
   * Seniority level GREATER THAN 6 constitutes managerial authority.
   * Seniority level 6 or below is considered field staff.
   *
   * @param {Object} user - The current logged-in user. Must have `.seniority`.
   * @returns {boolean} True if the user is a manager (seniority > 6).
   */
  isManager(user) {
    return user?.seniority > 6;
  },

  /**
   * Validates task creation ownership.
   * Checks both camelCase (createdBy) and snake_case (created_by) field names.
   *
   * @param {Object} task - The task entity.
   * @param {Object} user - The current logged-in user. Must have `.id`.
   * @returns {boolean} True if the user created the task.
   */
  isCreator(task, user) {
    if (!task || !user) return false;
    return (task.createdBy || task.created_by) === user.id;
  },

  /**
   * Returns "You" if the task is assigned to the current user,
   * otherwise returns the assignee's first name.
   * For multi-assignee tasks, returns the first assignee name.
   */
  getAssigneeLabel(task, currentUser) {
    if (!task?.assigned_to?.length) return 'None';

    const isMe = isAssignee(task, currentUser);
    const count = task.assigned_to.length;

    // Rule 1: If I am an assignee, just show "You"
    if (isMe) {
      return 'You';
    }

    // Rule 2: If others are assigned, show senior-most based on Badge ID
    if (task.assigneeMeta && task.assigneeMeta.length > 0) {
      // Sort meta by badge_id (assuming lower string/number is more senior)
      // If badge_id is missing, use seniority_level
      const sorted = [...task.assigneeMeta].sort((a, b) => {
        const badgeA = String(a.badge_id || '999999');
        const badgeB = String(b.badge_id || '999999');
        if (badgeA !== badgeB) return badgeA.localeCompare(badgeB);
        
        const levelA = a.seniority_level ?? 999;
        const levelB = b.seniority_level ?? 999;
        return levelA - levelB;
      });

      const senior = sorted[0];
      const name = senior.full_name.split(' ')[0];
      return name;
    }

    // Fallback if metadata isn't joined
    if (task.assigneeName) {
      const first = task.assigneeName.split(',')[0].trim().split(' ')[0];
      return first;
    }

    return task.assigned_to?.length > 0 ? 'Assigned' : 'Unassigned';
  },

  /**
   * Returns a detailed tooltip string for the assignee.
   */
  getAssigneeTooltip(task) {
    if (!task?.assigned_to?.length) return 'No assignee';
    return `Assignees: ${task.assigneeName || 'Unknown'}`;
  },

  /**
   * Formats a raw employee ID/name into the "YOU" format for lists/dropdowns.
   * assigneeId can now be an array — takes the first element for comparison.
   */
  formatAssigneeForList(assigneeIdOrArray, assigneeName, currentUser) {
    if (!assigneeName) return 'Unassigned';

    // Support both array and single-value inputs
    const firstId = Array.isArray(assigneeIdOrArray) ? assigneeIdOrArray[0] : assigneeIdOrArray;

    const isMe = (currentUser?.employeeId && firstId === currentUser.employeeId) ||
      (currentUser?.id && firstId === currentUser.id);

    if (isMe) {
      return `You (${assigneeName})`;
    }
    return assigneeName;
  },

  /**
   * Universal Task Prefixing Principle
   */
  formatTaskText(text, options = {}) {
    let finalTaskText = (text || '').trim();
    const funcLower = (options.functionName || '').toLowerCase();

    if (funcLower === 'hiring') {
      const prefix = "Hire : ";
      if (!finalTaskText.startsWith(prefix)) {
        finalTaskText = `${prefix}${finalTaskText}`;
      }
    }
    else if (options.assetCode && (funcLower === 'facility' || options.forcePrefix)) {
      const code = options.assetCode;
      const prefix = `${code} : `;

      if (!finalTaskText.includes(" : ")) {
        finalTaskText = `${prefix}${finalTaskText}`;
      } else if (!finalTaskText.startsWith(prefix)) {
        const parts = finalTaskText.split(" : ");
        if (parts.length > 1) {
          finalTaskText = `${prefix}${parts.slice(1).join(" : ")}`;
        } else {
          finalTaskText = `${prefix}${finalTaskText}`;
        }
      }
    }

    return finalTaskText;
  },

  /**
   * RBAC: Can the user move this task to a specific stage?
   */
  canUserMoveTask(task, targetStageId, permissions, user) {
    if (!task || task.isContextOnly) return false;
    if (permissions.canUpdate) return true;

    const isCreator = (task.createdBy || task.created_by) === user.id;
    const assignee = isAssignee(task, user);

    if (permissions.level === 'contributor') {
      if (targetStageId === 'DEPRIORITIZED') return false;
      if (isCreator) return true;
      if (['REVIEW', 'COMPLETED'].includes(task.stageId)) return false;
      return ['BACKLOG', 'IN_PROGRESS'].includes(targetStageId);
    }

    if (permissions.level === 'viewer' && assignee) {
      return false;
    }

    return false;
  },

  /**
   * RBAC: Can the user edit a specific field in the modal?
   */
  canUserEditField(task, fieldName, permissions, user) {
    if (!task) return true;
    if (task.isContextOnly) return false;

    const isCreator = (task.createdBy || task.created_by) === user.id;

    if (permissions.canUpdate || (permissions.level === 'contributor' && isCreator)) {
      return true;
    }

    const assignee = isAssignee(task, user);

    if (['contributor', 'viewer'].includes(permissions.level) && assignee) {
      return fieldName === 'description';
    }

    return false;
  }
};
