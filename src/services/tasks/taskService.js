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
// Constants & Internal Utilities
// ---------------------------------------------------------------------------

// Bump this whenever the normalized task shape changes (uuid[] migration = v2)
const TASK_CACHE_VERSION = 3;
const TASK_CACHE_KEY = 'powerpod_tasks_v3';
const TASK_CACHE_VERSION_KEY = 'powerpod_tasks_version';

/**
 * Maps a Supabase row (lowercase column names) to the camelCase shape
 * the rest of the app expects. Handles optional joined employee data.
 */
const normalizeTask = (row) => {
  const latestSubmission = row.submissions?.length > 0
    ? [...row.submissions].sort((a, b) => b.submission_number - a.submission_number)[0]
    : null;

  // Handle multi-assignee names (PostgREST returns an array via the 'assignees' computed relationship)
  const assigneeNames = Array.isArray(row.assignees)
    ? row.assignees.map(e => e.full_name).join(', ')
    : (row.assignees?.full_name || '');

  // Flatten nested employee_roles for each assignee in assigneeMeta
  const rawMeta = Array.isArray(row.assignees) ? row.assignees : (row.assignees ? [row.assignees] : []);
  const assigneeMeta = rawMeta.map(e => ({
    ...e,
    seniority_level: e.employee_roles?.seniority_level || 1
  }));

  return {
    id: row.id,
    text: row.text,
    verticalId: row.vertical_id,
    stageId: row.stage_id,
    priority: row.priority,
    description: row.description,
    hub_id: row.hub_id,
    city: row.city,
    function: row.function,
    assigned_to: row.assigned_to || [], // Now an array
    assigneeName: assigneeNames,
    parentTask: row.parent_task_id || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
    task_board: row.task_board || [],
    client_id: row.client_id || [],
    partner_id: row.partner_id || [],
    vendor_id: row.vendor_id || [],
    employee_id: row.employee_id || [],
    latestSubmission,
    assigneeMeta,
  };
};

/**
 * Maps a camelCase task object to the Supabase column-name shape for inserts/updates.
 */
const mapTaskToRow = (task) => ({
  text: task.text,
  vertical_id: task.verticalId,
  stage_id: task.stageId,
  priority: task.priority || null,
  description: task.description || null,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function: task.function || null,
  assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to : (task.assigned_to ? [task.assigned_to] : []),
  parent_task_id: task.parentTask || null,
  last_updated_by: task.lastUpdatedBy || null,
  task_board: task.task_board || [],
  client_id: task.client_id || [],
  partner_id: task.partner_id || [],
  vendor_id: task.vendor_id || [],
  employee_id: task.employee_id || [],
});

/** Standard select string: uses computed relationship 'assignees' backed by task_context_links. */
const TASK_SELECT = '*, assignees(id, full_name, badge_id, employee_roles(seniority_level)), submissions(id, status, rejection_reason, submission_number, created_at)';
const DAILY_TASK_SELECT = '*, assignees(id, full_name, badge_id, employee_roles(seniority_level))';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const taskService = {
  /**
   * Fetch all tasks, joined with employee names for assignees.
   * @returns {Array} Normalized task array.
   */
  async getTasks() {
    try {
      // -------------------------------------------------------------------------
      // OFFLINE BYPASS: Immediate cache retrieval
      // -------------------------------------------------------------------------
      if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
        const cachedVersion = parseInt(localStorage.getItem(TASK_CACHE_VERSION_KEY) || '0', 10);
        const cached = (cachedVersion === TASK_CACHE_VERSION)
          ? localStorage.getItem(TASK_CACHE_KEY)
          : null;

        if (cachedVersion !== TASK_CACHE_VERSION) {
          localStorage.removeItem(TASK_CACHE_KEY);
          localStorage.removeItem(TASK_CACHE_VERSION_KEY);
        }

        if (cached) {
          console.warn('PowerProject: Using cached task data.');
          return JSON.parse(cached);
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT);

      if (error) throw error;

      const results = (data || []).map(normalizeTask);
      const sorted = results.sort((a, b) => (a.updatedAt || a.createdAt) > (b.updatedAt || b.createdAt) ? 1 : -1);

      // -------------------------------------------------------------------------
      // CACHE PERSISTENCE: Save for offline use
      // -------------------------------------------------------------------------
      localStorage.setItem(TASK_CACHE_KEY, JSON.stringify(sorted));
      localStorage.setItem(TASK_CACHE_VERSION_KEY, String(TASK_CACHE_VERSION));

      return sorted;
    } catch (err) {
      console.error('TaskService Error:', err);
      // Fallback to cache on any error if we have it and it's valid
      const cachedVersion = parseInt(localStorage.getItem(TASK_CACHE_VERSION_KEY) || '0', 10);
      const cached = (cachedVersion === TASK_CACHE_VERSION)
        ? localStorage.getItem(TASK_CACHE_KEY)
        : null;
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  /**
   * Add a new task. Expects a fully formed task object (use createInitialTask first).
   * @param {Object} taskData - camelCase task shape.
   * @returns {Object} The normalized, newly created task.
   */
  async addTask(taskData, userId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (addTask) — data will persist in cache but not database.');
      // Simple local echo for developer testing
      const newTask = { ...taskData, id: taskData.id || `local-${Date.now()}`, createdAt: new Date().toISOString() };
      return newTask;
    }

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
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (updateTask).');
      return taskData;
    }

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
    const row = auditService.stamp({ stage_id: newStageId }, userId);

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
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (deleteTask).');
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};
