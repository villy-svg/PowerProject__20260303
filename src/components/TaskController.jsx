import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import TaskModal from './TaskModal';
import './TaskController.css';

/**
 * TaskController Component
 * Functional engine of the workspace.
 * Supabase Update: Integrated async handling for Cloud CRUD operations.
 */
const TaskController = ({ 
  activeVertical, 
  tasks = [], 
  setTasks,
  updateTask,
  deleteTask, 
  updateTaskStage,
  TaskFormComponent, 
  TaskTileComponent, // New prop for custom tile rendering
  user = {},
  permissions = {} 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // Track task being edited
  const [saving, setSaving] = useState(false);

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
   * handleSaveTask
   * Combined handler for both Add and Edit operations.
   */
  const handleSaveTask = async (formData) => {
    const isEditing = !!editingTask;
    if (isEditing && !canUserUpdate) return;
    if (!isEditing && !canUserCreate) return;
    
    setSaving(true);
    
    try {
      if (isEditing) {
        // Full update
        const updatedData = { ...editingTask, ...formData };
        await updateTask(updatedData);
      } else {
        // Create new
        const newTask = {
          ...createInitialTask(formData.text, activeVertical),
          ...formData
        };
        await setTasks(newTask);
      }
      setIsModalOpen(false);
      setEditingTask(null);
    } catch (err) {
      console.error("Cloud Sync Error:", err);
      alert(`Failed to save task: ${err.message || err.details || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  return (
    <div className="task-controller">
      {canUserCreate && (
        <div className="task-controller-header">
          <button 
            className="halo-button add-task-btn" 
            onClick={openAddModal}
          >
            + Add Task
          </button>
        </div>
      )}

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        title={editingTask ? `Edit Task` : `Add New ${activeVertical.replace('_', ' ')} Task`}
      >
        {TaskFormComponent ? (
          <TaskFormComponent 
            initialData={editingTask} 
            onSubmit={handleSaveTask} 
            loading={saving} 
          />
        ) : (
          <form className="simple-task-form" onSubmit={(e) => {
            e.preventDefault();
            const text = e.target.elements.taskText.value;
            if (text) handleSaveTask({ text });
          }}>
            <div className="form-group">
              <label>Task Details</label>
              <input 
                name="taskText" 
                type="text" 
                placeholder="What needs to be done?" 
                defaultValue={editingTask?.text || ''}
                required 
              />
            </div>
            <button type="submit" className="halo-button" style={{ marginTop: '1rem', width: '100%' }} disabled={saving}>
              {saving ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
            </button>
          </form>
        )}
      </TaskModal>

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
                    className="task-card-container"
                  >
                    {TaskTileComponent ? (
                      <TaskTileComponent 
                        task={task} 
                        stage={stage}
                        canUpdate={canUserUpdate}
                        canDelete={canUserDelete}
                        updateTaskStage={updateTaskStage}
                        deleteTask={deleteTask}
                        openEditModal={openEditModal}
                        STAGE_LIST={STAGE_LIST}
                      />
                    ) : (
                      <div className="task-card" style={{ '--task-stage-color': stage.color }}>
                        <div className="task-card-header">
                          <span className="task-text">{task.text}</span>
                          
                          <div className="task-card-actions">
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
                    )}
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