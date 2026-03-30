/**
 * Task Service
 * Stateless service for all Supabase CRUD operations on the `tasks` table.
 * Canonical location: src/services/tasks/taskService.js
 *
 * Consuming hook: src/hooks/useTasks.js
 */
import { supabase } from '../core/supabaseClient';
import { auditService } from '../core/auditService';

// ---------------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------------

/**
 * Maps a Supabase row (lowercase column names) to the camelCase shape
 * the rest of the app expects. Handles optional joined employee data.
 */
const normalizeTask = (row) => {
  const latestSubmission = row.submissions?.length > 0
    ? [...row.submissions].sort((a, b) => b.submission_number - a.submission_number)[0]
    : null;

  return {
    id: row.id,
    text: row.text,
    verticalId: row.verticalid ?? row.verticalId,
    stageId: row.stageid ?? row.stageId,
    priority: row.priority,
    description: row.description,
    hub_id: row.hub_id,
    city: row.city,
    function: row.function,
    assigned_to: row.assigned_to,
    assigneeName: row.employees?.full_name || row.assigneeName,
    parentTask: row.parent_task || null,
    createdAt: row.created_at ?? row.createdat ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedat ?? row.updatedAt,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
    latestSubmission,
  };
};

/**
 * Maps a camelCase task object to the Supabase column-name shape for inserts/updates.
 */
const mapTaskToRow = (task) => ({
  text: task.text,
  verticalid: task.verticalId,
  stageid: task.stageId,
  priority: task.priority || null,
  description: task.description || null,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function: task.function || null,
  assigned_to: task.assigned_to || null,
  parent_task: task.parentTask || null,
  last_updated_by: task.lastUpdatedBy || null,
});

/** Standard select string: includes explicit employee join and latest submissions. */
const TASK_SELECT = '*, employees!assigned_to (full_name), submissions(id, status, rejection_reason, submission_number, created_at)';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const taskService = {
  /**
   * Fetch all tasks, joined with employee names for assignees.
   * @returns {Array} Normalized task array.
   */
  async getTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT);
    // Sort logic handled in normalization if needed, or by standard name
    const sorted = (data || []).sort((a,b) => (a.updated_at || a.updatedat) > (b.updated_at || b.updatedat) ? 1 : -1);

    if (error) throw error;
    return (data || []).map(normalizeTask);
  },

  /**
   * Add a new task. Expects a fully formed task object (use createInitialTask first).
   * @param {Object} taskData - camelCase task shape.
   * @returns {Object} The normalized, newly created task.
   */
  async addTask(taskData, userId) {
    let row = {
      id: taskData.id,
      ...mapTaskToRow(taskData),
    };

    row = auditService.stamp(row, userId, { isNew: true });

    const { data, error } = await supabase
      .from('tasks')
      .insert([row])
      .select(TASK_SELECT);

    if (error) throw error;
    return normalizeTask(data[0]);
  },

  /**
   * Fully update a task (all writable fields).
   * @param {Object} taskData - camelCase task shape with `id`.
   * @returns {Object} The normalized, updated task.
   */
  async updateTask(taskData, userId) {
    let row = mapTaskToRow(taskData);
    row = auditService.stamp(row, userId);

    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', taskData.id)
      .select(TASK_SELECT);

    if (error) throw error;
    return normalizeTask(data[0]);
  },

  /**
   * Update only the stage of a single task.
   * @param {string} taskId
   * @param {string} newStageId
   */
  async updateTaskStage(taskId, newStageId, userId) {
    const row = auditService.stamp({ stageid: newStageId }, userId);

    const { error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', taskId);

    if (error) throw error;
  },

  /**
   * Bulk update a set of tasks with the same field values.
   * Useful for "Clear Board" / "Deprioritize selection" operations.
   * @param {string[]} taskIds
   * @param {Object} updates - Supabase column-name shape (e.g. { stageid: 'DEPRIORITIZED' }).
   * @returns {Array} Normalized updated tasks.
   */
  async bulkUpdateTasks(taskIds, updates, userId) {
    const row = auditService.stamp(updates, userId);

    const { data, error } = await supabase
      .from('tasks')
      .update(row)
      .in('id', taskIds)
      .select(TASK_SELECT);

    if (error) throw error;
    return (data || []).map(normalizeTask);
  },

  /**
   * Permanently delete a single task.
   * @param {string} taskId
   */
  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};
