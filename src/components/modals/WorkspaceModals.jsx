import React from 'react';
import TaskActionModals from './TaskActionModals';
import SubmissionModal from './SubmissionModal';
import RejectionModal from './RejectionModal';
import { resolveVerticalComponents } from '../../registry/verticalRegistry';

/**
 * WorkspaceModals Component
 * Combines the three common task interaction modals (Action, Submission, Rejection)
 * into a single unified entry component to remove rendering boilerplate and local state clutter.
 */
const WorkspaceModals = ({
  isModalOpen,
  setIsModalOpen,
  editingTask,
  setEditingTask,
  saving,
  user,
  permissions = {},
  tasks = [],
  verticals = {},
  handleSaveTask,
  updateTaskStage,
  fetchTasks,
  
  submissionTask,
  closeSubmissionModal,
  openSubmissionModal,
  
  rejectionModalState,
  setRejectionModalState,
  submitRejection,
  
  mergeTaskCluster,
  setMergeTaskCluster,
  executeMerge,
  confirmDialog,
  setConfirmDialog,
  
  // Optional vertical overrides passed by TaskController
  activeVertical,
  rootVerticalId,
  TaskFormComponent
}) => {
  const resolvedActiveVertical = activeVertical || editingTask?.verticalId || 'CHARGING_HUBS';
  const resolvedRootVerticalId = rootVerticalId || editingTask?.verticalId || resolvedActiveVertical;
  const resolvedTaskFormComponent = TaskFormComponent || (editingTask?.verticalId ? resolveVerticalComponents(editingTask.verticalId, verticals).TaskFormComponent : null);
  const resolvedPermissions = resolvedActiveVertical === 'escalation_tasks'
    ? { ...permissions, canCreate: true, canUpdate: true, level: 'admin', canCreateEscalationTasks: true }
    : permissions;

  return (
    <>
      <TaskActionModals
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        saving={saving}
        activeVertical={resolvedActiveVertical}
        TaskFormComponent={resolvedTaskFormComponent}
        handleSaveTask={handleSaveTask}
        user={user}
        permissions={resolvedPermissions}
        tasks={tasks}
        rootVerticalId={resolvedRootVerticalId}
        mergeTaskCluster={mergeTaskCluster}
        setMergeTaskCluster={setMergeTaskCluster}
        executeMerge={executeMerge}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        onSubmissionReview={(subId, status) => {
          if (status === 'rejected' && editingTask) {
            updateTaskStage(editingTask.id, 'IN_PROGRESS');
          } else if (status === 'approved' && editingTask) {
            updateTaskStage(editingTask.id, 'COMPLETED');
          }
          setIsModalOpen(false);
          setEditingTask(null);
          if (fetchTasks) fetchTasks(false);
        }}
        openSubmissionModal={openSubmissionModal}
      />

      <SubmissionModal
        isOpen={!!submissionTask}
        onClose={closeSubmissionModal}
        task={submissionTask}
        user={user}
        onSubmitSuccess={(result) => {
          const taskId = submissionTask.id;
          closeSubmissionModal();
          updateTaskStage(taskId, 'REVIEW');
          if (fetchTasks) fetchTasks(false);
        }}
      />

      <RejectionModal
        isOpen={!!rejectionModalState?.isOpen}
        onClose={() => setRejectionModalState({ isOpen: false, taskId: null, submissionId: null, taskText: '' })}
        task={{ text: rejectionModalState?.taskText || '' }}
        onSubmit={submitRejection}
      />
    </>
  );
};

export default WorkspaceModals;
