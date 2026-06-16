import React from 'react';
import TaskModal from './TaskModal';
import ConflictModal from './ConflictModal';
import { STAGE_LIST } from '../constants/stages';
import { hierarchyUtils } from '../utils/hierarchyUtils';
import { resolvePriorityLabel, resolvePriorityTitle, resolveModalTitle } from '../registry/verticalRegistry';
import { IconUpload } from './Icons';

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
  setConfirmDialog,
  onSubmissionReview,
  openSubmissionModal
}) => {
  const handleClose = () => {
    setIsModalOpen(false);
    setEditingTask(null);
  };

  return (
    <>
      <TaskModal
        isOpen={isModalOpen}
        onClose={handleClose}
        title={resolveModalTitle(editingTask?.verticalId || activeVertical, !!(editingTask && editingTask.id))}
      >
        {TaskFormComponent ? (
          <TaskFormComponent
            initialData={editingTask}
            onUploadProof={() => openSubmissionModal(editingTask)}
            onSubmit={handleSaveTask}
            onCancel={handleClose}
            loading={saving}
            currentUser={user}
            permissions={permissions}
            onSubmissionStatusUpdate={onSubmissionReview}
            activeVertical={activeVertical}
            availableTasks={(tasks || []).filter(t => {
              if (t.verticalId !== (rootVerticalId || activeVertical)) return false;
              if (!(editingTask && editingTask.id)) return true;
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
            <div className="form-group u-mt-4">
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
                    if (!(editingTask && editingTask.id)) return true;
                    if (t.id === editingTask.id) return false;
                    return !hierarchyUtils.detectCycle(tasks || [], editingTask.id, t.id, 'id', 'parentTask');
                  })
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.text}</option>
                  ))
                }
              </select>
            </div>
            {(((editingTask && editingTask.id) && permissions.canUpdate) || (!(editingTask && editingTask.id) && permissions.canCreate)) ? (
              <button type="submit" className="halo-button u-mt-4 u-w-full u-fw-600" disabled={saving}>
                {saving ? 'Saving...' : ((editingTask && editingTask.id) ? 'Update Task' : 'Create Task')}
              </button>
            ) : (
              <button type="button" className="halo-button close-read-only-btn u-mt-4 u-w-full u-fw-600 u-opacity-60" onClick={handleClose}>
                Close (Read Only)
              </button>
            )}
          </form>
        )}
      </TaskModal>

      <ConflictModal
        isOpen={!!mergeTaskCluster}
        onClose={() => setMergeTaskCluster(null)}
        title="Consolidate Duplicate Tasks"
        description={`We found ${mergeTaskCluster?.length} identical tasks. Select one to keep as the primary record; the others will be moved to Deferred.`}
        conflicts={mergeTaskCluster || []}
        strategy="PICK_ONE"
        entityName="Tasks"
        onResolve={(selection) => executeMerge(selection[0].id)}
        renderConflictTile={(task) => {
          const stageInfo = STAGE_LIST.find(s => s.id === task.stageId);
          return (
            <div className="merge-body">
              <span className="merge-stage-tag badge-viewer" style={{ border: `1px solid ${stageInfo?.color}`, color: stageInfo?.color }}>
                {stageInfo?.label || task.stageId}
              </span>
              <p className="merge-summary">{task.text}</p>
              <div className="merge-meta">
                <span>{resolvePriorityTitle(task.verticalId)}: {resolvePriorityLabel(task.priority, task.verticalId)}</span>
                {task.city && <span className="u-ml-8">City: {task.city}</span>}
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
              type="button"
              className="halo-button confirm-btn u-fw-700"
              onClick={confirmDialog.onConfirm}
              disabled={saving}
            >
              {saving ? 'Working...' : 'Confirm'}
            </button>
            <button
              type="button"
              className="halo-button cancel-btn u-fw-600 u-opacity-60"
              onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
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
