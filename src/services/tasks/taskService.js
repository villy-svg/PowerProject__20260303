/**
 * Task Service
 * Stateless service for all Supabase CRUD operations on the `tasks` table.
 * Canonical location: src/services/tasks/taskService.js
 *
 * Consuming hook: src/hooks/useTasks.js
 */
import { supabase } from '../core/supabaseClient';
import { auditService } from '../core/auditService';
import { TASK_BOARD_MAP } from '../../constants/taskBoards';
import { normalizeTask, mapTaskToRow, TASK_SELECT } from './taskNormalizer';
import { fixAllTasks } from './taskFixService';

// ---------------------------------------------------------------------------
// Constants & Internal Utilities
// ---------------------------------------------------------------------------

// Bump this whenever the normalized task shape changes (Context Link migration = v4)
const TASK_CACHE_VERSION = 5;
const TASK_CACHE_KEY = 'powerpod_tasks_v5';
const TASK_CACHE_VERSION_KEY = 'powerpod_tasks_version';


// ---------------------------------------------------------------------------
// FIX Issue-10: Module-level constants — previously duplicated inside addTask
// AND fixAllTasks. A single definition here prevents silent divergence when
// new verticals are added.
// ---------------------------------------------------------------------------
const VALID_VERTICALS = ['CHARGING_HUBS', 'CLIENTS', 'EMPLOYEES', 'PARTNERS', 'VENDORS', 'DATA_MANAGER'];

// Maps a lowercase substring of verticalId to the canonical task_board label.
// Removed local definition: now imported from src/constants/taskBoards.js

/**
 * Maps a Supabase row (lowercase column names) to the camelCase shape
 * the rest of the app expects. Handles optional joined employee data.
 */

/**
 * Maps a camelCase task object to the Supabase column-name shape for inserts/updates.
 */


/**
 * Synchronizes many-to-many links in task_context_links.
 */
