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
export const useHierarchyDnd = ({ itemId, onDrop, disabled = false }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const dragProps = {
    draggable: !disabled,
    onDragStart: (e) => {
      if (disabled) return;
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    }
  };

  const dropProps = {
    onDragOver: (e) => {
      e.preventDefault();
      if (disabled) return;
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    },
    onDragLeave: () => {
      setIsDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      
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
