import { useState, useCallback, useMemo } from 'react';
import { taskService } from '../services/tasks/taskService';
import { masterErrorHandler } from '../services/core/masterErrorHandler';

/**
 * useTasks Hook
 * Manages all task state and delegates DB operations to taskService.
 * Replaces the scattered task CRUD logic that was previously in App.jsx.
 *
 * Usage in App.jsx:
 *   const { tasks, setTasks, loading, fetchTasks, addTask, updateTask,
 *           updateTaskStage, deleteTask, bulkUpdateTasks } = useTasks();
 */
export const useTasks = (user) => {
  const [tasks, setTasks] = useState(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      const cached = localStorage.getItem('powerpod_tasks_v5');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('UseTasks Cache Parse Error:', e);
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // READ
  // ---------------------------------------------------------------------------

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await taskService.getTasks();
      setTasks(data);
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.fetchTasks');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  const addTask = async (taskData) => {
    try {
      const newTask = await taskService.addTask(taskData, user?.id);
      setTasks(prev => [...prev, newTask]);
      return newTask;
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.addTask');
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  const updateTask = async (taskData) => {
    try {
      const updated = await taskService.updateTask(taskData, user?.id);
      setTasks(prev => prev.map(t => t.id === taskData.id ? updated : t));
      return updated;
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.updateTask');
      throw err;
    }
  };

  const updateTaskStage = async (taskId, newStageId) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stageId: newStageId } : t));
    try {
      await taskService.updateTaskStage(taskId, newStageId, user?.id);
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.updateTaskStage');
      // Revert on failure
      await fetchTasks(false);
      throw err;
    }
  };

  const bulkUpdateTasks = async (taskIds, updates) => {
    try {
      const updatedTasks = await taskService.bulkUpdateTasks(taskIds, updates, user?.id);
      setTasks(prev => prev.map(t => {
        const updated = updatedTasks.find(u => u.id === t.id);
        return updated || t;
      }));
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.bulkUpdateTasks');
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  const deleteTask = async (taskId) => {
    try {
      await taskService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useTasks.deleteTask');
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // HIERARCHY COMPUTATIONS
  // ---------------------------------------------------------------------------

  const parentTasks = useMemo(() =>
    tasks.filter(t => !t.isSubTask),
    [tasks]
  );

  const subTasksByParent = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      if (t.parentTask) {
        if (!map[t.parentTask]) map[t.parentTask] = [];
        map[t.parentTask].push(t);
      }
    });
    return map;
  }, [tasks]);

  const getSubTasks = useCallback((parentId) =>
    subTasksByParent[parentId] || [],
    [subTasksByParent]
  );

  // ---------------------------------------------------------------------------

  return {
    tasks,
    setTasks,    // exposed for optimistic updates (e.g. TaskController bulk delete)
    loading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
    // Hierarchy
    parentTasks,
    subTasksByParent,
    getSubTasks,
  };
};
