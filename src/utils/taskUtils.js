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
  }
};
