/**
 * Clone Utilities
 * Centralizes the logic for duplicating entities (Tasks, Clients, Employees, etc.)
 * while stripping unique identifiers and audit metadata.
 */

export const cloneUtils = {
  /**
   * prepareClone
   * Generic stripper for any database-backed entity.
   * Removes IDs and timestamps, and applies a suffix to the primary identifying field.
   * 
   * @param {Object} entity - The source entity to clone
   * @param {Object} options - Configuration for cloning
   * @param {string} options.titleField - The field to append "(Copy)" to (e.g., 'text', 'name')
   * @returns {Object} The sanitized clone data
   */
  prepareClone: (entity, options = { titleField: 'text' }) => {
    if (!entity) return null;

    // 1. Extract non-clonable system fields
    const { 
      id, 
      created_at, 
      createdAt,
      updated_at, 
      updatedAt,
      latestSubmission, 
      status_history,
      is_duplicate,
      duplicateCount,
      isFirstInCluster,
      // Task-specific calculated fields that might be present
      childCount,
      hasReviewDescendant,
      ...clonableData 
    } = entity;

    // 2. Apply suffix to the identifying field for clarity
    const titleField = options.titleField || 'text';
    if (clonableData[titleField]) {
      clonableData[titleField] = `${clonableData[titleField]} (Copy)`;
    }

    return clonableData;
  }
};
