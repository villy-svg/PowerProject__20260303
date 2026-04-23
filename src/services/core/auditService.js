/**
 * Audit Service
 * Centralizes task audit tracking (created_by, last_updated_by).
 * Both tasks and daily_tasks now use snake_case timestamps uniformly.
 *
 * Canonical location: src/services/core/auditService.js
 */

export const auditService = {
  /**
   * Applies audit stamps to a database row.
   * 
   * @param {Object} row - The Supabase row object being prepared for insert/update.
   * @param {string} userId - The unique ID of the performing user.
   * @param {Object} options - Configuration for the stamp.
   * @param {boolean} options.isNew - If true, sets created_by and created_at.
   * @param {boolean} options.useUnderscore - Deprecated (now always true). Kept for API compatibility.
   * @returns {Object} The row with audit fields attached.
   */
  stamp(row, userId, { isNew = false } = {}) {
    if (!userId) {
      console.warn('AuditService: userId is null or undefined. Audit stamp will be incomplete.');
      return {
        ...row,
        updated_at: new Date().toISOString()
      };
    }

    const stamp = {
      last_updated_by: userId,
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      stamp.created_by = userId;
      stamp.created_at = new Date().toISOString();
    }

    return { ...row, ...stamp };
  }
};
