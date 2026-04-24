import { useMemo } from 'react';
import { useTasks } from './useTasks';
import { dailyTaskService } from '../services/tasks/dailyTaskService';

/**
 * useDailyTasks Hook
 * 
 * ARCHITECTURE NOTE:
 * This hook wraps useTasks() to share the global task stream and cache.
 * It applies 'Hubs Daily' filtering and uses dailyTaskService for 
 * board-specific logic (like submission tracking and tagging).
 */
export const useDailyTasks = (user) => {
  const taskHook = useTasks(user);

  // 1. Filter tasks for the Daily Board
  const dailyTasks = useMemo(() => 
    taskHook.tasks.filter(t => 
      Array.isArray(t.task_board) && t.task_board.includes('Hubs Daily')
    ), 
    [taskHook.tasks]
  );

  // 2. Hierarchy Logic
  const parentTasks = useMemo(() => 
    dailyTasks.filter(t => !t.parentTask), 
    [dailyTasks]
  );

  const getSubTasks = (parentId) => 
    dailyTasks.filter(t => t.parentTask === parentId);

  // 3. Export filtered data & override CRUD with domain-specific logic
  return {
    ...taskHook,
    tasks: dailyTasks,
    allTasks: taskHook.tasks,
    parentTasks,
    getSubTasks,
    
    // Domain Overrides
    addTask: (taskData) => dailyTaskService.addTask(taskData, user?.id),
    updateTask: (taskData) => dailyTaskService.updateTask(taskData, user?.id),
    updateTaskStage: (taskId, newStageId) => dailyTaskService.updateTaskStage(taskId, newStageId, user?.id),
    bulkUpdateTasks: (taskIds, updates) => dailyTaskService.bulkUpdateTasks(taskIds, updates, user?.id),
  };
};
