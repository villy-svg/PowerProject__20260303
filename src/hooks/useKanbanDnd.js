import { useState } from 'react';
import { taskUtils } from '../utils/taskUtils';

/**
 * useKanbanDnd
 * A custom hook to handle drag-and-drop actions at the Kanban column level.
 * Handles dragging tasks between columns/stages and checking permissions.
 *
 * @param {Object} options
 * @param {string} options.stageId - The stage ID this column represents.
 * @param {Array} options.tasks - Full list of tasks to resolve the dragged task.
 * @param {Object} options.permissions - Current user permissions.
 * @param {Object} options.user - Current logged in user details.
 * @param {Function} options.updateTaskStage - Callback to update a task's stage.
 */
export const useKanbanDnd = ({ stageId, tasks, permissions, user, updateTaskStage }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const dropProps = {
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    },
    onDragLeave: () => {
      setIsDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setIsDragOver(false);
      
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId) {
        const draggedTask = tasks.find(t => t.id === draggedId);
        if (draggedTask && draggedTask.stageId !== stageId) {
          if (taskUtils.canUserMoveTask(draggedTask, stageId, permissions, user)) {
            updateTaskStage(draggedTask.id, stageId);
          } else {
            alert(`You do not have permission to move this task to the targeted stage.`);
          }
        }
      }
    }
  };

  return {
    isDragOver,
    dropProps
  };
};
