import { useState, useEffect, useCallback } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import { taskUtils } from '../utils/taskUtils';

// Sub-hooks
import { useTaskFilters } from './useTaskFilters';
import { useTaskSelection } from './useTaskSelection';
import { useTaskPermissions } from './useTaskPermissions';

/**
 * useTaskController Hook (Orchestrator)
 * Coordinates sub-hooks for filtering, selection, and permissions.
 * Manages UI-specific state and action handlers.
 */
export const useTaskController = (props) => {
  const {
    activeVertical,
    tasks = [],
    setTasks,
    actualSetTasks,
    addTask,
    bulkUpdateTasks,
    deleteTask,
    updateTaskStage,
    updateTask,
    user = {},
    permissions = {},
    rootVerticalId,
    viewMode: initialViewMode
  } = props;

  // 1. UI-Specific State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() =>
    localStorage.getItem(`powerpod_task_view_${activeVertical}`) ||
    localStorage.getItem('powerpod_task_view') ||
    initialViewMode || 'list'
  );
  const [showDeprioritized, setShowDeprioritized] = useState(false);
  const [showReworkOnly, setShowReworkOnly] = useState(false);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(() =>
    localStorage.getItem(`powerpod_task_my_tasks_${activeVertical}`) === 'true'
  );
  const [drillDownId, setDrillDownId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [mergeTaskCluster, setMergeTaskCluster] = useState(null);

  // 2. Integration of Sub-Hooks
  const filtersInfo = useTaskFilters({ ...props, viewMode, drillDownId, showReworkOnly, showMyTasksOnly });
  const { filteredTasks, hierarchyFilteredTasks, tasksWithDuplicateInfo } = filtersInfo;

  const selectionInfo = useTaskSelection(tasks);
  const { selectedTaskIds, setSelectedTaskIds, clearSelection, toggleTaskSelection, selectedTasks, sameStage, commonStageId, toggleStageSelection } = selectionInfo;

  const permissionsInfo = useTaskPermissions({ ...props });
  const { canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy, canEditTask } = permissionsInfo;

  // 3. Persistence & Derived State
  useEffect(() => {
    localStorage.setItem(`powerpod_task_view_${activeVertical}`, viewMode);
  }, [viewMode, activeVertical]);

  useEffect(() => {
    localStorage.setItem(`powerpod_task_my_tasks_${activeVertical}`, showMyTasksOnly);
  }, [showMyTasksOnly, activeVertical]);

  const drillPath = useCallback(() => {
    if (!drillDownId) return [];
    const path = [];
    let curr = (tasks || []).find(t => t.id === drillDownId);
    while (curr) {
      path.unshift(curr);
      curr = (tasks || []).find(t => t.id === curr.parentTask);
    }
    return path;
  }, [drillDownId, tasks])();

  // 4. Action Handlers
  const handleBulkAction = async (action) => {
    if (selectedTaskIds.length === 0) return;

    if (action === 'delete') {
      setConfirmDialog({
        isOpen: true,
        title: 'Confirm Bulk Delete',
        message: `Are you sure you want to permanently delete these ${selectedTaskIds.length} tasks?`,
        onConfirm: async () => {
          setSaving(true);
          try {
            for (const id of selectedTaskIds) await deleteTask(id);
            actualSetTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
            clearSelection();
          } catch (err) {
            alert("Some tasks could not be deleted.");
          } finally {
            setSaving(false);
            setConfirmDialog(p => ({ ...p, isOpen: false }));
          }
        }
      });
    } else if (['deprio', 'restore', 'forward', 'backward'].includes(action)) {
      const targetIds = selectedTasks.filter(t => !t.isContextOnly).map(t => t.id);
      if (targetIds.length === 0) { clearSelection(); return; }

      if (action === 'deprio') await bulkUpdateTasks(targetIds, { stageid: 'DEPRIORITIZED' });
      else if (action === 'restore') await bulkUpdateTasks(targetIds, { stageid: 'BACKLOG' });
      else if (action === 'forward' || action === 'backward') {
        if (!sameStage) return;
        const currentIndex = STAGE_LIST.findIndex(s => s.id === commonStageId);
        let newIndex = currentIndex;
        if (action === 'forward' && currentIndex < STAGE_LIST.length - 1) newIndex++;
        if (action === 'backward' && currentIndex > 0) newIndex--;
        if (newIndex !== currentIndex) await bulkUpdateTasks(targetIds, { stageid: STAGE_LIST[newIndex].id });
      }
      clearSelection();
    }
  };

  const handleUIMoveTask = (taskId, newStageId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.isContextOnly) return;
    if (!taskUtils.canUserMoveTask(task, newStageId, permissions, user)) {
      alert("Manual movement restricted. Please use 'Upload Proof' to submit your work for review.");
      return;
    }
    updateTaskStage(taskId, newStageId);
  };

  const handleInternalDelete = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.isContextOnly) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Delete',
      message: 'Delete this task permanently?',
      onConfirm: async () => {
        setSaving(true);
        try {
          await deleteTask(taskId);
          setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err) { alert("Delete failed."); }
        finally { setSaving(false); setConfirmDialog(p => ({ ...p, isOpen: false })); }
      }
    });
  };

  const handleMoveToParent = async (childId, parentId) => {
    if (!canUserUpdate || childId === parentId) return;
    const task = tasks.find(t => t.id === childId);
    if (!task || task.isContextOnly) return;
    try {
      await updateTask({ ...task, parentTask: parentId });
    } catch (err) { alert('Failed to update relationship.'); }
    finally { setSaving(false); }
  };

  const handleSaveTask = async (formData) => {
    const isEditing = !!(editingTask && editingTask.id);
    if (isEditing && (editingTask.isContextOnly || !canUserUpdate)) return;
    if (!isEditing && !canUserCreate) return;

    setSaving(true);
    try {
      if (isEditing) await updateTask({ ...editingTask, ...formData });
      else {
        const newTask = { ...createInitialTask(formData.text, rootVerticalId || activeVertical), ...formData };
        if (addTask) await addTask(newTask); else setTasks(prev => [...prev, newTask]);
      }
      setIsModalOpen(false); setEditingTask(null);
    } catch (err) { alert(`Failed to save: ${err.message || 'Unknown error'}`); }
    finally { setSaving(false); }
  };

  const executeMerge = async (primaryTaskId) => {
    const primaryTask = tasks.find(t => t.id === primaryTaskId);
    if (!primaryTask) return;
    const duplicates = tasks.filter(t => t.id !== primaryTaskId && t.text === primaryTask.text && t.verticalId === primaryTask.verticalId);
    try {
      await bulkUpdateTasks(duplicates.map(t => t.id), { stageid: 'DEPRIORITIZED' });
      setMergeTaskCluster(null);
    } catch (err) { alert('Merge failed.'); }
  };

  const handleClearBoard = async () => {
    const verticalTasks = (tasks || []).filter(t => t.verticalId === (rootVerticalId || activeVertical) && t.stageId !== 'DEPRIORITIZED');
    if (verticalTasks.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Board',
      message: `Move ${verticalTasks.length} active tasks to Deprioritized?`,
      onConfirm: async () => {
        setSaving(true);
        try { await bulkUpdateTasks(verticalTasks.map(t => t.id), { stageid: 'DEPRIORITIZED' }); }
        catch (err) { alert("Failed to clear board."); }
        finally { setSaving(false); setConfirmDialog(p => ({ ...p, isOpen: false })); }
      }
    });
  };

  const openAddModal = () => { setEditingTask(null); setIsModalOpen(true); };
  const openEditModal = (task) => { setEditingTask(task); setIsModalOpen(true); };
  const handleAddSubtask = (parentId) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!canManageHierarchy(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks to this record.");
      return;
    }
    setEditingTask({ parentTask: parentId }); setIsModalOpen(true);
  };

  return {
    ...filtersInfo,
    ...selectionInfo,
    ...permissionsInfo,
    isModalOpen, setIsModalOpen,
    editingTask, setEditingTask,
    saving,
    viewMode, setViewMode,
    showDeprioritized, setShowDeprioritized,
    showReworkOnly, setShowReworkOnly,
    showMyTasksOnly, setShowMyTasksOnly,
    drillDownId, setDrillDownId,
    drillPath,
    confirmDialog, setConfirmDialog,
    mergeTaskCluster, setMergeTaskCluster,
    handleBulkAction,
    handleUIMoveTask,
    updateTaskStage,
    handleInternalDelete,
    handleMoveToParent,
    handleSaveTask,
    executeMerge,
    handleClearBoard,
    openAddModal, openEditModal, handleAddSubtask,
    canEditTask
  };
};
