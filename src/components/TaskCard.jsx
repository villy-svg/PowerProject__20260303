import React, { useState } from 'react';
import AssigneeBadge from './AssigneeBadge';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import './TaskCard.css';

/**
 * TaskCard
 * Master wrapper for all Kanban tasks enforcing a standard 3-row layout.
 * Row 1: Task Title
 * Row 2: Priority (Standard) + Vertical Meta (Children)
 * Row 3: Action Controls (Arrows, Edit, Delete)
 */
const TaskCard = ({
  task,
  stage,
  canUpdate,
  canDelete,
  updateTaskStage,
  deleteTask,
  openEditModal,
  openAddSubtaskModal,
  onMoveToParent,
  onDuplicateMerge,
  STAGE_LIST,
  isSelected = false,
  onSelect,
  children, // Vertical-specific metadata
  currentUser
}) => {
  const handleMove = (direction) => {
    const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
    let newIndex = currentIndex;

    if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < STAGE_LIST.length - 1) {
      newIndex = currentIndex + 1;
    }

    if (newIndex !== currentIndex) {
      updateTaskStage(task.id, STAGE_LIST[newIndex].id);
    }
  };

  const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STAGE_LIST.length - 1;

  const effectiveCanUpdate = canUpdate && !task.isContextOnly;
  const effectiveCanDelete = canDelete && !task.isContextOnly;

  const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
    itemId: task.id,
    onDrop: onMoveToParent,
    disabled: task.isContextOnly || !canUpdate
  });

  return (
    <div
      className={`task-card-master ${task.isDuplicate && task.isFirstInCluster ? 'is-duplicate-stacked' : ''} ${isSelected ? 'selected' : ''} ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
      {...dragProps}
      {...dropProps}
      onDoubleClick={() => {
        if (task.isDuplicate) {
          onDuplicateMerge(task);
        } else if (effectiveCanUpdate) {
          openEditModal(task);
        }
      }}
      style={{
        borderLeft: `4px solid ${stage?.color || 'var(--border-color)'}`,
        '--stage-color': stage?.color || 'var(--brand-green)',
        opacity: task.isContextOnly ? 0.7 : 1,
        cursor: task.isContextOnly ? 'default' : undefined
      }}
    >
      <div className="task-selection-area" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>
      {/* Row 1: Metadata (Priority + Custom Children) */}
      <div className="card-row-1">
        {task.isContextOnly && (
          <span className="card-priority" title="Context Only (View Only)" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px' }}>
            VIEWER
          </span>
        )}
        {task.parentTask && (
          <span className="card-priority" title="Subtask" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            ↳ Sub
          </span>
        )}
        {task.priority && (
          <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
            {task.priority}
          </span>
        )}
        {task.isDuplicate && (
          <span className="duplicate-badge" title={`${task.duplicateCount} identical tasks found`}>
            DUP
          </span>
        )}
        <AssigneeBadge task={task} currentUser={currentUser} />
        {children}
      </div>

      {/* Row 2: Title */}
      <div className="card-row-2">
        <span className="card-task-name" title={task.text}>{task.text}</span>
      </div>

      {/* Row 3: Controls */}
      <div className="card-row-3">
        <div className="card-navigation">
          {effectiveCanUpdate && (
            <>
              <button
                className={`card-nav-button ${!canMoveLeft ? 'disabled' : ''}`}
                onClick={() => handleMove('left')}
                disabled={!canMoveLeft}
                title="Move Back"
              >
                ←
              </button>
              <button
                className={`card-nav-button ${(!canMoveRight || task.stageId === 'COMPLETED') ? 'disabled' : ''}`}
                onClick={() => handleMove('right')}
                disabled={!canMoveRight || task.stageId === 'COMPLETED'}
                title={task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
              >
                →
              </button>
            </>
          )}
        </div>

        <div className="card-actions">
          {effectiveCanUpdate && (
            <button
              className="card-add-sub-button"
              onClick={() => openAddSubtaskModal(task.id)}
              title="Add Subtask Under This"
              style={{ color: 'var(--brand-green)', fontWeight: 800, fontSize: '1.1rem' }}
            >
              +
            </button>
          )}

          {effectiveCanUpdate && (
            <button
              className="card-edit-button"
              onClick={() => openEditModal(task)}
              title="Edit Task"
            >
              ✎
            </button>
          )}

          {effectiveCanUpdate && task.stageId === 'DEPRIORITIZED' && (
            <button
              className="card-reprio-button"
              onClick={() => updateTaskStage(task.id, 'BACKLOG')}
              title="Move back to Pending"
              style={{ color: 'var(--brand-green)', fontWeight: 800 }}
            >
              ⬆
            </button>
          )}

          {effectiveCanUpdate && task.stageId !== 'DEPRIORITIZED' && (
            <button
              className="card-deprio-button"
              onClick={() => updateTaskStage(task.id, 'DEPRIORITIZED')}
              title="Move to Deprioritized"
            >
              ⬇
            </button>
          )}

          {effectiveCanDelete && (
            <button
              className="card-delete-button"
              onClick={() => deleteTask(task.id)}
              title="Delete Task"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
