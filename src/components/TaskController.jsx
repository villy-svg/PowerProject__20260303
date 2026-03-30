import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import TaskListView from './TaskListView';
import TaskKanbanView from './TaskKanbanView';
import TaskActionModals from './TaskActionModals';
import SubmissionModal from './SubmissionModal';
import TaskCSVDownload from '../verticals/ChargingHubs/TaskCSVDownload';
import TaskCSVImport from '../verticals/ChargingHubs/TaskCSVImport';
import MasterPageHeader from './MasterPageHeader';
import TaskTreeView from './TaskTreeView';
import { useTaskController } from '../hooks/useTaskController';
import { updateSubmissionStatus } from '../services/tasks/submissionService';
import RejectionModal from './RejectionModal';
import './TaskController.css';

/**
 * TaskController Component
 * Functional engine of the workspace.
 * Now refactored to use useTaskController hook for business logic.
 */
const TaskController = (props) => {
  const {
    activeVertical,
    tasks,
    refreshTasks,
    TaskFormComponent,
    TaskTileComponent,
    label,
    permissions,
    rootVerticalId,
    verticals,
    boardLabel,
    user
  } = props;

  const controller = useTaskController(props);

  const {
    isModalOpen, setIsModalOpen,
    editingTask, setEditingTask,
    saving,
    viewMode, setViewMode,
    showDeprioritized, setShowDeprioritized,
    drillDownId, setDrillDownId,
    drillPath,
    showReworkOnly, setShowReworkOnly,
    selectedTaskIds,
    clearSelection,
    toggleTaskSelection,
    sameStage, commonStageId,
    confirmDialog, setConfirmDialog,
    mergeTaskCluster, setMergeTaskCluster,
    hierarchyFilteredTasks,
    filteredTasks,
    canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy,
    handleBulkAction,
    handleInternalUpdateStage,
    handleInternalDelete,
    handleMoveToParent,
    handleSaveTask,
    executeMerge,
    handleClearBoard,
    openAddModal, openEditModal, handleAddSubtask,
    toggleStageSelection,
    canEditTask
  } = controller;

  // ─── Proof of Work Submission Modal State ────────────────────────────
  const [submissionTask, setSubmissionTask] = useState(null);
  const openSubmissionModal = (task) => setSubmissionTask(task);
  const closeSubmissionModal = () => setSubmissionTask(null);

  // ─── Proof of Work Approve / Reject State ────────────────────────────
  const [rejectionModalState, setRejectionModalState] = useState({ isOpen: false, taskId: null, submissionId: null, taskText: '' });

  const handleApproveSubmission = async (taskId, submissionId) => {
    try {
      await updateSubmissionStatus(submissionId, 'approved');
      await handleInternalUpdateStage(taskId, 'COMPLETED');
      if (props.refreshTasks) props.refreshTasks(false);
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleRejectClick = (task) => {
    if (!task.latestSubmission) return;
    setRejectionModalState({ isOpen: true, taskId: task.id, submissionId: task.latestSubmission.id, taskText: task.text });
  };

  const submitRejection = async (reason) => {
    try {
      await updateSubmissionStatus(rejectionModalState.submissionId, 'rejected', reason);
      await handleInternalUpdateStage(rejectionModalState.taskId, 'IN_PROGRESS');
      setRejectionModalState({ isOpen: false, taskId: null, submissionId: null, taskText: '' });
      if (props.refreshTasks) props.refreshTasks(false);
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  return (
    <div className="task-controller">
      <MasterPageHeader
        title={boardLabel || `${(label === 'Hubs' || label === 'Hub' || label === 'Hubs List') ? 'Hub Task Board' : (label === 'Clients' || label === 'Client') ? 'Client Task Board' : label === 'Daily Task Board' ? 'Daily Task Board' : (label || 'Hub') + ' Task Board'}`}
        description="Unified workspace for overseeing charging hub maintenance, infrastructure upgrades, and operational tasks."
        leftActions={
          <>
            <div className="view-mode-toggle">
              {['kanban', 'list', 'tree'].map((mode) => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                  style={{ fontWeight: viewMode === mode ? 600 : 400, textTransform: 'capitalize' }}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              className={`halo-button toggle-depri-btn ${!showDeprioritized ? 'active' : ''}`}
              onClick={() => setShowDeprioritized(!showDeprioritized)}
              title={showDeprioritized ? "Hide Deprioritized" : "Show Deprioritized"}
              style={{ fontWeight: 600, textDecoration: showDeprioritized ? 'none' : 'line-through' }}
            >
              DEPR
            </button>

            <button
              className={`halo-button toggle-rework-btn ${showReworkOnly ? 'active' : ''}`}
              onClick={() => setShowReworkOnly(!showReworkOnly)}
              title={showReworkOnly ? "Show All Tasks" : "Filter: Rework Required Only"}
              style={{ 
                fontWeight: 600, 
                color: showReworkOnly ? '#3b82f6' : 'var(--text-color)',
                borderColor: showReworkOnly ? '#3b82f6' : 'var(--border-color)',
                boxShadow: showReworkOnly ? '0 0 15px rgba(59, 130, 246, 0.3)' : 'none'
              }}
            >
              REWORK
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
            {(activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks') && (
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

      <TaskActionModals
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        saving={saving}
        activeVertical={activeVertical}
        TaskFormComponent={TaskFormComponent}
        handleSaveTask={handleSaveTask}
        user={props.user}
        permissions={permissions}
        tasks={tasks}
        rootVerticalId={rootVerticalId}
        mergeTaskCluster={mergeTaskCluster}
        setMergeTaskCluster={setMergeTaskCluster}
        executeMerge={executeMerge}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        onSubmissionReview={(subId, status) => {
          if (status === 'rejected' && editingTask) {
            handleInternalUpdateStage(editingTask.id, 'IN_PROGRESS');
          } else if (status === 'approved' && editingTask) {
            handleInternalUpdateStage(editingTask.id, 'COMPLETED');
          }
          // Close the edit modal so the board immediately reflects the change
          setIsModalOpen(false);
          setEditingTask(null);
          if (props.refreshTasks) props.refreshTasks(false);
        }}
      />

      <SubmissionModal
        isOpen={!!submissionTask}
        onClose={closeSubmissionModal}
        task={submissionTask}
        user={props.user}
        onSubmitSuccess={(result) => {
          const taskId = submissionTask.id;
          closeSubmissionModal();
          // Optimistically move to REVIEW (instant UI feedback)
          handleInternalUpdateStage(taskId, 'REVIEW');
          // Then refresh in the background
          if (props.refreshTasks) props.refreshTasks(false);
        }}
      />

      <RejectionModal
        isOpen={rejectionModalState.isOpen}
        onClose={() => setRejectionModalState({ isOpen: false, taskId: null, submissionId: null, taskText: '' })}
        task={{ text: rejectionModalState.taskText }}
        onSubmit={submitRejection}
      />

      <div className="workspace-main-view">
        {viewMode === 'kanban' ? (
          <TaskKanbanView
            tasks={hierarchyFilteredTasks}
            filteredTasks={filteredTasks}
            stageList={STAGE_LIST}
            showDeprioritized={showDeprioritized}
            permissions={permissions}
            user={props.user}
            drillDownId={drillDownId}
            setDrillDownId={setDrillDownId}
            drillPath={drillPath}
            boardLabel={boardLabel}
            label={label}
            selectedTaskIds={selectedTaskIds}
            toggleTaskSelection={toggleTaskSelection}
            toggleStageSelection={toggleStageSelection}
            canUserUpdate={canUserUpdate}
            canEditTask={canEditTask}
            canUserDelete={canUserDelete}
            canManageHierarchy={canManageHierarchy}
            updateTaskStage={handleInternalUpdateStage}
            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            openAddSubtaskModal={handleAddSubtask}
            onMoveToParent={handleMoveToParent}
            onDuplicateMerge={openEditModal}
            onPromote={handleMoveToParent}
            TaskTileComponent={TaskTileComponent}
            openSubmissionModal={openSubmissionModal}
            handleApproveSubmission={handleApproveSubmission}
            handleRejectClick={handleRejectClick}
          />
        ) : viewMode === 'list' ? (
          <TaskListView
            tasks={filteredTasks}
            stageList={STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED')}
            activeVertical={rootVerticalId || activeVertical}
            canUpdate={canUserUpdate}
            canEditTask={canEditTask}
            canManageHierarchy={canManageHierarchy}
            canDelete={canUserDelete}
            updateTaskStage={handleInternalUpdateStage}
            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            openAddSubtaskModal={handleAddSubtask}
            onMoveToParent={handleMoveToParent}
            onDuplicateMerge={openEditModal}
            TaskTileComponent={TaskTileComponent}
            selectedTaskIds={selectedTaskIds}
            onSelect={toggleTaskSelection}
            onToggleStageSelection={toggleStageSelection}
            currentUser={props.user}
            canCreate={canUserCreate}
            permissions={permissions}
            openSubmissionModal={openSubmissionModal}
            handleApproveSubmission={handleApproveSubmission}
            handleRejectClick={handleRejectClick}
          />
        ) : (
          <TaskTreeView
            tasks={filteredTasks}
            activeVertical={rootVerticalId || activeVertical}
            canUpdate={canUserUpdate}
            canEditTask={canEditTask}
            canManageHierarchy={canManageHierarchy}
            canDelete={canUserDelete}
            updateTaskStage={handleInternalUpdateStage}
            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            openAddSubtaskModal={handleAddSubtask}
            onMoveToParent={handleMoveToParent}
            TaskTileComponent={TaskTileComponent}
            currentUser={props.user}
            canCreate={canUserCreate}
            permissions={permissions}
            openSubmissionModal={openSubmissionModal}
            handleApproveSubmission={handleApproveSubmission}
            handleRejectClick={handleRejectClick}
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