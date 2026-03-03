import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import './TaskController.css';

/**
 * TaskController Component
 * Functional engine of the workspace.
 * Multi-Vertical Update: Refactored CRUD logic to use the assignedVerticals array.
 */
const TaskController = ({ 
  activeVertical, 
  tasks = [], 
  setTasks, 
  deleteTask, 
  updateTaskStage,
  user = {},
  permissions = {} 
}) => {
  const [newTaskText, setNewTaskText] = useState('');

  /**
   * REFACTORED PERMISSION LOGIC
   * Checks the capability flags against the new array structure.
   */
  const canUserCreate = permissions.canCreate && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  const canUserUpdate = permissions.canUpdate && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  const canUserDelete = permissions.canDelete && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  /**
   * Handles adding a new task
   */
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim() || !canUserCreate) return;
    
    // Create task for the specific vertical the user is currently viewing
    const newTask = createInitialTask(newTaskText, activeVertical);
    setTasks([...(tasks || []), newTask]);  
    setNewTaskText('');             
  };

  return (
    <div className="task-controller">
      {/* Create Permission Check */}
      {canUserCreate && (
        <form className="add-task-form" onSubmit={handleAddTask}>
          <input 
            type="text" 
            placeholder={`Add a new task to ${activeVertical}...`} 
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
          />
          <button type="submit">Add Task</button>
        </form>
      )}

      <div className="kanban-board">
        {STAGE_LIST.map((stage) => {
          const stageTasks = (tasks || []).filter(
            (t) => t.verticalId === activeVertical && t.stageId === stage.id
          );

          return (
            <div 
              key={stage.id} 
              className="kanban-stage-halo"
              style={{ 
                borderTop: `4px solid ${stage.color}`,
                borderColor: `${stage.color}44`,
                backgroundColor: `${stage.color}08` 
              }}
            >
              <div className="stage-header">
                <div className="header-left-group">
                  <h4>{stage.label}</h4>
                </div>
                <span 
                  className="task-count-badge"
                  style={{ backgroundColor: `${stage.color}22`, color: stage.color }}
                >
                  {stageTasks.length}
                </span>
              </div>

              <div className="task-drop-zone">
                {stageTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="task-card"
                      style={{ '--task-stage-color': stage.color }}
                    >
                        <div className="task-card-header">
                            <span className="task-text">{task.text}</span>
                            
                            <div className="task-card-actions">
                                {/* Update & Delete Permission Checks */}
                                {(canUserUpdate || canUserDelete) ? (
                                  <>
                                    {canUserUpdate && (
                                      <select 
                                        className="stage-select-dropdown"
                                        value={task.stageId}
                                        onChange={(e) => updateTaskStage(task.id, e.target.value)}
                                      >
                                        {STAGE_LIST.map(s => (
                                          <option key={s.id} value={s.id}>
                                            {s.label}
                                          </option>
                                        ))}
                                      </select>
                                    )}

                                    {canUserDelete && (
                                      <button 
                                        className="delete-task-btn" 
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete Task Permanently"
                                      >
                                      ×
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <span className="read-only-badge">Read Only</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                
                {stageTasks.length === 0 && (
                  <p className="empty-msg">No tasks yet</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskController;