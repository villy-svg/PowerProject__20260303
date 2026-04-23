import { useState, useCallback } from 'react';
import { dailyTaskService } from '../services/tasks/dailyTaskService';
import { masterErrorHandler } from '../services/core/masterErrorHandler';

export const useDailyTasks = (user) => {
  const [tasks, setTasks] = useState(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true') {
      const cached = localStorage.getItem('powerpod_daily_tasks_v3');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          console.error('UseDailyTasks Cache Parse Error:', e);
          return [];
        }
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await dailyTaskService.getTasks();
      setTasks(data);
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.fetchTasks');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const addTask = async (taskData) => {
    try {
      const newTask = await dailyTaskService.addTask(taskData, user?.id);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.addTask');
      throw err;
    }
  };

  const updateTask = async (taskData) => {
    try {
      const updated = await dailyTaskService.updateTask(taskData, user?.id);
      setTasks(prev => prev.map(t => t.id === taskData.id ? updated : t));
      return updated;
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.updateTask');
      throw err;
    }
  };

  const updateTaskStage = async (taskId, newStageId) => {
    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stageId: newStageId } : t));
    try {
      await dailyTaskService.updateTaskStage(taskId, newStageId, user?.id);
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.updateTaskStage');
      await fetchTasks(false);
      throw err;
    }
  };

  const bulkUpdateTasks = async (taskIds, updates) => {
    try {
      const updatedTasks = await dailyTaskService.bulkUpdateTasks(taskIds, updates, user?.id);
      setTasks(prev => prev.map(t => {
        const updated = updatedTasks.find(u => u.id === t.id);
        return updated || t;
      }));
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.bulkUpdateTasks');
      throw err;
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await dailyTaskService.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      masterErrorHandler.handleDatabaseError(err, 'useDailyTasks.deleteTask');
      throw err;
    }
  };

  return {
    tasks,
    setTasks,
    loading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  };
};
