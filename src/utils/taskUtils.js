export const taskUtils = {
  /**
   * Returns "YOU" if the task is assigned to the current user,
   * otherwise returns the assignee's first name.
   * @param {Object} task - The task object containing assignee info.
   * @param {Object} currentUser - The currently logged-in user object.
   * @returns {string} The display label for the assignee badge.
   */
  getAssigneeLabel(task, currentUser) {
    if (!task?.assigned_to) return 'NULL';
    
    const isMe = (currentUser?.employeeId && task.assigned_to === currentUser.employeeId) || 
                 (currentUser?.id && task.assigned_to === currentUser.id);
                 
    if (isMe) return 'YOU';
    
    // Fallback to formatting the name
    if (task.assigneeName) {
      return task.assigneeName.split(' ')[0];
    }
    
    return '...'; 
  },

  /**
   * Returns a detailed tooltip string for the assignee.
   * @param {Object} task - The task object.
   * @returns {string} Tooltip text.
   */
  getAssigneeTooltip(task) {
    if (!task?.assigned_to) return 'No assignee';
    return `Assignee: ${task.assigneeName || 'Unknown'}`;
  },

  /**
   * Formats a raw employee object or string into the "YOU" format for lists/dropdowns.
   * @param {string} assigneeId - The ID of the assignee.
   * @param {string} assigneeName - The full name of the assignee.
   * @param {Object} currentUser - The currently logged-in user.
   * @returns {string} Formatted string, e.g., "YOU (John Doe)" or "Jane Smith".
   */
  formatAssigneeForList(assigneeId, assigneeName, currentUser) {
    if (!assigneeName) return 'Unassigned';
    
    const isMe = (currentUser?.employeeId && assigneeId === currentUser.employeeId) || 
                 (currentUser?.id && assigneeId === currentUser.id);

    if (isMe) {
      return `YOU (${assigneeName})`;
    }
    return assigneeName;
  },

  /**
   * Universal Task Prefixing Principle
   * Applies "CODE : Summary" formatting based on vertical context.
   * @param {string} text - The raw task summary.
   * @param {Object} options - Contextual metadata (assetCode, functionName, forcePrefix).
   * @returns {string} Formatted task text.
   */
  formatTaskText(text, options = {}) {
    let finalTaskText = (text || '').trim();
    const funcLower = (options.functionName || '').toLowerCase();

    // 1. Hiring tasks always get "Hire : " prefix
    if (funcLower === 'hiring') {
      const prefix = "Hire : ";
      if (!finalTaskText.startsWith(prefix)) {
         // If it has another prefix, replace it? No, just ensure Hire: is leading
         finalTaskText = `${prefix}${finalTaskText}`;
      }
    } 
    // 2. Asset-based tasks (Hubs, Clients, etc) get the Asset Code prefix
    else if (options.assetCode && (funcLower === 'facility' || options.forcePrefix)) {
      const code = options.assetCode;
      const prefix = `${code} : `;
      
      if (!finalTaskText.includes(" : ")) {
        // No prefix at all, add it
        finalTaskText = `${prefix}${finalTaskText}`;
      } else if (!finalTaskText.startsWith(prefix)) {
        // Has a different prefix, replace the code part if it looks like a code
        // Generic approach: split by " : " and replace first part
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
    
    // Admin/Editor can do anything
    if (permissions.canUpdate) return true;
    
    const isCreator = (task.createdBy || task.created_by) === user.id;
    const isAssignee = (user.employeeId && task.assigned_to === user.employeeId) || (user.id && task.assigned_to === user.id);

    // Contributor logic
    if (permissions.level === 'contributor') {
      // Forbidden for all Contributors
      if (targetStageId === 'DEPRIORITIZED') return false;

      if (isCreator) {
        // Creator-Contributors can move to any stage (except DEPRIORITIZED above)
        return true; 
      }

      if (isAssignee) {
        // Assignee-only Contributors: restricted to BACKLOG ↔ IN_PROGRESS.
        // To reach REVIEW, they MUST use "Submit for Review" (proof of work flow).
        return ['BACKLOG', 'IN_PROGRESS'].includes(targetStageId);
      }
    }

    // Viewer-as-Assignee logic
    if (permissions.level === 'viewer' && isAssignee) {
      // Can move till REVIEW (Forbidden: COMPLETED, DEPRIORITIZED)
      return targetStageId !== 'COMPLETED' && targetStageId !== 'DEPRIORITIZED';
    }

    return false;
  },

  /**
   * RBAC: Can the user edit a specific field in the modal?
   */
  canUserEditField(task, fieldName, permissions, user) {
    if (!task) return true; // Add mode
    if (task.isContextOnly) return false;

    const isCreator = (task.createdBy || task.created_by) === user.id;

    // Admin/Editor OR a Contributor who authored the task can edit everything
    if (permissions.canUpdate || (permissions.level === 'contributor' && isCreator)) {
      return true;
    }

    const isAssignee = (user.employeeId && task.assigned_to === user.employeeId) || (user.id && task.assigned_to === user.id);

    // If they aren't fully authorized above, they might still have assignee description-only rights
    if (['contributor', 'viewer'].includes(permissions.level) && isAssignee) {
      return fieldName === 'description';
    }

    return false;
  }
};
