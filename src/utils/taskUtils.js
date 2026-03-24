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
  }
};
