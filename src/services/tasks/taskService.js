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

const parseTaskBoard = (boardData) => {
  if (Array.isArray(boardData)) return boardData;
  if (typeof boardData === 'string' && boardData.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(boardData);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return boardData ? [boardData] : [];
};

// ---------------------------------------------------------------------------
// FIX Issue-10: Module-level constants — previously duplicated inside addTask
// AND fixAllTasks. A single definition here prevents silent divergence when
// new verticals are added.
// ---------------------------------------------------------------------------
const VALID_VERTICALS = ['CHARGING_HUBS', 'CLIENTS', 'EMPLOYEES', 'PARTNERS', 'VENDORS', 'DATA_MANAGER'];

// Maps a lowercase substring of verticalId to the canonical task_board label.
// Key order matters: 'daily_hub' must precede 'hub' (more-specific first).
const VERTICAL_BOARD_MAP = {
  'daily_hub': 'Hubs Daily',
  'hub':       'Hubs',
  'client':    'Clients',
  'employee':  'Employees',
};

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
    task_board: parseTaskBoard(row.task_board),
    isDailyTask: parseTaskBoard(row.task_board).includes('Hubs Daily'),

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
  // FIX Issue-4 (CONTRACT): tasks.assigned_to is a SCALAR UUID in the DB column — it
  // stores only the primary (first) assignee for legacy compatibility. All multi-assignee
  // relationships live exclusively in task_context_links (entity_type = 'assignee').
  // Do NOT read tasks.assigned_to directly for multi-assignee logic; always use the
  // PostgREST 'assignees' computed join defined in TASK_SELECT.
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
  // FIX Bug8: Destructure and check the delete error. An unchecked failure here causes
  // the subsequent INSERT to create duplicate links (old + new) on every retry.
  const { error: deleteError } = await supabase
    .from('task_context_links')
    .delete()
    .match({ source_id: sourceId, source_type: 'task', entity_type: entityType });

  if (deleteError) {
    console.error(`[SyncContext] Failed to clear old ${entityType} links for ${sourceId}:`, deleteError);
    throw deleteError; // Abort before inserting duplicates
  }

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
      if (resolvedVid.includes('HUB')) resolvedVid = 'CHARGING_HUBS';
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
      const matchedKey = Object.keys(VERTICAL_BOARD_MAP).find(key => resolvedVid.toLowerCase().includes(key));
      taskBoard = matchedKey ? [VERTICAL_BOARD_MAP[matchedKey]] : ['Hubs'];
      if (!matchedKey) {
        console.warn(`[TaskService] Could not infer task_board for verticalId="${resolvedVid}". Defaulting to 'Hubs'.`);
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
  /**
   * Fix Tasks tool for Master Admin.
   * Goes through the columns and fixes all the rows with incorrect values in any column
   * in ALL the tasks including the unrendered tasks present in the tasks table ONLY.
   */
  async fixAllTasks() {
    // 1. Fetch ALL tasks
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*');
    if (tasksError) throw tasksError;

    // 2. Fetch ALL hubs to map cities
    const { data: allHubs, error: hubsError } = await supabase
      .from('hubs')
      .select('id, city');
    if (hubsError) throw hubsError;

    const hubCityMap = (allHubs || []).reduce((acc, hub) => {
      if (hub.id && hub.city) acc[hub.id] = hub.city;
      return acc;
    }, {});

    // 3. Fetch ALL existing hub context links so we know which are missing
    const { data: existingLinks } = await supabase
      .from('task_context_links')
      .select('source_id, entity_id')
      .eq('source_type', 'task')
      .eq('entity_type', 'hub');

    // Build a fast lookup: "taskId::hubId" → true
    const linkedSet = new Set((existingLinks || []).map(l => `${l.source_id}::${l.entity_id}`));

    // -------------------------------------------------------------------------
    // FIX Issue-3: Collect all patches in memory first, then batch-upsert.
    // Previously: one sequential await UPDATE per task (N+1 Supabase calls).
    // On 500+ tasks this could take 60s+ and risk rate-limit failures.
    // Now: bulk upsert in 100-task chunks + one bulk insert for context links.
    // -------------------------------------------------------------------------
    const taskPatches = [];  // { id, ...fields } — for bulk upsert
    const newLinkRows = [];  // { source_id, source_type, entity_type, entity_id }

    for (const task of (allTasks || [])) {
      const patch = { id: task.id };
      let hasPatch = false;

      // Parse stringified task_board if needed
      let taskBoard = task.task_board;
      if (typeof taskBoard === 'string' && taskBoard.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(taskBoard);
          if (Array.isArray(parsed)) {
            taskBoard = parsed;
            patch.task_board = taskBoard;
            hasPatch = true;
          }
        } catch (e) {}
      }

      const boards = Array.isArray(taskBoard) ? taskBoard : [];

      // A. Fix vertical_id — uses module-level VALID_VERTICALS (FIX Issue-10)
      const currentVid = (task.vertical_id || '').toUpperCase();
      let correctVid = task.vertical_id;

      if (!VALID_VERTICALS.includes(currentVid)) {
        hasPatch = true;
        if (boards.includes('Hubs') || boards.includes('Hubs Daily') || task.hub_id) {
          correctVid = 'CHARGING_HUBS';
        } else if (boards.includes('Clients')) {
          correctVid = 'CLIENTS';
        } else if (boards.includes('Employees')) {
          correctVid = 'EMPLOYEES';
        } else {
          correctVid = 'CHARGING_HUBS';
        }
        patch.vertical_id = correctVid;
      }

      // B. Fix task_board (empty or null)
      if (boards.length === 0) {
        hasPatch = true;
        const vidCheck = (correctVid || task.vertical_id || '').toLowerCase();
        // Without a reliable daily signal in the raw row, default ambiguous hub tasks to 'Hubs'.
        if (vidCheck.includes('hub')) patch.task_board = ['Hubs'];
        else if (vidCheck.includes('client')) patch.task_board = ['Clients'];
        else if (vidCheck.includes('employee')) patch.task_board = ['Employees'];
        else patch.task_board = ['Hubs'];
      }

      // C. Fix city
      if (!task.city && task.hub_id) {
        const mappedCity = hubCityMap[task.hub_id];
        if (mappedCity) {
          hasPatch = true;
          patch.city = mappedCity;
        }
      }

      // D. Fix stage_id (null or empty string)
      if (!task.stage_id) {
        hasPatch = true;
        patch.stage_id = 'TODO';
      }

      // E. Fix priority (null or empty string)
      if (!task.priority) {
        hasPatch = true;
        patch.priority = 'Medium';
      }

      if (hasPatch) taskPatches.push(patch);

      // F. Collect missing hub context links
      if (task.hub_id && !linkedSet.has(`${task.id}::${task.hub_id}`)) {
        newLinkRows.push({
          source_id:   task.id,
          source_type: 'task',
          entity_type: 'hub',
          entity_id:   task.hub_id,
        });
        // Pre-mark to prevent duplicate rows if the same task appears twice
        linkedSet.add(`${task.id}::${task.hub_id}`);
      }
    }

    let updateCount = 0;
    const CHUNK_SIZE = 100;

    // Bulk upsert task field patches in chunks of 100
    for (let i = 0; i < taskPatches.length; i += CHUNK_SIZE) {
      const chunk = taskPatches.slice(i, i + CHUNK_SIZE);
      const { error: upsertError } = await supabase
        .from('tasks')
        .upsert(chunk, { onConflict: 'id' });

      if (upsertError) {
        console.error(`[TaskService] fixAllTasks upsert chunk ${Math.floor(i / CHUNK_SIZE)} failed:`, upsertError);
      } else {
        updateCount += chunk.length;
      }
    }

    // Bulk insert missing hub context links
    if (newLinkRows.length > 0) {
      for (let i = 0; i < newLinkRows.length; i += CHUNK_SIZE) {
        const chunk = newLinkRows.slice(i, i + CHUNK_SIZE);
        const { error: linkError } = await supabase
          .from('task_context_links')
          .insert(chunk);

        if (linkError) {
          console.error(`[TaskService] fixAllTasks link insert chunk ${Math.floor(i / CHUNK_SIZE)} failed:`, linkError);
        } else {
          updateCount += chunk.length;
        }
      }
    }

    return updateCount;
  },
};
