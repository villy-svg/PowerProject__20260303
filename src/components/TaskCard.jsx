import React from 'react';
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
  onDuplicateMerge,
  STAGE_LIST,
  isSelected = false,
  onSelect,
  children // Vertical-specific metadata
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

  return (
    <div 
      className={`task-card-master ${task.isDuplicate && task.isFirstInCluster ? 'is-duplicate-stacked' : ''} ${isSelected ? 'selected' : ''}`} 
      onDoubleClick={() => {
        if (task.isDuplicate) {
          onDuplicateMerge(task);
        } else if (canUpdate) {
          openEditModal(task);
        }
      }}
      style={{ 
        borderLeft: `4px solid ${stage?.color || 'var(--border-color)'}`,
        '--stage-color': stage?.color || 'var(--brand-green)'
      }}
    >
      <div className="task-selection-area" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
          {isSelected && '✓'}
        </div>
      </div>
      {/* Row 1: Metadata (Priority + Custom Children) */}
      <div className="card-row-1">
        {task.priority && (
          <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
            {task.priority}
          </span>
        )}
        {task.isDuplicate && (
          <span className="duplicate-badge" title={`${task.duplicateCount} identical tasks found`}>
            DUPLICATE ({task.duplicateCount})
          </span>
        )}
        {children}
      </div>

      {/* Row 2: Title */}
      <div className="card-row-2">
        <span className="card-task-name" title={task.text}>{task.text}</span>
      </div>

      {/* Row 3: Controls */}
      <div className="card-row-3">
        <div className="card-navigation">
          {canUpdate && (
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
          {canUpdate && (
            <button 
              className="card-edit-button" 
              onClick={() => openEditModal(task)}
              title="Edit Task"
            >
              ✎
            </button>
          )}

          {canUpdate && task.stageId === 'DEPRIORITIZED' && (
            <button 
              className="card-reprio-button" 
              onClick={() => updateTaskStage(task.id, 'BACKLOG')}
              title="Move back to Pending"
              style={{ color: 'var(--brand-green)', fontWeight: 800 }}
            >
              ⬆
            </button>
          )}

          {canUpdate && task.stageId !== 'DEPRIORITIZED' && (
            <button 
              className="card-deprio-button" 
              onClick={() => updateTaskStage(task.id, 'DEPRIORITIZED')}
              title="Move to Deprioritized"
            >
              ⬇
            </button>
          )}

          {canDelete && (
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
