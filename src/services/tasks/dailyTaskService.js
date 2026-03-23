/**
 * Daily Task Service
 * Specialized service for the `daily_tasks` table with audit tracking.
 */
import { supabase } from '../core/supabaseClient';

const normalizeDailyTask = (row) => ({
  id: row.id,
  text: row.text,
  description: row.description,
  priority: row.priority,
  stageId: row.stage_id, // Mapping snake_case DB to camelCase UI
  hub_id: row.hub_id,
  city: row.city,
  function: row.function_name, // Mapping function_name DB to function UI
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

const mapDailyTaskToRow = (task) => ({
  text: task.text,
  description: task.description || null,
  priority: task.priority || 'Medium',
  stage_id: task.stageId,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function_name: task.function || null,
  assigned_to: task.assigned_to || null,
  scheduled_date: task.scheduled_date || new Date().toISOString().split('T')[0],
  is_recurring: !!task.is_recurring,
  last_updated_by: task.lastUpdatedBy || null,
  submission_by: task.submissionBy || null,
});

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
    const row = {
      ...mapDailyTaskToRow(taskData),
      created_by: userId,
      last_updated_by: userId,
    };

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert([row])
      .select(DAILY_TASK_SELECT);

    if (error) throw error;
    return normalizeDailyTask(data[0]);
  },

  async updateTask(taskData, userId) {
    const row = {
      ...mapDailyTaskToRow(taskData),
      last_updated_by: userId,
    };
    
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
    const updates = { 
        stage_id: newStageId, 
        last_updated_by: userId 
    };
    
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
    const dbUpdates = { ...updates, last_updated_by: userId };
    
    // Remap stageId if present in bulk updates
    if (updates.stageId) {
        dbUpdates.stage_id = updates.stageId;
        delete dbUpdates.stageId;
        if (dbUpdates.stage_id === 'REVIEW') {
            dbUpdates.submission_by = userId;
        }
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
