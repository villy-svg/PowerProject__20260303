/**
 * Audit Service
 * Centralizes task audit tracking (created_by, last_updated_by).
 * Handles cross-table inconsistencies (e.g., snake_case vs. camelCase timestamps).
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
   * @param {boolean} options.isNew - If true, sets created_by and createdat.
   * @param {boolean} options.useUnderscore - If true, uses created_at/updated_at instead of createdat/updatedat.
   * @returns {Object} The row with audit fields attached.
   */
  stamp(row, userId, { isNew = false, useUnderscore = false } = {}) {
    if (!userId) {
      console.warn('AuditService: userId is null or undefined. Audit stamp will be incomplete.');
      return {
        ...row,
        [useUnderscore ? 'updated_at' : 'updatedat']: new Date().toISOString()
      };
    }

    const stamp = {
      last_updated_by: userId,
      [useUnderscore ? 'updated_at' : 'updatedat']: new Date().toISOString()
    };

    if (isNew) {
      stamp.created_by = userId;
      stamp[useUnderscore ? 'created_at' : 'createdat'] = new Date().toISOString();
    }

    return { ...row, ...stamp };
  }
};
