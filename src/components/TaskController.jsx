import React, { useState, useEffect } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import TaskModal from './TaskModal';
import TaskCard from './TaskCard';
import TaskListView from './TaskListView';
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
import { supabase } from '../services/supabaseClient';
import MasterPageHeader from './MasterPageHeader';
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
  actualSetTasks,
  refreshTasks,
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

  // Custom Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Persist view mode choice
  useEffect(() => {
    localStorage.setItem('powerpod_task_view', viewMode);
  }, [viewMode]);

  const clearSelection = () => setSelectedTaskIds([]);
  const toggleTaskSelection = (taskId) => {
    setSelectedTaskIds(prev => prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]);
  };

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
    
    if (action === 'delete') {
      setConfirmDialog({
        isOpen: true,
        title: 'Confirm Bulk Delete',
        message: `Are you sure you want to permanently delete these ${selectedTaskIds.length} tasks? This cannot be undone.`,
        onConfirm: async () => {
          setSaving(true);
          try {
            for (const id of selectedTaskIds) {
              const { error } = await supabase.from('tasks').delete().eq('id', id);
              if (error) throw error;
            }
            actualSetTasks(prev => prev.filter(t => !selectedTaskIds.includes(t.id)));
            clearSelection();
          } catch (err) {
            console.error("Bulk Delete Failed:", err);
            alert("Some tasks could not be deleted.");
          } finally {
            setSaving(false);
            setConfirmDialog({ ...confirmDialog, isOpen: false });
          }
        }
      });
    } else if (action === 'deprio') {
      await bulkUpdateTasks(selectedTaskIds, { stageid: 'DEPRIORITIZED' });
      clearSelection();
    } else if (action === 'restore') {
      await bulkUpdateTasks(selectedTaskIds, { stageid: 'BACKLOG' });
      clearSelection();
    } else if (action === 'forward' || action === 'backward') {
      if (!sameStage) return;
      const currentIndex = STAGE_LIST.findIndex(s => s.id === commonStageId);
      let newIndex = currentIndex;
      if (action === 'forward' && currentIndex < STAGE_LIST.length - 1) newIndex++;
      if (action === 'backward' && currentIndex > 0) newIndex--;
      
      if (newIndex !== currentIndex) {
        await bulkUpdateTasks(selectedTaskIds, { stageid: STAGE_LIST[newIndex].id });
      }
      clearSelection();
    }
  };

  /**
   * DUPLICATE DETECTION & SORTING LOGIC
   * Hierarchy:
   * 1. Priority (Urgent -> High -> Medium -> Low)
   * 2. Updated At (Most recent first)
   * 3. Adjacency (Duplicate clusters together)
   */
  const tasksWithDuplicateInfo = React.useMemo(() => {
    const clusters = {};
    const clusterMaxDates = {};
    (tasks || []).forEach(t => {
      if (t.stageId !== 'DEPRIORITIZED') {
        const key = `${t.priority || ''}|${t.hub_id || ''}|${t.function || ''}|${t.text || ''}`.toLowerCase();
        
        // Populate clusters
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(t.id);

        // Track max date
        const tDate = new Date(t.updatedAt || t.createdat).getTime();
        if (!clusterMaxDates[key] || tDate > clusterMaxDates[key]) {
          clusterMaxDates[key] = tDate;
        }
      }
    });

    const baseTasks = (tasks || []).map(t => {
      const isDeprioritized = t.stageId === 'DEPRIORITIZED';
      const key = `${t.priority || ''}|${t.hub_id || ''}|${t.function || ''}|${t.text || ''}`.toLowerCase();
      const cluster = clusters[key] || [];
      const isDuplicate = !isDeprioritized && cluster.length > 1;
      
      return { 
        ...t, 
        duplicateKey: key,
        isDuplicate,
        duplicateCount: isDeprioritized ? 0 : cluster.length,
        isFirstInCluster: !isDeprioritized && cluster[0] === t.id,
        duplicateGroup: isDeprioritized ? [] : cluster,
        clusterMaxDate: clusterMaxDates[key] || new Date(t.updatedAt || t.createdat).getTime()
      };
    });

    const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    return baseTasks.sort((a, b) => {
      // 1. Priority
      const pA = priorityOrder[a.priority] ?? 99;
      const pB = priorityOrder[b.priority] ?? 99;
      if (pA !== pB) return pA - pB;

      // 2. Cluster Recency (Group adjacency)
      // Members of the same cluster have identical clusterMaxDate
      if (a.clusterMaxDate !== b.clusterMaxDate) {
        return b.clusterMaxDate - a.clusterMaxDate;
      }

      // 3. Adjacency tie-breaker
      if (a.duplicateKey !== b.duplicateKey) {
        return a.duplicateKey.localeCompare(b.duplicateKey);
      }
      
      // Keep original order within clusters
      return 0;
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
    // Strictly filter cluster to NON-deprioritized tasks only
    const clusterTasks = tasksWithDuplicateInfo.filter(t => 
      t.duplicateKey === task.duplicateKey && t.stageId !== 'DEPRIORITIZED'
    );
    setMergeTaskCluster(clusterTasks);
  };

  const executeMerge = async (primaryTaskId) => {
    if (!mergeTaskCluster) return;
    const clonesToDeprio = mergeTaskCluster.filter(t => t.id !== primaryTaskId).map(t => t.id);
    
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Consolidation',
      message: `Proceed with merge? ${clonesToDeprio.length} duplicate records will be moved to Deprioritized.`,
      onConfirm: async () => {
        setSaving(true);
        try {
          // Update clones to DEPRIORITIZED instead of deleting
          await bulkUpdateTasks(clonesToDeprio, { stageid: 'DEPRIORITIZED' });
          setMergeTaskCluster(null);
        } catch (err) {
          console.error("Merge Failed:", err);
          alert("Consolidation failed. Please try again.");
        } finally {
          setSaving(false);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
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

  const handleSingleDelete = (taskId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Delete',
      message: 'Are you sure you want to permanently delete this task?',
      onConfirm: async () => {
        setSaving(true);
        try {
          const { error } = await supabase.from('tasks').delete().eq('id', taskId);
          if (error) throw error;
          setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err) {
          alert("Delete failed.");
        } finally {
          setSaving(false);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
  };

  /**
   * handleClearBoard
   * Moves all tasks in this vertical (except deprioritized ones) to DEPRIORITIZED stage.
   */
  const handleClearBoard = async () => {
    const verticalTasks = (tasks || []).filter(t => t.verticalId === activeVertical && t.stageId !== 'DEPRIORITIZED');
    if (verticalTasks.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Clear Board',
      message: `Move all ${verticalTasks.length} active tasks to Deprioritized?`,
      onConfirm: async () => {
        setSaving(true);
        try {
          await bulkUpdateTasks(verticalTasks.map(t => t.id), { stageid: 'DEPRIORITIZED' });
        } catch (err) {
          alert("Failed to clear board.");
        } finally {
          setSaving(false);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      }
    });
  };

  const toggleStageSelection = (stageId, stageTasks) => {
    const stageTaskIds = stageTasks.map(t => t.id);
    const allInStageSelected = stageTaskIds.every(id => selectedTaskIds.includes(id));
    
    if (allInStageSelected) {
      // Deselect all in stage
      setSelectedTaskIds(prev => prev.filter(id => !stageTaskIds.includes(id)));
    } else {
      // Select all in stage
      setSelectedTaskIds(prev => [...new Set([...prev, ...stageTaskIds])]);
    }
  };

  return (
    <div className="task-controller">
      <MasterPageHeader
        title="Hub Task Manager"
        description="Unified workspace for overseeing charging hub maintenance, infrastructure upgrades, and operational tasks."
        leftActions={
          <>
            <div className="view-mode-toggle">
              <button 
                className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
                style={{ fontWeight: viewMode === 'kanban' ? 600 : 400 }}
              >
                Kanban
              </button>
              <button 
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                style={{ fontWeight: viewMode === 'list' ? 600 : 400 }}
              >
                List
              </button>
            </div>

            <button 
              className={`halo-button toggle-depri-btn ${!showDeprioritized ? 'active' : ''}`}
              onClick={() => setShowDeprioritized(!showDeprioritized)}
              title={showDeprioritized ? "Hide Deprioritized" : "Show Deprioritized"}
              style={{ fontWeight: 600, textDecoration: showDeprioritized ? 'none' : 'line-through' }}
            >
              DEPR
            </button>

            {permissions.roleId === 'master_admin' && (
              <button 
                className="halo-button clear-board-btn" 
                onClick={handleClearBoard}
                disabled={saving}
                title="Move all active tasks to Deprioritized"
                style={{ fontWeight: 600 }}
              >
                Clear Board
              </button>
            )}
          </>
        }
        rightActions={
          <>
            {activeVertical === 'CHARGING_HUBS' && (
              <>
                <TaskCSVDownload className="add-hub-main-btn" data={(tasks || []).filter(t => t.verticalId === activeVertical)} label="Export Tasks" />
                <TaskCSVDownload className="add-hub-main-btn" isTemplate label="Download Template" />
                <TaskCSVImport className="add-hub-main-btn" verticalId={activeVertical} onImportComplete={() => refreshTasks(false)} />
              </>
            )}
            {canUserCreate && (
              <button 
                className="halo-button add-task-btn add-hub-main-btn" 
                onClick={openAddModal}
                style={{ fontWeight: 600 }}
              >
                + Add Task
              </button>
            )}
          </>
        }
      />

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
            <button type="submit" className="halo-button" style={{ marginTop: '1rem', width: '100%', fontWeight: 600 }} disabled={saving}>
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
          <p className="merge-intro">We found {mergeTaskCluster?.length} identical tasks. Select one to keep as the primary record; the others will be moved to Deprioritized.</p>
          <div className="merge-grid">
            {mergeTaskCluster?.slice(0, 3).map((task, idx) => {
              const stageInfo = STAGE_LIST.find(s => s.id === task.stageId);
              return (
                <div key={task.id} className="merge-option-card">
                  <div className="merge-header">
                    <span className="merge-label">Record #{idx + 1}</span>
                    <span 
                      className="merge-stage-tag"
                      style={{ 
                        backgroundColor: `${stageInfo?.color}22`, 
                        color: stageInfo?.color,
                        border: `1px solid ${stageInfo?.color}44`
                      }}
                    >
                      {stageInfo?.label || task.stageId}
                    </span>
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
                    style={{ fontWeight: 600 }}
                  >
                    Keep This One
                  </button>
                </div>
              );
            })}
          </div>
          {mergeTaskCluster?.length > 3 && (
            <p className="merge-footer-info">+ {mergeTaskCluster.length - 3} more clones will also be deprioritized.</p>
          )}
        </div>
      </TaskModal>

      {/* Custom Confirmation Modal */}
      <TaskModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        title={confirmDialog.title}
      >
        <div className="confirm-modal-body">
          <p className="confirm-message">{confirmDialog.message}</p>
          <div className="confirm-actions">
            <button 
              className="halo-button confirm-btn" 
              onClick={confirmDialog.onConfirm}
              disabled={saving}
              style={{ fontWeight: 700 }}
            >
              {saving ? 'Working...' : 'Confirm'}
            </button>
            <button 
              className="halo-button cancel-btn" 
              onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
              style={{ opacity: 0.6, fontWeight: 600 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </TaskModal>

      <div className="workspace-main-view">
        {viewMode === 'kanban' ? (
          <div className="kanban-board">
            {STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED').map((stage) => {
              const stageTasks = filteredTasks
                .filter((t) => t.verticalId === activeVertical && t.stageId === stage.id);
              
              const allSelected = stageTasks.length > 0 && stageTasks.every(t => selectedTaskIds.includes(t.id));

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
                      <h4 style={{ fontWeight: 700 }}>{stage.label}</h4>
                      {(stage.id === 'DEPRIORITIZED' || stage.id === 'COMPLETED') && stageTasks.length > 0 && (
                        <button 
                          onClick={() => toggleStageSelection(stage.id, stageTasks)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            color: 'var(--brand-green)', 
                            fontSize: '0.65rem', 
                            fontWeight: 600, 
                            cursor: 'pointer',
                            padding: '0 8px',
                            marginLeft: '4px',
                            height: '100%',
                            opacity: 0.8
                          }}
                        >
                          {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
                        </button>
                      )}
                    </div>
                    <span 
                      className="task-count-badge"
                      style={{ backgroundColor: `${stage.color}22`, color: stage.color, fontWeight: 700 }}
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
                          deleteTask={handleSingleDelete}
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
            deleteTask={handleSingleDelete}
            openEditModal={openEditModal}
            onDuplicateMerge={handleDuplicateMergeTrigger}
            TaskTileComponent={TaskTileComponent}
            selectedTaskIds={selectedTaskIds}
            onSelect={toggleTaskSelection}
            onToggleStageSelection={toggleStageSelection}
          />
        )}
      </div>

      {selectedTaskIds.length > 0 && (
        <div className="bulk-action-bar active">
          <div className="bulk-info">
            <span className="selection-count">{selectedTaskIds.length} tasks selected</span>
          </div>

          <div className="bulk-actions">
            {canUserUpdate && sameStage && commonStageId !== STAGE_LIST[0].id && (
              <button
                className="bulk-btn"
                onClick={() => handleBulkAction('backward')}
                title="Move Backward"
              >
                ← Prev
              </button>
            )}

            {canUserUpdate && sameStage && commonStageId !== STAGE_LIST[STAGE_LIST.length - 1].id && (
              <button
                className="bulk-btn"
                onClick={() => handleBulkAction('forward')}
                title="Move Forward"
              >
                Next →
              </button>
            )}

            {canUserUpdate && commonStageId !== 'DEPRIORITIZED' && (
              <button
                className="bulk-btn deprio"
                onClick={() => handleBulkAction('deprio')}
                title="Deprioritize Selection"
              >
                ⬇ Deprio
              </button>
            )}

            {canUserUpdate && commonStageId === 'DEPRIORITIZED' && (
              <button
                className="bulk-btn restore"
                onClick={() => handleBulkAction('restore')}
                title="Restore to Pending"
              >
                ⬆ Restore
              </button>
            )}

            {canUserDelete && (
              <button
                className="bulk-btn delete"
                onClick={() => handleBulkAction('delete')}
                title="Delete Permanently"
              >
                × Delete
              </button>
            )}

            <button className="bulk-btn cancel" onClick={clearSelection}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskController;