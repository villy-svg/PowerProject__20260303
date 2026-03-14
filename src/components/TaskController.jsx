import React, { useState, useEffect } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import TaskModal from './TaskModal';
import TaskCard from './TaskCard';
import TaskListView from './TaskListView';
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
import { supabase } from '../services/supabaseClient';
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
  filters = { city: '', hub: '', priority: '', function: '' },
  user = {},
  permissions = {} 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('powerpod_task_view') || 'list');
  const [showDeprioritized, setShowDeprioritized] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Persist view mode choice
  useEffect(() => {
    localStorage.setItem('powerpod_task_view', viewMode);
  }, [viewMode]);

  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const clearSelection = () => setSelectedTaskIds([]);

  // Determine stage consistency of selection
  const selectedTasks = React.useMemo(() => 
    (tasks || []).filter(t => selectedTaskIds.includes(t.id)), 
    [tasks, selectedTaskIds]
  );
  
  const sameStage = selectedTasks.length > 0 && 
    selectedTasks.every(t => t.stageId === selectedTasks[0].stageId);
  const commonStageId = sameStage ? selectedTasks[0].stageId : null;

  const handleBulkAction = async (action) => {
    if (selectedTaskIds.length === 0) return;
    
    try {
      if (action === 'delete') {
        // Single confirmation for the whole batch; deleteTask in App.jsx also confirms per-task
        // So we bypass it by deleting directly via bulkUpdateTasks workaround — or accept one prompt.
        // Here we issue ONE confirm for the whole batch:
        if (!window.confirm(`Permanently delete ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}?`)) return;
        for (const id of selectedTaskIds) {
          const { error } = await supabase.from('tasks').delete().eq('id', id);
          if (error) throw error;
        }
        setTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
      } else if (action === 'deprio') {
        await bulkUpdateTasks(selectedTaskIds, { stageid: 'DEPRIORITIZED' });
      } else if (action === 'restore') {
        await bulkUpdateTasks(selectedTaskIds, { stageid: 'BACKLOG' });
      } else if (action === 'forward' || action === 'backward') {
        if (!sameStage) return;
        const currentIndex = STAGE_LIST.findIndex(s => s.id === commonStageId);
        let newIndex = currentIndex;
        if (action === 'forward' && currentIndex < STAGE_LIST.length - 1) newIndex++;
        if (action === 'backward' && currentIndex > 0) newIndex--;
        
        if (newIndex !== currentIndex) {
          await bulkUpdateTasks(selectedTaskIds, { stageid: STAGE_LIST[newIndex].id });
        }
      }
      clearSelection();
    } catch (err) {
      console.error("Bulk Action Failed:", err);
    }
  };

  /**
   * DUPLICATE DETECTION & SORTING LOGIC
   * 1. Identifies clusters of identical tasks.
   * 2. Sorts to ensure duplicates are adjacent.
   */
  const tasksWithDuplicateInfo = React.useMemo(() => {
    const clusters = {};
    const baseTasks = (tasks || []).map(t => {
      const key = `${t.priority || ''}|${t.hub_id || ''}|${t.function || ''}|${t.text || ''}`.toLowerCase();
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(t.id);
      return { ...t, duplicateKey: key };
    });

    const enriched = baseTasks.map(t => {
      const cluster = clusters[t.duplicateKey];
      const isDuplicate = cluster.length > 1;
      return {
        ...t,
        isDuplicate,
        duplicateCount: cluster.length,
        isFirstInCluster: cluster[0] === t.id,
        duplicateGroup: cluster // List of IDs in the cluster
      };
    });

    // Enforce Duplicate Adjacency: Sort by cluster key first, then priority
    const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    return enriched.sort((a, b) => {
      // If they are in the same duplicate cluster, keep original creation order
      if (a.duplicateKey === b.duplicateKey) return 0;
      
      // If one is duplicate and other isn't, we still sort by priority mainly
      // But we use the duplicateKey as secondary sort to keep groups together
      const pA = priorityOrder[a.priority] ?? 99;
      const pB = priorityOrder[b.priority] ?? 99;
      
      if (pA !== pB) return pA - pB;
      return a.duplicateKey.localeCompare(b.duplicateKey);
    });
  }, [tasks]);

  /**
   * FILTER LOGIC
   */
  const filteredTasks = tasksWithDuplicateInfo.filter(t => {
    // 1. Duplicates Only filter
    if (filters.duplicatesOnly && !t.isDuplicate) return false;

    // 2. Metadata filters
    if (filters.city && !filters.city.includes(t.city)) return false;
    if (filters.hub && !filters.hub.includes(t.hub_id)) return false;
    if (filters.priority && !filters.priority.includes(t.priority)) return false;
    if (filters.function && !filters.function.includes(t.function)) return false;
    return true;
  });

  const [mergeTaskCluster, setMergeTaskCluster] = useState(null);

  const handleDuplicateMergeTrigger = (task) => {
    if (!task.isDuplicate) return;
    const clusterTasks = tasksWithDuplicateInfo.filter(t => t.duplicateKey === task.duplicateKey);
    setMergeTaskCluster(clusterTasks);
  };

  const executeMerge = async (primaryTaskId) => {
    if (!mergeTaskCluster) return;
    const clonesToDelete = mergeTaskCluster.filter(t => t.id !== primaryTaskId).map(t => t.id);
    
    if (window.confirm(`Merge confirmed. ${clonesToDelete.length} duplicates will be deleted. Proceed?`)) {
      setSaving(true);
      try {
        for (const id of clonesToDelete) {
          const { error } = await supabase.from('tasks').delete().eq('id', id);
          if (error) throw error;
        }
        setTasks(prev => prev.filter(t => !clonesToDelete.includes(t.id)));
        setMergeTaskCluster(null);
      } catch (err) {
        console.error("Merge Failed:", err);
        alert("Consolidation failed. Please try again.");
      } finally {
        setSaving(false);
      }
    }
  };

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
            style={{ fontWeight: 800, textDecoration: showDeprioritized ? 'none' : 'line-through' }}
          >
            DEPR
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

      {/* Duplicate Merge Modal */}
      <TaskModal
        isOpen={!!mergeTaskCluster}
        onClose={() => setMergeTaskCluster(null)}
        title="Consolidate Duplicate Tasks"
      >
        <div className="duplicate-merge-container">
          <p className="merge-intro">We found {mergeTaskCluster?.length} identical tasks. Select one to keep as the primary record; the others will be deleted.</p>
          <div className="merge-grid">
            {mergeTaskCluster?.slice(0, 3).map((task, idx) => (
              <div key={task.id} className="merge-option-card">
                <div className="merge-header">
                  <span className="merge-label">Record #{idx + 1}</span>
                  <span className="merge-stage-tag">{task.stageId}</span>
                </div>
                <div className="merge-body">
                  <p className="merge-summary">{task.text}</p>
                  <div className="merge-meta">
                    <span>Priority: {task.priority}</span>
                    {task.city && <span>City: {task.city}</span>}
                  </div>
                </div>
                <button 
                  className="halo-button merge-keep-btn" 
                  onClick={() => executeMerge(task.id)}
                  disabled={saving}
                >
                  Keep This One
                </button>
              </div>
            ))}
          </div>
          {mergeTaskCluster?.length > 3 && (
            <p className="merge-footer-info">+ {mergeTaskCluster.length - 3} more hidden clones will also be merged.</p>
          )}
        </div>
      </TaskModal>

      <div className="workspace-main-view">
        {viewMode === 'kanban' ? (
          <div className="kanban-board">
            {STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED').map((stage) => {
              const stageTasks = filteredTasks
                .filter((t) => t.verticalId === activeVertical && t.stageId === stage.id);

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
                          onDuplicateMerge={handleDuplicateMergeTrigger}
                          STAGE_LIST={STAGE_LIST}
                          isSelected={selectedTaskIds.includes(task.id)}
                          onSelect={() => toggleTaskSelection(task.id)}
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
            tasks={filteredTasks}
            stageList={STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED')}
            activeVertical={activeVertical}
            canUpdate={canUserUpdate}
            canDelete={canUserDelete}
            updateTaskStage={updateTaskStage}
            deleteTask={deleteTask}
            openEditModal={openEditModal}
            onDuplicateMerge={handleDuplicateMergeTrigger}
            TaskTileComponent={TaskTileComponent}
            selectedTaskIds={selectedTaskIds}
            onSelect={toggleTaskSelection}
          />
        )}
      </div>

      {selectedTaskIds.length > 0 && (
        <div className="bulk-action-bar">
          <div className="bulk-info">
            <span className="selection-count">{selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} selected</span>
            <button className="clear-selection-btn" onClick={clearSelection}>✕ Clear</button>
          </div>
          
          <div className="bulk-actions">
            {canUserUpdate && sameStage && (
              <>
                <button 
                  className="bulk-nav-btn" 
                  onClick={() => handleBulkAction('backward')}
                  title="Move Selected Back"
                >
                  ← Move Back
                </button>
                <button 
                  className="bulk-nav-btn" 
                  onClick={() => handleBulkAction('forward')}
                  title="Move Selected Forward"
                >
                  Move Forward →
                </button>
              </>
            )}
            
            {canUserUpdate && (
              <>
                <button 
                  className="bulk-action-btn deprio" 
                  onClick={() => handleBulkAction('deprio')}
                >
                  Deprioritize
                </button>
                <button 
                  className="bulk-action-btn restore" 
                  onClick={() => handleBulkAction('restore')}
                >
                  Restore
                </button>
              </>
            )}
            {canUserDelete && (
              <button 
                className="bulk-action-btn delete" 
                onClick={() => handleBulkAction('delete')}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskController;