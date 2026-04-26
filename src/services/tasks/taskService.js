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

// Bump this whenever the normalized task shape changes (Context Link migration = v4)
const TASK_CACHE_VERSION = 5;
const TASK_CACHE_KEY = 'powerpod_tasks_v5';
const TASK_CACHE_VERSION_KEY = 'powerpod_tasks_version';

/**
 * Maps a Supabase row (lowercase column names) to the camelCase shape
 * the rest of the app expects. Handles optional joined employee data.
 */
export const normalizeTask = (row) => {
  // Safeguard: Ensure submissions is an array before processing
  const submissions = Array.isArray(row.submissions) ? row.submissions : [];
  const latestSubmission = submissions.length > 0
    ? [...submissions].sort((a, b) => (b.submission_number || 0) - (a.submission_number || 0))[0]
    : null;

  // 1. Resolve Multi-Hub Data
  const rawHubs = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);
  const hubData = rawHubs.filter(Boolean);

  // 2. Resolve Assignee Names (PostgREST returns an array via the 'assignees' computed relationship)
  const rawAssignees = Array.isArray(row.assignees) ? row.assignees : (row.assignees ? [row.assignees] : []);
  const validAssignees = rawAssignees.filter(Boolean);
  
  const assigneeNames = validAssignees.map(e => e.full_name).filter(Boolean).join(', ');

  // 3. Flatten nested employee_roles for each assignee in assigneeMeta
  const assigneeMeta = validAssignees.map(e => ({
    ...e,
    seniority_level: e?.employee_roles?.seniority_level || 1
  }));

  return {
    id: row.id,
    text: row.text,
    verticalId: row.vertical_id,
    stageId: row.stage_id,
    priority: row.priority,
    description: row.description,

    // Hub Relationships
    hub_id: row.hub_id,                          // Legacy scalar primary hub
    hub_ids: hubData.map(h => h.id).filter(Boolean),             // Multi-hub UUID array
    hubNames: hubData.map(h => h.name).filter(Boolean),          // For display
    hubCodes: hubData.map(h => h.hub_code).filter(Boolean),      // For badges
    hubData: hubData,                            // Full objects for forms
    city: row.city,

    function: row.function,

    // Assignee Relationships
    assigned_to: validAssignees.length > 0 ? validAssignees.map(a => a.id).filter(Boolean) : (Array.isArray(row.assigned_to) ? row.assigned_to : (row.assigned_to ? [row.assigned_to] : [])),
    assigneeName: assigneeNames,
    assigneeMeta,

    // Hierarchy
    parentTask: row.parent_task_id || null,
    childCount: row.children?.length || 0,        // Count of child tasks
    isSubTask: !!row.parent_task_id,              // Is this a fan-out child?

    // Meta & Audit
    task_board: Array.isArray(row.task_board) ? row.task_board : (row.task_board ? [row.task_board] : []),
    isDailyTask: (Array.isArray(row.task_board) ? row.task_board : (row.task_board ? [row.task_board] : [])).includes('Hubs Daily'),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,

    // Entity Links (Hybrid: Joins for existing tables, Metadata for future placeholders)
    client_id: Array.isArray(row.clients) ? row.clients.map(c => c?.id).filter(Boolean) : (row.metadata?.entity_links?.client_id || []),
    employee_id: Array.isArray(row.employees) ? row.employees.map(e => e?.id).filter(Boolean) : (row.metadata?.entity_links?.employee_id || []),
    partner_id: row.metadata?.entity_links?.partner_id || [],
    vendor_id: row.metadata?.entity_links?.vendor_id || [],

    latestSubmission,
    submissionBy: latestSubmission?.submitted_by || row.metadata?.submission_by,
  };
};

/**
 * Maps a camelCase task object to the Supabase column-name shape for inserts/updates.
 */
export const mapTaskToRow = (task) => ({
  text: task.text,
  vertical_id: task.verticalId,
  stage_id: task.stageId,
  priority: task.priority || null,
  description: task.description || null,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function: task.function || null,
  assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to[0] : (task.assigned_to || null),
  parent_task_id: task.parentTask || null,
  last_updated_by: task.lastUpdatedBy || null,
  task_board: task.task_board || [],
  metadata: {
    ...(task.metadata || {}),
    entity_links: {
      client_id: Array.isArray(task.client_id) ? task.client_id : (task.client_id ? [task.client_id] : []),
      partner_id: Array.isArray(task.partner_id) ? task.partner_id : (task.partner_id ? [task.partner_id] : []),
      vendor_id: Array.isArray(task.vendor_id) ? task.vendor_id : (task.vendor_id ? [task.vendor_id] : []),
      employee_id: Array.isArray(task.employee_id) ? task.employee_id : (task.employee_id ? [task.employee_id] : []),
    },
    submission_by: task.submissionBy || null,
  },
});

export const TASK_SELECT = `
  *,
  assignees(id, full_name, badge_id, employee_roles(seniority_level)),
  hubs(id, name, hub_code, city),
  clients(id, name),
  employees(id, full_name),
  submissions(id, status, rejection_reason, submission_number, created_at, submitted_by),
  children:tasks!parent_task_id(id)
`;

/**
 * Synchronizes many-to-many links in task_context_links.
 */
