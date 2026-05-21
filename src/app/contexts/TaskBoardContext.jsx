/**
 * TaskBoardContext.jsx
 * Owns all task state for the application. Resolves which task set is active
 * (regular / daily / escalation) based on the current activeVertical.
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * 1. useDailyTasks depends on the SHARED tasks + setTasks from useTasks.
 *    Do NOT create a separate tasks array for daily tasks.
 * 2. escalationTasks is a derived memo of the main tasks array — it is NOT
 *    a separate fetch. It is filtered from the global tasks by task_board.
 * 3. The 'active' variants (activeTasks, activeAddTask, etc.) resolve which
 *    set is used based on the current activeVertical from AppNavigationContext.
 */
import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useDailyTasks } from '../../hooks/useDailyTasks';
import { useAppNavigation } from './AppNavigationContext';

const TaskBoardContext = createContext(null);

export function TaskBoardProvider({ user, verticals = {}, children }) {
  const { activeVertical } = useAppNavigation();

  // ── Primary Task Store ────────────────────────────────────────────────────
  const {
    tasks,
    setTasks,
    loading: tasksLoading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  } = useTasks(user);

  // ── Initial Data Load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id) {
      fetchTasks();
    }
  }, [user?.id, fetchTasks]);

  // ── Daily Task Overlay ────────────────────────────────────────────────────
  // useDailyTasks uses the SAME tasks/setTasks — it does NOT create a third store.
  const {
    tasks: dailyTasks,
    addTask: addDailyTask,
    updateTask: updateDailyTask,
    updateTaskStage: updateDailyTaskStage,
    bulkUpdateTasks: bulkUpdateDailyTasks,
    deleteTask: deleteDailyTask,
  } = useDailyTasks(tasks, setTasks, user, fetchTasks);

  // ── Escalation Task Filter ────────────────────────────────────────────────
  // Escalations include both explicitly tagged 'Escalations' and implicitly high-priority tasks
  const escalationTasks = useMemo(() => {
    const hubId = verticals?.CHARGING_HUBS?.id || 'CHARGING_HUBS';
    if (!hubId) return [];

    return tasks.filter(t => {
      const isHubTask = t.verticalId === hubId || t.verticalId === 'CHARGING_HUBS';
      if (!isHubTask) return false;

      const isLive = t.stageId !== 'COMPLETED' && t.stageId !== 'DEPRIORITIZED';
      if (!isLive) return false;

      const isHighPriority = t.priority === 'High' || t.priority === 'Urgent';
      const isManuallyEscalated = Array.isArray(t.task_board) && t.task_board.includes('Escalations');

      return isHighPriority || isManuallyEscalated;
    });
  }, [tasks, verticals?.CHARGING_HUBS?.id]);

  // ── Active Set Resolution ─────────────────────────────────────────────────
  // Which task set + CRUD actions are active for the current view?
  const isDaily      = activeVertical === 'daily_hub_tasks';
  const isEscalation = activeVertical === 'escalation_tasks';

  const activeTasks          = isDaily ? dailyTasks      : isEscalation ? escalationTasks : tasks;
  const activeAddTask        = isDaily ? addDailyTask    : addTask;
  const activeUpdateTask     = isDaily ? updateDailyTask : updateTask;
  const activeUpdateTaskStage = isDaily ? updateDailyTaskStage : updateTaskStage;
  const activeBulkUpdateTasks = isDaily ? bulkUpdateDailyTasks : bulkUpdateTasks;
  const activeDeleteTask     = isDaily ? deleteDailyTask : deleteTask;

  // ── Context Value ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    // Raw stores (for components that need the full unfiltered list)
    tasks,
    setTasks,
    tasksLoading,
    fetchTasks,
    dailyTasks,
    escalationTasks,
    // Active-view-resolved accessors (preferred for TaskController)
    activeTasks,
    activeAddTask,
    activeUpdateTask,
    activeUpdateTaskStage,
    activeBulkUpdateTasks,
    activeDeleteTask,
    // Raw CRUD (for special cases — e.g. EmployeeManagement filtering tasks)
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  }), [
    tasks, setTasks, tasksLoading, fetchTasks, dailyTasks, escalationTasks,
    activeTasks, activeAddTask, activeUpdateTask, activeUpdateTaskStage,
    activeBulkUpdateTasks, activeDeleteTask, addTask, updateTask,
    updateTaskStage, bulkUpdateTasks, deleteTask
  ]);

  return (
    <TaskBoardContext.Provider value={value}>
      {children}
    </TaskBoardContext.Provider>
  );
}

/**
 * useTaskBoard — Consume task state from any component.
 */
export function useTaskBoard() {
  const ctx = useContext(TaskBoardContext);
  if (!ctx) {
    throw new Error('[useTaskBoard] Must be used inside <TaskBoardProvider>.');
  }
  return ctx;
}