export const syncContextLinks = async (sourceId, sourceType, entityType, entityIds) => {
  // 1. Sanitize and flatten: Ensure we have a flat array of valid string UUIDs
  const rawIds = Array.isArray(entityIds) ? entityIds.flat() : [entityIds];
  const validIds = [...new Set(rawIds.filter(id => 
    typeof id === 'string' && 
    id.length === 36 && 
    id !== 'null' && 
    id !== 'undefined'
  ))].sort();

  try {
    // 2. Optimization: Fetch existing links to detect changes
    // This prevents redundant DELETE/INSERT cycles which trigger 409 conflicts for 
    // users with restricted DELETE permissions (e.g. contributors promoting tasks).
    const { data: existing, error: fetchError } = await supabase
      .from('task_context_links')
      .select('entity_id')
      .match({ source_id: sourceId, source_type: sourceType, entity_type: entityType });

    if (!fetchError) {
      const existingIds = (existing || []).map(l => l.entity_id).sort();
      if (JSON.stringify(existingIds) === JSON.stringify(validIds)) {
        return; // No changes needed
      }
    }

    // 3. Apply changes (Delete then Insert)
    await supabase.from('task_context_links').delete().match({ source_id: sourceId, source_type: sourceType, entity_type: entityType });

    if (validIds.length > 0) {
      const links = validIds.map(eId => ({
        source_id: sourceId,
        source_type: sourceType,
        entity_type: entityType,
        entity_id: eId
      }));

      const { error } = await supabase.from('task_context_links').insert(links);
      if (error) throw error;
    }
  } catch (err) {
    console.error(`[taskService] Error syncing ${entityType} links for ${sourceId}:`, err);
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

    // --- Fix legacy verticalId strings before mapping to database row ---
    // Uses module-level VALID_VERTICALS (FIX Issue-10)
    let resolvedVid = (taskData.verticalId || taskData.vertical_id || '').toUpperCase();
    if (!VALID_VERTICALS.includes(resolvedVid)) {
      if (resolvedVid.includes('HUB') || resolvedVid.includes('ESCALATION')) resolvedVid = 'CHARGING_HUBS';
      else if (resolvedVid.includes('CLIENT')) resolvedVid = 'CLIENTS';
      else if (resolvedVid.includes('EMPLOYEE')) resolvedVid = 'EMPLOYEES';
      else resolvedVid = 'CHARGING_HUBS'; // Default fallback
    }
    taskData.verticalId = resolvedVid;

    // --- Autopopulate task_board if missing ---
    // Uses module-level VERTICAL_BOARD_MAP (FIX Issue-10)
    let taskBoard = taskData.task_board;

    if (typeof taskBoard === 'string' && taskBoard.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(taskBoard);
        if (Array.isArray(parsed)) taskBoard = parsed;
      } catch (e) { }
    }

    if (!Array.isArray(taskBoard) || taskBoard.length === 0) {
      // FIX: Use the ORIGINAL verticalId from taskData for inference,
      // NOT the resolved/normalized one which may have stripped context.
      const rawVid = (taskData.verticalId || taskData.vertical_id || '').toLowerCase();
      const matchedKey = Object.keys(TASK_BOARD_MAP).find(key => rawVid.includes(key));
      taskBoard = matchedKey ? [TASK_BOARD_MAP[matchedKey]] : ['Hubs'];
      
      if (!matchedKey) {
        console.warn(`[TaskService] Could not infer task_board for raw verticalId="${rawVid}". Defaulting to 'Hubs'.`);
      }
    }

    const enrichedTaskData = {
      ...taskData,
      task_board: taskBoard
    };

    console.info(`[TaskService] START addTask (RPC): "${enrichedTaskData.text}"`, { 
      hubs: hubIds.length, 
      assignees: assigneeIds.length,
      parentHub: enrichedTaskData.hub_id 
    });

    // 2. Map Parent Row
    let row = {
      ...mapTaskToRow(enrichedTaskData),
    };

    if (enrichedTaskData.id) {
      row.id = enrichedTaskData.id;
    }

    row = auditService.stamp(row, userId, { isNew: true });

    // 3. Build Context Links
    const contextLinks = {};
    if (hubIds.length > 0) contextLinks.hub = hubIds;
    if (assigneeIds.length > 0) contextLinks.assignee = assigneeIds;
    if (enrichedTaskData.client_id) {
      contextLinks.client = Array.isArray(enrichedTaskData.client_id) ? enrichedTaskData.client_id : [enrichedTaskData.client_id];
    }
    if (enrichedTaskData.employee_id) {
      contextLinks.employee = Array.isArray(enrichedTaskData.employee_id) ? enrichedTaskData.employee_id : [enrichedTaskData.employee_id];
    }

    // 4. Build Fan-Out Targets
    const orchestrationMapping = enrichedTaskData.orchestration_mapping || [];
    const isOrchestrated = orchestrationMapping.length > 0;
    
    let fanOutTargets = null;
    if (isMultiHub || isMultiAssignee || isOrchestrated) {
      const rawTargets = isOrchestrated
        ? orchestrationMapping
        : (isMultiHub ? hubIds : assigneeIds).map(id => ({
            hub_id: isMultiHub ? id : (enrichedTaskData.hub_id || null),
            assigned_to: isMultiAssignee ? [id] : (isMultiHub && assigneeIds.length > 1 ? [assigneeIds[0]] : assigneeIds)
          }));

      // BUG-FIX: Normalize all targets to the RPC's expected shape.
      // orchestration_mapping from the caller may use different key names or scalar
      // assigned_to values. The RPC reads hub_id as a UUID string and assigned_to
      // as a JSON array. Enforce that here so the DB never receives malformed data.
      fanOutTargets = rawTargets.map(target => ({
        hub_id: target.hub_id || null,
        city: target.city || null,
        assigned_to: Array.isArray(target.assigned_to)
          ? target.assigned_to
          : (target.assigned_to ? [target.assigned_to] : [])
      }));
    }

    // 5. Construct Payload & Call RPC
    const payload = {
      audit_user_id: userId,
      operations: [
        {
          task_data: row,
          context_links: contextLinks,
          fan_out_targets: fanOutTargets
        }
      ]
    };

    const { data: createdIds, error: rpcError } = await supabase.rpc('rpc_orchestrate_tasks', { payload });

    if (rpcError) {
      console.error('[TaskService] RPC Orchestrate Tasks Error:', rpcError);
      throw rpcError;
    }

    // 6. Refetch Fully Hydrated Tasks
    if (!createdIds || createdIds.length === 0) return [];

    const { data: fetchedTasks, error: fetchError } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .in('id', createdIds);

    if (fetchError) {
      console.error('[TaskService] Error fetching tasks after RPC:', fetchError);
      throw fetchError;
    }

    // Ensure order is Parent first, then Children (or match createdIds order)
    const taskMap = Object.fromEntries(fetchedTasks.map(t => [t.id, normalizeTask(t)]));
    return createdIds.map(id => taskMap[id]).filter(Boolean);
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

    const { orchestration_mapping: orchMapping, ...rest } = taskData;

    // SCENARIO A: Orchestration / Fan-Out Update
    if (orchMapping && orchMapping.length > 0) {
      console.info(`[TaskService] START updateTask (Orchestration): "${taskData.id}" - "${taskData.text}"`, { 
        targets: orchMapping.length 
      });

      const row = auditService.stamp(mapTaskToRow(rest), userId);
      row.id = taskData.id; // CRITICAL FIX: Ensure ID is preserved so RPC performs DO UPDATE instead of INSERT

      const hubIds = taskData.hub_ids || [];
      const assigneeIds = taskData.assigned_to || [];

      const contextLinks = {};
      if (hubIds.length > 0) contextLinks.hub = hubIds;
      if (assigneeIds.length > 0) contextLinks.assignee = assigneeIds;

      // Normalize targets to the shape expected by rpc_orchestrate_tasks
      const fanOutTargets = orchMapping.map(target => ({
        hub_id: target.hub_id || null,
        city: target.city || null,
        assigned_to: Array.isArray(target.assigned_to)
          ? target.assigned_to
          : (target.assigned_to ? [target.assigned_to] : [])
      }));

      const payload = {
        audit_user_id: userId,
        operations: [
          {
            task_data: row,
            context_links: contextLinks,
            fan_out_targets: fanOutTargets
          }
        ]
      };

      const { data: updatedIds, error: rpcError } = await supabase.rpc('rpc_orchestrate_tasks', { payload });
      if (rpcError) {
        console.error('[TaskService] Orchestration Update Error:', rpcError);
        throw rpcError;
      }

      if (!updatedIds || updatedIds.length === 0) return [];

      // Fetch ALL updated tasks (Parent + Children) to ensure UI reflects new subtasks
      const { data: fetchedTasks, error: fetchError } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .in('id', updatedIds);

      if (fetchError) {
        console.error('[TaskService] Error fetching tasks after orchestration update:', fetchError);
        throw fetchError;
      }

      return fetchedTasks.map(normalizeTask);
    }

    // SCENARIO B: Simple CRUD Update
    let row = mapTaskToRow(taskData);
    row = auditService.stamp(row, userId);

    const { error } = await supabase
      .from('tasks')
      .update(row)
      .eq('id', taskData.id);

    if (error) throw error;

    // --- Sync Context Links (Simple Mode) ---
    // Note: syncContextLinks now handles array vs single-value flattening internally.
    const syncOps = [];
    const getField = (snake, camel) => taskData[snake] !== undefined ? taskData[snake] : taskData[camel];

    // Clients, Partners, Vendors, Employees
    const clientId = getField('client_id', 'clientId');
    const partnerId = getField('partner_id', 'partnerId');
    const vendorId = getField('vendor_id', 'vendorId');
    const employeeId = getField('employee_id', 'employeeId');
    const hubIds = getField('hub_ids', 'hubIds') || getField('hub_id', 'hubId');
    const assignedTo = getField('assigned_to', 'assignedTo');

    if (clientId !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'client', clientId));
    if (partnerId !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'partner', partnerId));
    if (vendorId !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'vendor', vendorId));
    if (employeeId !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'employee', employeeId));
    if (hubIds !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'hub', hubIds));
    if (assignedTo !== undefined) syncOps.push(syncContextLinks(taskData.id, 'task', 'assignee', assignedTo));

    await Promise.all(syncOps);

    // Refetch the updated record
    const { data: fetched, error: fetchError } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .eq('id', taskData.id)
      .single();

    if (fetchError) throw fetchError;
    return normalizeTask(fetched);
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
  /**
   * Fix Tasks tool for Master Admin.
   * Goes through the columns and fixes all the rows with incorrect values in any column
   * in ALL the tasks including the unrendered tasks present in the tasks table ONLY.
   */
  /** Fix all tasks — delegated to taskFixService for separation of concerns */
  fixAllTasks,
};
