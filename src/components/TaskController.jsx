import React, { useState, useEffect } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import TaskModal from './TaskModal';
import TaskCard from './TaskCard';
import TaskListView from './TaskListView';
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
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
  bulkUpdateTasks,
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
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_task_view') || 'kanban');
  const [showDeprioritized, setShowDeprioritized] = useState(true);

  // Persist view mode choice
  useEffect(() => {
    localStorage.setItem('powerpod_task_view', viewMode);
  }, [viewMode]);

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

  /**
   * handleClearBoard
   * Moves all tasks in this vertical (except deprioritized ones) to DEPRIORITIZED stage.
   */
  const handleClearBoard = async () => {
    const verticalTasks = (tasks || []).filter(t => t.verticalId === activeVertical && t.stageId !== 'DEPRIORITIZED');
    if (verticalTasks.length === 0) return;

    if (window.confirm(`Move all ${verticalTasks.length} active tasks to Deprioritized?`)) {
      setSaving(true);
      try {
        await bulkUpdateTasks(verticalTasks.map(t => t.id), { stageid: 'DEPRIORITIZED' });
        alert("Board cleared successfully!");
      } catch (err) {
        alert("Failed to clear board.");
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="task-controller">
      <div className="task-controller-header">
        <div className="header-left-tools">
          <div className="view-mode-toggle">
            <button 
              className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
            >
              Kanban
            </button>
            <button 
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>

          <button 
            className={`halo-button toggle-depri-btn ${!showDeprioritized ? 'active' : ''}`}
            onClick={() => setShowDeprioritized(!showDeprioritized)}
            title={showDeprioritized ? "Hide Deprioritized" : "Show Deprioritized"}
          >
            {showDeprioritized ? 'Hide Depri.' : 'Show Depri.'}
          </button>

          {permissions.roleId === 'master_admin' && (
            <button 
              className="halo-button clear-board-btn" 
              onClick={handleClearBoard}
              disabled={saving}
              title="Move all active tasks to Deprioritized"
            >
              Clear Board
            </button>
          )}
        </div>

        <div className="header-right-tools" style={{ display: 'flex', gap: '12px' }}>
          {activeVertical === 'CHARGING_HUBS' && (
            <>
              <TaskCSVDownload data={(tasks || []).filter(t => t.verticalId === activeVertical)} label="Export Data" />
              <TaskCSVDownload isTemplate label="Download Template" />
              <TaskCSVImport verticalId={activeVertical} onImportComplete={() => {}} />
            </>
          )}
          {canUserCreate && (
            <button 
              className="halo-button add-task-btn" 
              onClick={openAddModal}
            >
              + Add Task
            </button>
          )}
        </div>
      </div>

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

      <div className="workspace-main-view">
        {viewMode === 'kanban' ? (
          <div className="kanban-board">
            {STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED').map((stage) => {
              const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
              const stageTasks = (tasks || [])
                .filter((t) => t.verticalId === activeVertical && t.stageId === stage.id)
                .sort((a, b) => {
                  const pA = priorityOrder[a.priority] ?? 99;
                  const pB = priorityOrder[b.priority] ?? 99;
                  return pA - pB;
                });

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
                        <TaskCard
                          task={task}
                          stage={stage}
                          canUpdate={canUserUpdate}
                          canDelete={canUserDelete}
                          updateTaskStage={updateTaskStage}
                          deleteTask={deleteTask}
                          openEditModal={openEditModal}
                          STAGE_LIST={STAGE_LIST}
                        >
                          {TaskTileComponent && (
                            <TaskTileComponent 
                              task={task} 
                              stage={stage}
                            />
                          )}
                        </TaskCard>
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
        ) : (
          <TaskListView 
            tasks={tasks}
            stageList={STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED')}
            activeVertical={activeVertical}
            canUpdate={canUserUpdate}
            canDelete={canUserDelete}
            updateTaskStage={updateTaskStage}
            openEditModal={openEditModal}
            TaskTileComponent={TaskTileComponent}
          />
        )}
      </div>
    </div>
  );
};

export default TaskController;