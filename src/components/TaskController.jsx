import React, { useState, useEffect } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { createInitialTask } from '../constants/taskSchema';
import TaskModal from './TaskModal';
import TaskCard from './TaskCard';
import TaskListView from './TaskListView';
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
import { supabase } from '../services/core/supabaseClient';
import MasterPageHeader from './MasterPageHeader';
import ConflictModal from './ConflictModal';
import { useDuplicateDetection } from '../hooks/useDuplicateDetection';
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
  TaskTileComponent,
  label, // For dynamic title
  handleFilterChange, // For filter updates
  resetFilters, // For filter resets
  filters = { city: [], hub: [], priority: [], function: [] },
  user = {},
  permissions = {},
  rootVerticalId // New prop
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(`powerpod_task_view_${activeVertical}`) || localStorage.getItem('powerpod_task_view') || 'list');
  const [showDeprioritized, setShowDeprioritized] = useState(true);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Custom Confirmation Modal State
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  useEffect(() => {
    localStorage.setItem(`powerpod_task_view_${activeVertical}`, viewMode);
  }, [viewMode, activeVertical]);

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
              await deleteTask(id);
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
   * MASTER-SLAVE: Unified Duplicate Detection
   */
  const tasksWithDuplicateInfo = useDuplicateDetection(tasks, {
    fields: ['text', 'priority', 'hub_id', 'function'],
    activeVertical: rootVerticalId || activeVertical,
    sortByDuplicates: true
  });

  /**
   * FILTER LOGIC
   */
  const filteredTasks = tasksWithDuplicateInfo.filter(t => {
    // 1. Duplicates Only filter
    if (filters.duplicatesOnly && !t.isDuplicate) return false;

    // 2. Metadata filters (Only apply if the filter array is not empty)
    if (filters.city?.length > 0 && !filters.city.includes(t.city)) return false;
    if (filters.hub?.length > 0 && !filters.hub.includes(t.hub_id)) return false;
    if (filters.priority?.length > 0 && !filters.priority.includes(t.priority)) return false;
    if (filters.function?.length > 0 && !filters.function.includes(t.function)) return false;
    if (filters.assignee?.length > 0 && !filters.assignee.includes(t.assigneeName || 'Unassigned')) return false;
    return true;
  });

  const [mergeTaskCluster, setMergeTaskCluster] = useState(null);

  /**
   * PERMISSION LOGIC
   * Resolves feature-specific CRUD flags (e.g. canCreateClientTasks)
   * Falls back to vertical-level flags if feature-specific ones are missing.
   */
  const featureBaseName = activeVertical.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  const fCanCreate = permissions[`canCreate${featureBaseName}`] ?? permissions.canCreate;
  const fCanUpdate = permissions[`canUpdate${featureBaseName}`] ?? permissions.canUpdate;
  const fCanDelete = permissions[`canDelete${featureBaseName}`] ?? permissions.canDelete;

  const canUserCreate = fCanCreate && 
    (permissions.scope === 'global' || (Array.isArray(user?.assignedVerticals) && user.assignedVerticals.includes(activeVertical.toUpperCase()) || user.assignedVerticals.includes(activeVertical)));

  const canUserUpdate = fCanUpdate && 
    (permissions.scope === 'global' || (Array.isArray(user?.assignedVerticals) && user.assignedVerticals.includes(activeVertical.toUpperCase()) || user.assignedVerticals.includes(activeVertical)));

  const canUserDelete = fCanDelete && 
    (permissions.scope === 'global' || (Array.isArray(user?.assignedVerticals) && user.assignedVerticals.includes(activeVertical.toUpperCase()) || user.assignedVerticals.includes(activeVertical)));

  // Debugging log for permission issues
  if (!canUserUpdate && permissions.scope !== 'none') {
    console.warn(`User ${user?.full_name} lacks update permission for ${activeVertical}. Scope: ${permissions.scope}, Assigned:`, user?.assignedVerticals);
  }

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
          ...createInitialTask(formData.text, rootVerticalId || activeVertical),
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

  const handleDuplicateMergeTrigger = (duplicateTask) => {
    // Opens edit modal for the duplicate task so the user can review/merge manually
    openEditModal(duplicateTask);
  };

  const executeMerge = async (primaryTaskId) => {
    const primaryTask = tasks.find(t => t.id === primaryTaskId);
    if (!primaryTask) return;
    const duplicates = tasks.filter(t =>
      t.id !== primaryTaskId &&
      t.text === primaryTask.text &&
      t.priority === primaryTask.priority &&
      t.verticalId === primaryTask.verticalId
    );
    if (duplicates.length === 0) return;
    try {
      await bulkUpdateTasks(duplicates.map(t => t.id), { stageid: 'DEPRIORITIZED' });
      setMergeTaskCluster(null);
    } catch (err) {
      console.error('Merge failed:', err);
      alert('Failed to merge duplicate tasks.');
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
          await deleteTask(taskId);
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
    const targetVerticalId = rootVerticalId || activeVertical;
    const verticalTasks = (tasks || []).filter(t => t.verticalId === targetVerticalId && t.stageId !== 'DEPRIORITIZED');
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
        title={`${(label === 'Hubs' || label === 'Hub' || label === 'Hubs List') ? 'Hub Task Board' : label === 'Daily Task Board' ? 'Daily Task Board' : (label || 'Hub') + ' Task Manager'}`}
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
            {(activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks') && (
              <>
                <TaskCSVDownload className="master-action-btn" data={(tasks || []).filter(t => activeVertical === 'daily_hub_tasks' || t.verticalId === (rootVerticalId || activeVertical))} label="Export Tasks" />
                <TaskCSVDownload className="master-action-btn" isTemplate label="Download Template" />
                <TaskCSVImport className="master-action-btn" verticalId={activeVertical} onImportComplete={() => refreshTasks(false)} />
              </>
            )}
            {canUserCreate && !activeVertical.includes('daily') && (
              <button 
                className="halo-button master-action-btn" 
                onClick={openAddModal}
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

      {/* Unified Duplicate Merge Modal */}
      <ConflictModal
        isOpen={!!mergeTaskCluster}
        onClose={() => setMergeTaskCluster(null)}
        title="Consolidate Duplicate Tasks"
        description={`We found ${mergeTaskCluster?.length} identical tasks. Select one to keep as the primary record; the others will be moved to Deprioritized.`}
        conflicts={mergeTaskCluster || []}
        strategy="PICK_ONE"
        entityName="Tasks"
        onResolve={(selection) => executeMerge(selection[0].id)}
        renderConflictTile={(task) => {
          const stageInfo = STAGE_LIST.find(s => s.id === task.stageId);
          return (
            <div className="merge-body">
              <span className="merge-stage-tag" style={{ border: `1px solid ${stageInfo?.color}`, color: stageInfo?.color, padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                {stageInfo?.label || task.stageId}
              </span>
              <p className="merge-summary" style={{ margin: '8px 0', fontSize: '0.9rem' }}>{task.text}</p>
              <div className="merge-meta" style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                <span>Priority: {task.priority}</span>
                {task.city && <span style={{ marginLeft: '8px' }}>City: {task.city}</span>}
              </div>
            </div>
          );
        }}
      />

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
              const getPriorityWeight = (p) => {
                if (!p) return 0;
                const lowerP = p.toLowerCase();
                if (lowerP === 'high') return 3;
                if (lowerP === 'medium') return 2;
                if (lowerP === 'low') return 1;
                return 0;
              };

              const stageTasks = filteredTasks
                .filter((t) => t.verticalId === (rootVerticalId || activeVertical) && t.stageId === stage.id)
                .sort((a, b) => {
                  const weightA = getPriorityWeight(a.priority);
                  const weightB = getPriorityWeight(b.priority);
                  if (weightA !== weightB) return weightB - weightA;
                  
                  // Secondary: Duplicates together
                  if (a.isDuplicate && !b.isDuplicate) return -1;
                  if (!a.isDuplicate && b.isDuplicate) return 1;
                  
                  // Tertiary: Hub codes (alphabetical)
                  const hubA = a.hub_code || '';
                  const hubB = b.hub_code || '';
                  if (hubA !== hubB) return hubA.localeCompare(hubB);
                  
                  // Quaternary: Function codes (alphabetical)
                  const funcA = a.function || '';
                  const funcB = b.function || '';
                  if (funcA !== funcB) return funcA.localeCompare(funcB);
                  
                  return 0;
                });
              
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
            activeVertical={rootVerticalId || activeVertical}
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