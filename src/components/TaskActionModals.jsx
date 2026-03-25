import React from 'react';
import TaskModal from './TaskModal';
import ConflictModal from './ConflictModal';
import { STAGE_LIST } from '../constants/stages';
import { hierarchyUtils } from '../utils/hierarchyUtils';

/**
 * TaskActionModals Component
 * Aggregates all task-related modals into one component to reduce parent complexity.
 */
const TaskActionModals = ({
  isModalOpen,
  setIsModalOpen,
  editingTask,
  setEditingTask,
  saving,
  activeVertical,
  TaskFormComponent,
  handleSaveTask,
  user,
  permissions,
  tasks,
  rootVerticalId,
  mergeTaskCluster,
  setMergeTaskCluster,
  executeMerge,
  confirmDialog,
  setConfirmDialog
}) => {
  return (
    <>
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
        title={editingTask ? `Edit Task` : `Add New ${activeVertical?.replace('_', ' ')} Task`}
      >
        {TaskFormComponent ? (
          <TaskFormComponent
            initialData={editingTask}
            onSubmit={handleSaveTask}
            loading={saving}
            currentUser={user}
            permissions={permissions}
            availableTasks={(tasks || []).filter(t => {
              if (t.verticalId !== (rootVerticalId || activeVertical)) return false;
              if (!editingTask) return true;
              if (t.id === editingTask.id) return false;
              return !hierarchyUtils.detectCycle(tasks || [], editingTask.id, t.id, 'id', 'parentTask');
            })}
          />
        ) : (
          <form className="simple-task-form" onSubmit={(e) => {
            e.preventDefault();
            const text = e.target.elements.taskText.value;
            const parentTask = e.target.elements.parentTask?.value || null;
            if (text) handleSaveTask({ text, parentTask });
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
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label>Parent Task</label>
              <select
                name="parentTask"
                className="master-dropdown"
                defaultValue={editingTask?.parentTask || ''}
              >
                <option value="">None (Top-level)</option>
                {(tasks || [])
                  .filter(t => {
                    if (t.verticalId !== (rootVerticalId || activeVertical)) return false;
                    if (!editingTask) return true;
                    if (t.id === editingTask.id) return false;
                    return !hierarchyUtils.detectCycle(tasks || [], editingTask.id, t.id, 'id', 'parentTask');
                  })
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.text}</option>
                  ))
                }
              </select>
            </div>
            <button type="submit" className="halo-button" style={{ marginTop: '1rem', width: '100%', fontWeight: 600 }} disabled={saving}>
              {saving ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task')}
            </button>
          </form>
        )}
      </TaskModal>

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
    </>
  );
};

export default TaskActionModals;
