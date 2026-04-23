/**
 * Daily Task Service
 * Specialized service for the `daily_tasks` table with audit tracking.
 */
import { supabase } from '../core/supabaseClient';
import { auditService } from '../core/auditService';
import { VERTICALS } from '../../constants/verticals';

// Bump this whenever the normalized task shape changes (uuid[] migration = v2)
const DAILY_TASK_CACHE_VERSION = 3;
const DAILY_TASK_CACHE_KEY = 'powerpod_daily_tasks_v3';
const DAILY_TASK_CACHE_VERSION_KEY = 'powerpod_daily_tasks_version';

const normalizeDailyTask = (row) => {
  // Handle multi-assignee names
  const assigneeNames = Array.isArray(row.employees) 
    ? row.employees.map(e => e.full_name).join(', ') 
    : (row.employees?.full_name || '');

  // Flatten nested employee_roles for each employee in assigneeMeta
  const rawMeta = Array.isArray(row.employees) ? row.employees : (row.employees ? [row.employees] : []);
  const assigneeMeta = rawMeta.map(e => ({
    ...e,
    seniority_level: e.employee_roles?.seniority_level || 1
  }));

  return {
    id: row.id,
    text: row.text,
    description: row.description,
    priority: row.priority,
    stageId: row.stage_id,
    // Unified subject ID for UI - takes the first ID from any present array
    hub_id: row.hub_id || (row.client_id?.[0]) || (row.employee_id?.[0]) || (row.partner_id?.[0]) || (row.vendor_id?.[0]), 
    city: row.city,
    function: row.function_name, 
    verticalId: row.vertical_id,
    assigned_to: row.assigned_to || [],
    scheduled_date: row.scheduled_date,
    is_recurring: row.is_recurring,
    assigneeName: assigneeNames,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
    submissionBy: row.submission_by,
    task_board: row.task_board || [],
    client_id: row.client_id || [],
    partner_id: row.partner_id || [],
    vendor_id: row.vendor_id || [],
    employee_id: row.employee_id || [],
    assigneeMeta,
  };
};

const mapDailyTaskToRow = (task) => {
  const vid = (task.verticalId || '').toUpperCase();
  // If task.hub_id is a single value, wrap it in an array for the DB
  const subjectIds = Array.isArray(task.hub_id) ? task.hub_id : (task.hub_id ? [task.hub_id] : []);

  const row = {
    text: task.text || 'Untitled Task',
    description: task.description || null,
    priority: task.priority || 'Medium',
    stage_id: task.stageId,
    city: task.city || null,
    function_name: task.function || null,
    vertical_id: task.verticalId || VERTICALS.CHARGING_HUBS.id, 
    assigned_to: Array.isArray(task.assigned_to) ? task.assigned_to : (task.assigned_to ? [task.assigned_to] : []),
    scheduled_date: task.scheduled_date || new Date().toISOString().split('T')[0],
    is_recurring: !!task.is_recurring,
    last_updated_by: task.lastUpdatedBy || null,
    submission_by: task.submissionBy || null,
    task_board: task.task_board || [],
    client_id: task.client_id || [],
    partner_id: task.partner_id || [],
    vendor_id: task.vendor_id || [],
    employee_id: task.employee_id || [],
  };

  // Intelligent Subject Mapping (backward compatibility for single-subject UI)
  if (subjectIds.length > 0) {
    if (vid.includes('CLIENT')) row.client_id = subjectIds;
    else if (vid.includes('EMPLOYEE')) row.employee_id = subjectIds;
    else if (vid.includes('PARTNER')) row.partner_id = subjectIds;
    else if (vid.includes('VENDOR')) row.vendor_id = subjectIds;
    else row.hub_id = subjectIds[0]; // hub_id stays as a single UUID (location, not a tag)
  }

  return row;
};

const DAILY_TASK_SELECT = '*, employees:assigned_to (id, full_name, badge_id, employee_roles(seniority_level))';

export const dailyTaskService = {
  async getTasks() {
    try {
      // -------------------------------------------------------------------------
      // OFFLINE BYPASS: Immediate cache retrieval
      // -------------------------------------------------------------------------
      if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
        const cachedVersion = parseInt(localStorage.getItem(DAILY_TASK_CACHE_VERSION_KEY) || '0', 10);
        const cached = (cachedVersion === DAILY_TASK_CACHE_VERSION)
          ? localStorage.getItem(DAILY_TASK_CACHE_KEY)
          : null;

        if (cachedVersion !== DAILY_TASK_CACHE_VERSION) {
          localStorage.removeItem(DAILY_TASK_CACHE_KEY);
          localStorage.removeItem(DAILY_TASK_CACHE_VERSION_KEY);
        }

        if (cached) {
          console.warn('PowerProject: Using cached daily task data.');
          return JSON.parse(cached);
        }
      }

      const { data, error } = await supabase
        .from('daily_tasks')
        .select(DAILY_TASK_SELECT)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const results = (data || []).map(normalizeDailyTask);

      // -------------------------------------------------------------------------
      // CACHE PERSISTENCE: Save for offline use
      // -------------------------------------------------------------------------
      localStorage.setItem(DAILY_TASK_CACHE_KEY, JSON.stringify(results));
      localStorage.setItem(DAILY_TASK_CACHE_VERSION_KEY, String(DAILY_TASK_CACHE_VERSION));

      return results;
    } catch (err) {
      console.error('DailyTaskService Error:', err);
      const cachedVersion = parseInt(localStorage.getItem(DAILY_TASK_CACHE_VERSION_KEY) || '0', 10);
      const cached = (cachedVersion === DAILY_TASK_CACHE_VERSION)
        ? localStorage.getItem(DAILY_TASK_CACHE_KEY)
        : null;
      if (cached) return JSON.parse(cached);
      throw err;
    }
  },

  async addTask(taskData, userId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (addDailyTask).');
      return { ...taskData, id: taskData.id || `local-dt-${Date.now()}`, createdAt: new Date().toISOString() };
    }

    let row = mapDailyTaskToRow(taskData);
    row = auditService.stamp(row, userId, { isNew: true, useUnderscore: true });

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert([row])
      .select(DAILY_TASK_SELECT);

    if (error) throw error;
    return normalizeDailyTask(data[0]);
  },

  async updateTask(taskData, userId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (updateDailyTask).');
      return taskData;
    }

    let row = mapDailyTaskToRow(taskData);
    row = auditService.stamp(row, userId, { useUnderscore: true });
    
    // If moving to REVIEW stage, capture submission_by
    if (taskData.stageId === 'REVIEW') {
      row.submission_by = userId;
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .update(row)
      .eq('id', taskData.id)
      .select(DAILY_TASK_SELECT);

    if (error) throw error;
    return normalizeDailyTask(data[0]);
  },

  async updateTaskStage(taskId, newStageId, userId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (updateDailyTaskStage).');
      return;
    }

    let updates = { stage_id: newStageId };
    updates = auditService.stamp(updates, userId, { useUnderscore: true });
    
    if (newStageId === 'REVIEW') {
      updates.submission_by = userId;
    }

    const { error } = await supabase
      .from('daily_tasks')
      .update(updates)
      .eq('id', taskId);

    if (error) throw error;
  },

  async bulkUpdateTasks(taskIds, updates, userId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (bulkUpdateDailyTasks).');
      return []; // Shallow update in UI handles persistence
    }

    let dbUpdates = { ...updates };
    
    // Remap stageId if present in bulk updates
    if (updates.stageId) {
        dbUpdates.stage_id = updates.stageId;
        delete dbUpdates.stageId;
    }

    dbUpdates = auditService.stamp(dbUpdates, userId, { useUnderscore: true });

    if (dbUpdates.stage_id === 'REVIEW') {
        dbUpdates.submission_by = userId;
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .update(dbUpdates)
      .in('id', taskIds)
      .select(DAILY_TASK_SELECT);

    if (error) throw error;
    return (data || []).map(normalizeDailyTask);
  },

  async deleteTask(taskId) {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      console.warn('PowerProject: Offline modification (deleteDailyTask).');
      return;
    }

    const { error } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};
