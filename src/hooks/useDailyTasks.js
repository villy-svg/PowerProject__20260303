import { useMemo } from 'react';
import { dailyTaskService } from '../services/tasks/dailyTaskService';

/**
 * useDailyTasks Hook
 *
 * FIX Issue-1 & Issue-2: Previously this hook called useTasks(user) internally,
 * creating a THIRD independent task store that was completely disconnected from
 * App.jsx's task array. That meant:
 *   - fetchTasks() in App never updated the Daily Board (Issue 1)
 *   - addTask() returned data into a ghost state nobody could see (Issue 2)
 *
 * FIXED ARCHITECTURE:
 * This hook now accepts the already-resolved `allTasks` array directly from App.jsx
 * (single source of truth). It only filters for Daily tasks and provides
 * domain-specific CRUD wrappers that call dailyTaskService. The mutations
 * (add/update/delete) are expected to trigger the parent's `fetchTasks()` via the
 * `onRefresh` callback to keep the shared store in sync.
 *
 * Usage in App.jsx:
 *   const { tasks: dailyTasks, addTask: addDailyTask, ... } =
 *     useDailyTasks(tasks, setTasks, user, fetchTasks);
 */
export const useDailyTasks = (allTasks = [], setAllTasks, user, onRefresh) => {
  // 1. Filter the shared task array to Daily Board tasks only
  const dailyTasks = useMemo(() =>
    allTasks.filter(t =>
      Array.isArray(t.task_board) && t.task_board.includes('Hubs Daily')
    ),
    [allTasks]
  );

  // 2. Hierarchy Logic (scoped to daily tasks)
  const parentTasks = useMemo(() =>
    dailyTasks.filter(t => !t.parentTask),
    [dailyTasks]
  );

  const getSubTasks = (parentId) =>
    dailyTasks.filter(t => t.parentTask === parentId);

  // ---------------------------------------------------------------------------
  // Domain CRUD — delegates to dailyTaskService, then syncs the shared store.
  // We optimistically append/update in-place for instant UI feedback, then
  // trigger a background refresh to reconcile with the server's truth.
  // ---------------------------------------------------------------------------

  const addTask = async (taskData) => {
    const result = await dailyTaskService.addTask(taskData, user?.id);
    const newTasks = Array.isArray(result) ? result : [result];

    // Append to the shared task array so the daily board updates immediately
    if (setAllTasks) {
      setAllTasks(prev => [...newTasks, ...prev]);
    }

    // Background reconciliation with server
    if (onRefresh) onRefresh(false);

    return newTasks[0];
  };

  const updateTask = async (taskData) => {
    const updated = await dailyTaskService.updateTask(taskData, user?.id);
    if (setAllTasks) {
      setAllTasks(prev => prev.map(t => t.id === taskData.id ? updated : t));
    }
    return updated;
  };

  const updateTaskStage = async (taskId, newStageId) => {
    // Optimistic update
    if (setAllTasks) {
      setAllTasks(prev => prev.map(t => t.id === taskId ? { ...t, stageId: newStageId } : t));
    }
    try {
      await dailyTaskService.updateTaskStage(taskId, newStageId, user?.id);
      // Background reconciliation on success
      if (onRefresh) onRefresh(false);
    } catch (err) {
      // Revert on failure by triggering a full refresh
      if (onRefresh) onRefresh(false);
      throw err;
    }
  };

  const bulkUpdateTasks = async (taskIds, updates) => {
    const updatedTasks = await dailyTaskService.bulkUpdateTasks(taskIds, updates, user?.id);
    if (setAllTasks) {
      setAllTasks(prev => prev.map(t => {
        const updated = updatedTasks.find(u => u.id === t.id);
        return updated || t;
      }));
    }
  };

  const deleteTask = async (taskId) => {
    await dailyTaskService.deleteTask(taskId);
    if (setAllTasks) {
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  return {
    tasks: dailyTasks,
    allTasks,
    parentTasks,
    getSubTasks,
    // Domain-scoped CRUD
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  };
};
