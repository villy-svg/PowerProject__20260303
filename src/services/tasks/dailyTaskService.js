/**
 * Daily Task Service
 * Specialized service for the `daily_tasks` table with audit tracking.
 */
import { supabase } from '../core/supabaseClient';
import { auditService } from '../core/auditService';
import { VERTICALS } from '../../constants/verticals';

const normalizeDailyTask = (row) => ({
  id: row.id,
  text: row.text,
  description: row.description,
  priority: row.priority,
  stageId: row.stage_id, // Mapping snake_case DB to camelCase UI
  hub_id: row.hub_id || row.client_id || row.employee_id || row.partner_id || row.vendor_id, // Unified subject ID for UI
  city: row.city,
  function: row.function_name, 
  verticalId: row.vertical_id,
  assigned_to: row.assigned_to,
  scheduled_date: row.scheduled_date,
  is_recurring: row.is_recurring,
  assigneeName: row.employees?.full_name || row.assigneeName,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by,
  lastUpdatedBy: row.last_updated_by,
  submissionBy: row.submission_by,
});

const mapDailyTaskToRow = (task) => {
  const vid = (task.verticalId || '').toUpperCase();
  const subjectId = task.hub_id === '' ? null : (task.hub_id || null);

  const row = {
    text: task.text || 'Untitled Task',
    description: task.description || null,
    priority: task.priority || 'Medium',
    stage_id: task.stageId, // Keep stage_id from original mapping
    city: task.city || null,
    function_name: task.function || null,
    vertical_id: task.verticalId || VERTICALS.CHARGING_HUBS.id, 
    assigned_to: task.assigned_to || null,
    scheduled_date: task.scheduled_date || new Date().toISOString().split('T')[0],
    is_recurring: !!task.is_recurring,
    last_updated_by: task.lastUpdatedBy || null,
    submission_by: task.submissionBy || null,
  };

  // Intelligent Subject Mapping
  if (vid.includes('CLIENT')) row.client_id = subjectId;
  else if (vid.includes('EMPLOYEE')) row.employee_id = subjectId;
  else if (vid.includes('PARTNER')) row.partner_id = subjectId;
  else if (vid.includes('VENDOR')) row.vendor_id = subjectId;
  else row.hub_id = subjectId; // Fallback to Hubs

  return row;
};

const DAILY_TASK_SELECT = '*, employees:assigned_to (full_name)';

export const dailyTaskService = {
  async getTasks() {
    const { data, error } = await supabase
      .from('daily_tasks')
      .select(DAILY_TASK_SELECT)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(normalizeDailyTask);
  },

  async addTask(taskData, userId) {
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
    const { error } = await supabase
      .from('daily_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  },
};
