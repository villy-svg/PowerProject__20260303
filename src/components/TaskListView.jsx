import React from 'react';
import './TaskListView.css';

const TaskListView = ({
  tasks,
  stageList,
  activeVertical,
  canUpdate,
  canDelete,
  deleteTask,
  updateTaskStage,
  openEditModal,
  TaskTileComponent, // To render vertical-specific metadata
  selectedTaskIds = [],
  onSelect,
  onToggleStageSelection,
  onDuplicateMerge
}) => {

  const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  return (
    <div className="task-list-view">
      {stageList.map((stage) => {
        const stageTasks = tasks
          .filter(t => t.verticalId === activeVertical && t.stageId === stage.id)
          .sort((a, b) => {
            const pA = priorityOrder[a.priority] ?? 99;
            const pB = priorityOrder[b.priority] ?? 99;
            if (pA !== pB) return pA - pB;

            // Secondary: Hub codes (alphabetical)
            const hubA = a.hub_code || '';
            const hubB = b.hub_code || '';
            if (hubA !== hubB) return hubA.localeCompare(hubB);

            // Tertiary: Function codes (alphabetical)
            const funcA = a.function || '';
            const funcB = b.function || '';
            if (funcA !== funcB) return funcA.localeCompare(funcB);

            return 0;
          });

        if (stageTasks.length === 0) return null;

        return (
          <section key={stage.id} className="list-stage-section">
            <header className="list-stage-header">
              <div className="header-left-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ color: stage.color, fontWeight: 700 }}>{stage.label}</h4>
                {(stage.id === 'DEPRIORITIZED' || stage.id === 'COMPLETED') && stageTasks.length > 0 && (
                  <button
                    onClick={() => onToggleStageSelection(stage.id, stageTasks)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-green)',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '0 8px',
                      height: '100%',
                      opacity: 0.8
                    }}
                  >
                    {stageTasks.every(t => selectedTaskIds.includes(t.id)) ? 'DESELECT ALL' : 'SELECT ALL'}
                  </button>
                )}
              </div>
              <span className="task-count-badge" style={{ backgroundColor: `${stage.color}22`, color: stage.color, fontWeight: 700 }}>
                {stageTasks.length}
              </span>
            </header>

            <div className="list-task-container">
              {stageTasks.map((task) => {
                const currentIndex = stageList.findIndex(s => s.id === task.stageId);
                const canMoveLeft = currentIndex > 0;
                const canMoveRight = currentIndex < stageList.length - 1;

                const handleMove = (direction) => {
                  let newIndex = currentIndex;
                  if (direction === 'left' && canMoveLeft) newIndex--;
                  else if (direction === 'right' && canMoveRight) newIndex++;
                  if (newIndex !== currentIndex) updateTaskStage(task.id, stageList[newIndex].id);
                };

                return (
                  <div
                    key={task.id}
                    className={`list-task-row ${selectedTaskIds.includes(task.id) ? 'selected' : ''}`}
                    onDoubleClick={() => {
                      if (task.isDuplicate) {
                        onDuplicateMerge(task);
                      } else if (canUpdate) {
                        openEditModal(task);
                      }
                    }}
                    style={{ '--stage-color': stage.color }}
                  >
                    {/* LEFT SIDE: Identity & Content */}
                    <div className="list-row-main">
                      {/* 1. Select Checkbox */}
                      <div className="list-row-selection" onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}>
                        <div className={`selection-checkbox ${selectedTaskIds.includes(task.id) ? 'checked' : ''}`}>
                          {selectedTaskIds.includes(task.id) && '✓'}
                        </div>
                      </div>

                      {/* 2. Priority */}
                      {task.priority && (
                        <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
                          {task.priority}
                        </span>
                      )}

                      {/* 3. Dup Tag */}
                      {task.isDuplicate && (
                        <span className="duplicate-badge-mini" title={`${task.duplicateCount} identical tasks found`}>
                          DUP
                        </span>
                      )}
                      {task.assigneeName && (
                        <span className="assignee-badge-mini" title={`Assignee: ${task.assigneeName}`}>
                          {task.assigneeName.split(' ')[0]}
                        </span>
                      )}

                      {/* 4. Hub Code & 5. Function Code (Vertical Specific) */}
                      {TaskTileComponent && (
                        <div className="list-row-vertical-meta">
                          <TaskTileComponent task={task} stage={stage} />
                        </div>
                      )}

                      {/* 6. Task Summary */}
                      <div className="list-row-content" title={task.text}>
                        {task.text}
                      </div>
                    </div>

                    {/* RIGHT SIDE: Controls (Wrappable) */}
                    <div className="list-row-controls">
                      {canUpdate && (
                        <div className="list-nav-group">
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
                        </div>
                      )}

                      <div className="list-action-group">
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
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default TaskListView;
