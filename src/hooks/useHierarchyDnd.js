import { useState } from 'react';

/**
 * useHierarchyDnd
 * A reusable hook for native HTML5 Drag and Drop in hierarchical structures.
 * 
 * @param {Object} options
 * @param {string} options.itemId - The unique ID of the item being dragged/dropped on.
 * @param {Function} options.onDrop - Callback for when a valid drop occurs: (draggedId, targetId) => void
 * @param {boolean} options.disabled - Optional flag to disable DND (e.g. for context-only tasks)
 */
export const useHierarchyDnd = ({ itemId, onDrop, disabled = false, dragDisabled = disabled, dropDisabled = disabled }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const dragProps = {
    draggable: !dragDisabled,
    onDragStart: (e) => {
      if (dragDisabled) return;
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const dropProps = {
    onDragOver: (e) => {
      e.preventDefault();
      if (dropDisabled) return;
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    },
    onDragLeave: () => {
      setIsDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent drag-drop events on nested subtasks from bubbling up to stage columns
      setIsDragOver(false);
      if (dropDisabled) return;
      
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== itemId) {
        onDrop(draggedId, itemId);
      }
    }
  };

  return {
    isDragOver,
    dragProps,
    dropProps
  };
};
