import React from 'react';
import TaskActionModals from './TaskActionModals';
import SubmissionModal from './SubmissionModal';
import RejectionModal from './RejectionModal';
import { resolveVerticalComponents } from '../../registry/verticalRegistry';
import { canReviewEmployeeRequests, isEmployeeApprovalTask } from '../../services/employees/employeeRequestService';
import {
  isAttendanceClosureTask,
  canMarkAttendanceTask,
  canReviewAttendanceTask,
  isSubjectEmployeeOfAttendanceTask,
} from '../../services/employees/unmarkedAttendanceTaskService';

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
  const isSubjectAttendanceReadOnly =
    isSubjectEmployeeOfAttendanceTask(editingTask, user) && user?.roleId !== 'master_admin';
  const resolvedPermissions = isSubjectAttendanceReadOnly
    ? { ...permissions, canUpdate: false, canDelete: false }
    : resolvedActiveVertical === 'escalation_tasks'
      ? { ...permissions, canCreate: true, canUpdate: true, level: 'admin', canCreateEscalationTasks: true }
      : (
          (isEmployeeApprovalTask(editingTask) && canReviewEmployeeRequests(user)) ||
          (isAttendanceClosureTask(editingTask) && (canMarkAttendanceTask(editingTask, user) || canReviewAttendanceTask(editingTask, user)))
        )
        ? { ...permissions, canUpdate: true }
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
        onSubmissionReview={async (subId, status) => {
          const targetTaskId = editingTask?.id;
          setIsModalOpen(false);
          setEditingTask(null);
          try {
            if (status === 'rejected' && targetTaskId) {
              await updateTaskStage(targetTaskId, 'IN_PROGRESS');
            } else if (status === 'approved' && targetTaskId) {
              await updateTaskStage(targetTaskId, 'COMPLETED');
            } else if (fetchTasks) {
              // Employee approval RPCs (bank/deactivation) update stage_id server-side and call onStatusUpdate() with no arguments
              await fetchTasks(false);
            }
          } catch (err) {
            console.error('[WorkspaceModals] Failed to update task stage after submission review:', err);
            if (fetchTasks) fetchTasks(false);
          }
        }}
        openSubmissionModal={openSubmissionModal}
      />

      <SubmissionModal
        isOpen={!!submissionTask}
        onClose={closeSubmissionModal}
        task={submissionTask}
        user={user}
        onSubmitSuccess={async (result, movedToReview) => {
          const taskId = submissionTask?.id;
          closeSubmissionModal();
          try {
            // Only move stage to REVIEW when the user clicked "Submit for Review" (movedToReview === true).
            // submitProofOfWork already best-effort updates stage in DB when moveToReview is true,
            // and updateTaskStage updates local state + reconciles via fetchTasks(false).
            if (movedToReview && taskId) {
              await updateTaskStage(taskId, 'REVIEW');
            } else if (fetchTasks) {
              await fetchTasks(false);
            }
          } catch (err) {
            console.error('[WorkspaceModals] Failed to reconcile after submission:', err);
            if (fetchTasks) fetchTasks(false);
          }
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
