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
  TaskTileComponent // To render vertical-specific metadata
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
            return pA - pB;
          });

        if (stageTasks.length === 0) return null;

        return (
          <section key={stage.id} className="list-stage-section">
            <header className="list-stage-header">
              <h4 style={{ color: stage.color }}>{stage.label}</h4>
              <span className="task-count-badge" style={{ backgroundColor: `${stage.color}22`, color: stage.color }}>
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
                    className="list-task-row"
                    onDoubleClick={() => canUpdate && openEditModal(task)}
                    style={{ '--stage-color': stage.color }}
                  >
                    {/* Left: Metadata */}
                    <div className="list-row-meta">
                      {task.priority && (
                        <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
                          {task.priority}
                        </span>
                      )}
                      {TaskTileComponent && (
                        <TaskTileComponent task={task} stage={stage} />
                      )}
                    </div>

                    {/* Center: Summary */}
                    <div className="list-row-content" title={task.text}>
                      {task.text}
                    </div>

                    {/* Right: Controls */}
                    <div className="list-row-controls">
                      <div className="list-nav-group">
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
