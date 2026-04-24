/**
 * Daily Task Service (Domain Service)
 * Specialized wrapper for tasks belonging to the 'Hubs Daily' board.
 * Targets the unified `tasks` table.
 */
import { supabase } from '../core/supabaseClient';
import { taskService, normalizeTask, TASK_SELECT } from './taskService';

const BOARD_TAG = 'Hubs Daily';

export const dailyTaskService = {
  /**
   * Fetch only tasks tagged for the Hubs Daily board.
   */
  async getTasks() {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_SELECT)
        .contains('task_board', [BOARD_TAG])
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(normalizeTask);
    } catch (err) {
      console.error('DailyTaskService.getTasks Error:', err);
      throw err;
    }
  },

  /**
   * Add a task and ensure it is tagged for the Hubs Daily board.
   */
  async addTask(taskData, userId) {
    const dailyTaskData = {
      ...taskData,
      task_board: Array.from(new Set([...(taskData.task_board || []), BOARD_TAG]))
    };
    return taskService.addTask(dailyTaskData, userId);
  },

  /**
   * Update a task and handle domain-specific logic like submission tracking.
   */
  async updateTask(taskData, userId) {
    const updates = { ...taskData };
    
    // Domain Logic: Capture submission_by when moving to REVIEW
    if (taskData.stageId === 'REVIEW') {
      updates.submissionBy = userId;
    }

    return taskService.updateTask(updates, userId);
  },

  /**
   * Specialized stage update with submission tracking.
   */
  async updateTaskStage(taskId, newStageId, userId) {
    const updates = { stageId: newStageId };
    
    if (newStageId === 'REVIEW') {
      updates.submissionBy = userId;
    }

    return taskService.updateTask({ id: taskId, ...updates }, userId);
  },

  /**
   * Bulk updates with domain logic injection.
   */
  async bulkUpdateTasks(taskIds, updates, userId) {
    const domainUpdates = { ...updates };
    
    // Remap stageId if present
    if (updates.stageId) {
      domainUpdates.stage_id = updates.stageId;
      delete domainUpdates.stageId;
    }

    if (domainUpdates.stage_id === 'REVIEW') {
      domainUpdates.submissionBy = userId;
    }

    return taskService.bulkUpdateTasks(taskIds, domainUpdates, userId);
  },

  async deleteTask(taskId) {
    return taskService.deleteTask(taskId);
  },
};