const syncContextLinks = async (sourceId, entityType, entityIds) => {
  if (!sourceId || !entityType) return;
  console.log(`[SyncContext] Syncing ${entityType} for ${sourceId}:`, entityIds);
  
  // Ensure entityIds is a clean array of UUIDs
  const ids = Array.isArray(entityIds) ? entityIds : (entityIds ? [entityIds] : []);
  
  // 1. Delete old links for this type to ensure clean sync
  await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: sourceId, source_type: 'task', entity_type: entityType });

  // 2. Batch insert new links
  if (ids.length > 0) {
    const linkRows = ids.filter(id => !!id).map(id => ({
      source_id: sourceId,
      source_type: 'task',
      entity_type: entityType,
      entity_id: id
    }));

    if (linkRows.length === 0) return;

    const { error } = await supabase
      .from('task_context_links')
      .insert(linkRows);

    if (error) {
      console.error(`Error syncing ${entityType} links:`, error);
      throw error;
    }
  }
};

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
      const newTask = { ...taskData, id: taskData.id || `local-${Date.now()}`, createdAt: new Date().toISOString() };
      return [newTask];
    }

    // 1. Determine Fan-Out Mode
    const hubIds = Array.isArray(taskData.hub_ids) ? taskData.hub_ids : [];
    const assignedToInput = taskData.assigned_to;
    const assigneeIds = Array.isArray(assignedToInput) ? assignedToInput : (assignedToInput ? [assignedToInput] : []);
    const isMultiHub = hubIds.length > 1;
    const isMultiAssignee = !isMultiHub && assigneeIds.length > 1;

    // 2. Create Primary/Parent Row
    console.log(`[TaskService] Adding task: "${taskData.text}"`, { isMultiHub, isMultiAssignee });
    let row = {
      ...mapTaskToRow(taskData),
    };

    if (taskData.id) {
      row.id = taskData.id;
    }

    row = auditService.stamp(row, userId, { isNew: true });

    // For multi-hub, the parent should be unassigned or assigned to a specific person?
    // Usually parent is an "Umbrella".
    const { data: parentData, error: parentError } = await supabase
      .from('tasks')
      .insert([row])
      .select(TASK_SELECT);

    if (parentError) throw parentError;
    const parentTask = normalizeTask(parentData[0]);

    // Sync context links for parent
    if (hubIds.length > 0) await syncContextLinks(parentTask.id, 'hub', hubIds);
    if (assigneeIds.length > 0) await syncContextLinks(parentTask.id, 'assignee', assigneeIds);
    
    // Sync other links
    if (taskData.client_id) await syncContextLinks(parentTask.id, 'client', taskData.client_id);
    if (taskData.employee_id) await syncContextLinks(parentTask.id, 'employee', taskData.employee_id);

    const createdTasks = [parentTask];

    // 3. Spawn Children if Fan-Out is active
    if (isMultiHub || isMultiAssignee) {
      const childRows = [];
      const loopArray = isMultiHub ? hubIds : assigneeIds;

      for (const entityId of loopArray) {
        let childRow = {
          ...mapTaskToRow(taskData),
          parent_task_id: parentTask.id,
          // Special case: if multi-hub, each child gets 1 hub. If multi-assignee, each child gets 1 assignee.
          hub_id: isMultiHub ? entityId : (taskData.hub_id || null),
          assigned_to: isMultiAssignee ? entityId : (Array.isArray(taskData.assigned_to) ? taskData.assigned_to[0] : null)
        };
        childRow = auditService.stamp(childRow, userId, { isNew: true });
        childRows.push(childRow);
      }

      const { data: childrenData, error: childrenError } = await supabase
        .from('tasks')
        .insert(childRows)
        .select(TASK_SELECT);

      if (childrenError) {
        console.error('Failed to spawn child tasks:', childrenError);
      } else if (childrenData) {
        for (const childRow of childrenData) {
          const childTask = normalizeTask(childRow);
          // Sync context link for the specific entity (hub or assignee) to the child
          const childEntityId = isMultiHub ? childTask.hub_id : (childTask.assigned_to ? childTask.assigned_to[0] : null);
          if (childEntityId) {
            await syncContextLinks(childTask.id, isMultiHub ? 'hub' : 'assignee', [childEntityId]);
          }
          createdTasks.push(childTask);
        }
      }
    }

    return createdTasks;
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

    const { error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', taskData.id);

    if (error) throw error;

    // --- NEW: Sync Context Links ---
    if (taskData.hub_ids) {
      await syncContextLinks(taskData.id, 'hub', taskData.hub_ids);
    }
    if (taskData.assigned_to) {
      await syncContextLinks(taskData.id, 'assignee', taskData.assigned_to);
    }
    if (taskData.client_id) {
      await syncContextLinks(taskData.id, 'client', Array.isArray(taskData.client_id) ? taskData.client_id : [taskData.client_id]);
    }
    if (taskData.employee_id) {
      await syncContextLinks(taskData.id, 'employee', Array.isArray(taskData.employee_id) ? taskData.employee_id : [taskData.employee_id]);
    }

    // Fetch fresh data with links
    const { data: refreshed, error: fetchError } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', taskData.id)
      .single();

    if (fetchError) throw fetchError;
    return normalizeTask(refreshed);
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
    const row = { ...updates };
    
    // Remap stageId if present
    if (row.stageId) {
      row.stage_id = row.stageId;
      delete row.stageId;
    }

    // Move future entities and audit fields to metadata if they are present in bulk updates
    if (row.submissionBy || row.client_id || row.partner_id || row.vendor_id || row.employee_id) {
      row.metadata = {
        ...(row.metadata || {}),
        entity_links: {
          ...(row.metadata?.entity_links || {}),
          client_id: row.client_id || row.metadata?.entity_links?.client_id || [],
          partner_id: row.partner_id || row.metadata?.entity_links?.partner_id || [],
          vendor_id: row.vendor_id || row.metadata?.entity_links?.vendor_id || [],
          employee_id: row.employee_id || row.metadata?.entity_links?.employee_id || [],
        },
        submission_by: row.submissionBy || row.metadata?.submission_by || null
      };
      
      // Clean up top-level keys that don't belong in the table schema
      delete row.submissionBy;
      delete row.client_id;
      delete row.partner_id;
      delete row.vendor_id;
      delete row.employee_id;
    }

    const stamped = auditService.stamp(row, userId);

    const { data, error } = await supabase
      .from('tasks')
      .update(stamped)
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

  /**
   * Retrieves all child tasks for a given parent.
   */
  async getChildTasks(parentTaskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('parent_task_id', parentTaskId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(normalizeTask);
  },
};
