import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import './TaskController.css';

/**
 * TaskController Component
 * Functional engine of the workspace.
 * Supabase Update: Integrated async handling for Cloud CRUD operations.
 */
const TaskController = ({ 
  activeVertical, 
  tasks = [], 
  setTasks, // This is the 'addTask' async helper from App.jsx
  deleteTask, 
  updateTaskStage,
  user = {},
  permissions = {} 
}) => {
  const [newTaskText, setNewTaskText] = useState('');

  /**
   * PERMISSION LOGIC
   * Checks the capability flags against the assignedVerticals array.
   */
  const canUserCreate = permissions.canCreate && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  const canUserUpdate = permissions.canUpdate && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  const canUserDelete = permissions.canDelete && 
    (permissions.scope === 'global' || user?.assignedVerticals?.includes(activeVertical));

  /**
   * UPDATED: handleAddTask
   * Now an async function to ensure the cloud database confirms the save
   * before the UI input is cleared.
   */
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim() || !canUserCreate) return;
    
    // Create the schema-compliant task object
    const newTask = createInitialTask(newTaskText, activeVertical);
    
    try {
      // Trigger the Supabase insert helper from App.jsx
      await setTasks(newTask);
      setNewTaskText(''); 
    } catch (err) {
      console.error("Cloud Sync Error:", err);
      alert("Failed to save task to the cloud. Please check your connection.");
    }
  };

  return (
    <div className="task-controller">
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
          // const stageTasks = (tasks || []).filter(
          //   (t) => t.verticalId === activeVertical && t.stageId === stage.id
          // );
            const stageTasks = (tasks || []).filter(
              (t) => t.stageId === stage.id
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
                        {(canUserUpdate || canUserDelete) ? (
                          <>
                            {canUserUpdate && (
                              <select 
                                className="stage-select-dropdown"
                                value={task.stageId}
                                // Triggers async update in App.jsx
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
                                // Triggers async delete in App.jsx
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