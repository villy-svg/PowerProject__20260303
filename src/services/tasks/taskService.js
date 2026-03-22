/**
 * Task Service
 * Stateless service for all Supabase CRUD operations on the `tasks` table.
 * Canonical location: src/services/tasks/taskService.js
 *
 * Consuming hook: src/hooks/useTasks.js
 */
import { supabase } from '../core/supabaseClient';

// ---------------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------------

/**
 * Maps a Supabase row (lowercase column names) to the camelCase shape
 * the rest of the app expects. Handles optional joined employee data.
 */
const normalizeTask = (row) => ({
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
  createdAt: row.createdat ?? row.createdAt,
  updatedAt: row.updatedat ?? row.updatedAt,
});

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
});

/** Standard select string: includes employee name join. */
const TASK_SELECT = '*, employees:assigned_to (full_name)';

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
      .select(TASK_SELECT)
      .order('updatedat', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeTask);
  },

  /**
   * Add a new task. Expects a fully formed task object (use createInitialTask first).
   * @param {Object} taskData - camelCase task shape.
   * @returns {Object} The normalized, newly created task.
   */
  async addTask(taskData) {
    const row = {
      id: taskData.id,
      ...mapTaskToRow(taskData),
      createdat: taskData.createdAt,
      updatedat: taskData.updatedAt,
    };

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
  async updateTask(taskData) {
    const row = {
      ...mapTaskToRow(taskData),
      updatedat: new Date().toISOString(),
    };

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
  async updateTaskStage(taskId, newStageId) {
    const { error } = await supabase
      .from('tasks')
      .update({ stageid: newStageId, updatedat: new Date().toISOString() })
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
  async bulkUpdateTasks(taskIds, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updates, updatedat: new Date().toISOString() })
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
