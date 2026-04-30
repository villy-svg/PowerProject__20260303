import { useCallback } from 'react';
import { taskUtils } from '../utils/taskUtils';

/**
 * useTaskViewActions
 * 
 * Centralizes common action handlers and permission checks for task-based views
 * (Kanban, List, Tree).
 * 
 * @param {Object} options - Action dependencies
 * @param {Function} options.onUpdateStage - Callback to update a task stage
 * @param {Function} options.onDeleteTask - Callback to delete a task
 * @param {Object} options.permissions - Current user permissions
 * @param {Object} options.currentUser - Currently logged-in user
 * @param {Function} options.openEditModal - Trigger to open the edit modal
 * @param {Function} options.openSubmissionModal - Trigger to open proof of work modal
 * @param {Function} options.openAddSubtaskModal - Trigger to open subtask creation
 */
export const useTaskViewActions = ({
  onUpdateStage,
  onDeleteTask,
  permissions,
  currentUser,
  openEditModal,
  openSubmissionModal,
  openAddSubtaskModal
}) => {
  
  // ─── 1. Stage Movement Logic ───────────────────────────────────────────
  const handleMove = useCallback((task, direction, targetStage = null) => {
    if (!task) return;

    let targetId = targetStage;
    
    // Auto-calculate target if direction is provided instead of targetStage
    if (!targetId && direction) {
      const stages = ['BACKLOG', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'];
      const currentIndex = stages.indexOf(task.stageId);
      if (direction === 'left' && currentIndex > 0) targetId = stages[currentIndex - 1];
      if (direction === 'right' && currentIndex < stages.length - 1) targetId = stages[currentIndex + 1];
    }

    if (targetId && taskUtils.canUserMoveTask(task, targetId, permissions, currentUser)) {
      onUpdateStage(task.id, targetId);
    }
  }, [onUpdateStage, permissions, currentUser]);

  // ─── 2. Delete Confirmation ───────────────────────────────────────────
  const handleDelete = useCallback((taskId) => {
    onDeleteTask(taskId);
  }, [onDeleteTask]);

  // ─── 3. Action Toggles (Modals) ────────────────────────────────────────
  const handleEdit = useCallback((task) => {
    if (openEditModal) openEditModal(task);
  }, [openEditModal]);

  const handleSubmitProof = useCallback((task) => {
    if (openSubmissionModal) openSubmissionModal(task);
  }, [openSubmissionModal]);

  const handleAddSubtask = useCallback((parentTaskId) => {
    if (openAddSubtaskModal) openAddSubtaskModal(parentTaskId);
  }, [openAddSubtaskModal]);

  // ─── 4. Permission Fetchers ───────────────────────────────────────────
  const getTaskPermissions = useCallback((task) => {
    if (!task) return { canUpdate: false, canDelete: false };
    
    return {
      canUpdate: permissions.canUpdate || (task.created_by === currentUser.id && permissions.level === 'contributor'),
      canDelete: permissions.canDelete || (task.created_by === currentUser.id && permissions.level === 'contributor'),
      canMove: (target) => taskUtils.canUserMoveTask(task, target, permissions, currentUser)
    };
  }, [permissions, currentUser]);

  return {
    handleMove,
    handleDelete,
    handleEdit,
    handleSubmitProof,
    handleAddSubtask,
    getTaskPermissions
  };
};
