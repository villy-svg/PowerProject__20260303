import React, { useState, useCallback } from 'react';
import { STAGE_LIST } from '../constants/stages';
import TaskListView from './TaskListView';
import TaskKanbanView from './TaskKanbanView';
import TaskActionModals from './TaskActionModals';
import SubmissionModal from './SubmissionModal';
import { TaskCSVDownload, TaskCSVImport } from '../verticals/ChargingHubs';
import MasterPageHeader from './MasterPageHeader';
import TaskTreeView from './TaskTreeView';
import { useTaskController } from '../features/task-board/hooks/useTaskController';
import { updateSubmissionStatus } from '../services/tasks/submissionService';
import RejectionModal from './RejectionModal';
import BulkActionBar from './BulkActionBar';
import './TaskController.css';
import FixTasksButton from './FixTasksButton';
import { HUB_VIEWS } from '../registry/verticalRegistry';
import { useIsMobile } from '../hooks/useIsMobile';


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
    user,
    isSubSidebarOpen,
    setIsSubSidebarOpen,
    onShowBottomNav,
    SidebarComponent,
    handleFilterChange,
    resetFilters,
    setFilters,
    onBatchFilter,
    filters,
    setActiveVertical,
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
    showMyTasksOnly, setShowMyTasksOnly,
    selectedTaskIds,
    clearSelection,
    toggleTaskSelection,
    sameStage, commonStageId,
    confirmDialog, setConfirmDialog,
    mergeTaskCluster, setMergeTaskCluster,
    hierarchyFilteredTasks,
    filteredTasks,
    canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy, canAddSubtask,
    handleBulkAction,

    handleUIMoveTask,
    handleInternalDelete,
    handleMoveToParent,
    handleSaveTask,
    updateTaskStage,
    executeMerge,
    handleClearBoard,
    openAddModal, openEditModal, handleAddSubtask, handleCloneTask,
    toggleStageSelection,
    canEditTask, canCloneTask
  } = controller;



  // ─── Proof of Work Submission Modal State ────────────────────────────
  const [submissionTask, setSubmissionTask] = useState(null);
  const openSubmissionModal = (task) => setSubmissionTask(task);
  const closeSubmissionModal = () => setSubmissionTask(null);

  // ─── Proof of Work Approve / Reject State ────────────────────────────
  const [rejectionModalState, setRejectionModalState] = useState({ isOpen: false, taskId: null, submissionId: null, taskText: '' });

  // ─── Tray Visibility (synced FROM MasterPageHeader's scroll hook) ──────
  // We intentionally do NOT call useScrollDirection here. MasterPageHeader
  // owns the single authoritative instance and notifies us via the callback.
  const [isTrayVisible, setIsTrayVisible] = useState(true);
  const handleTrayVisibilityChange = useCallback((visible) => {
    setIsTrayVisible(visible);
    if (props.onTrayVisibilityChange) {
      props.onTrayVisibilityChange(visible);
    }
  }, [props.onTrayVisibilityChange]);

  // ─── Viewport Detection (guards backdrop + blur to mobile/tablet only) ────
  const { isDesktop } = useIsMobile();

  // ─── Header Menu State ───────────────────────────────────────────
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // ─── Compact Tiles Expansion State (For Touch Devices) ──────────
  const [expandedTaskId, setExpandedTaskId] = useState(null);

  const handleApproveSubmission = async (taskId, submissionId) => {
    try {
      await updateSubmissionStatus(submissionId, 'approved');
      await updateTaskStage(taskId, 'COMPLETED');
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
      await updateTaskStage(rejectionModalState.taskId, 'IN_PROGRESS');
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
        isMenuOpen={isHeaderMenuOpen}
        setIsMenuOpen={setIsHeaderMenuOpen}
        hideMenuClose={label?.includes('Hub')}
        isSidebarOpen={props.isMainSidebarOpen}
        SidebarComponent={SidebarComponent}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
        onBatchFilter={onBatchFilter}
        filters={filters}
        tasks={tasks}
        setActiveVertical={setActiveVertical}
        activeVertical={activeVertical}
        rightActions={
          <>
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
        isSubSidebarOpen={isSubSidebarOpen}
        onSidebarToggle={(val) => setIsSubSidebarOpen(typeof val === 'boolean' ? val : !isSubSidebarOpen)}
        canAdd={canUserCreate && !activeVertical.includes('daily')}
        onAddClick={openAddModal}
        isTaskModalOpen={isModalOpen}
        onShowBottomNav={onShowBottomNav}
        onTrayVisibilityChange={handleTrayVisibilityChange}
        expandedLeft={
          <>
            <div className="view-mode-toggle">
              {['kanban', 'list', 'tree'].map((mode) => (
                <button
                  key={mode}
                  className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
                  onClick={() => setViewMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="header-filter-group">
              <button
                className={`halo-button toggle-depri-btn ${showDeprioritized ? 'active' : ''}`}
                onClick={() => setShowDeprioritized(!showDeprioritized)}
                title={showDeprioritized ? "Hide Deferred" : "Show Deferred"}
              >
                Defer
              </button>

              <button
                className={`halo-button toggle-depri-btn ${showMyTasksOnly ? 'active' : ''}`}
                onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
                title={showMyTasksOnly ? "Show All Tasks" : "Filter: My Tasks Only"}
              >
                My Tasks
              </button>

              <button
                className={`halo-button toggle-depri-btn ${showReworkOnly ? 'active' : ''}`}
                onClick={() => setShowReworkOnly(!showReworkOnly)}
                title={showReworkOnly ? "Show All Tasks" : "Filter: Rework Required Only"}
              >
                Rework
              </button>
            </div>

            {permissions.roleId === 'master_admin' && (
              <button
                className="halo-button clear-board-btn"
                onClick={handleClearBoard}
                disabled={saving}
                title="Move all active tasks to Deferred"
              >
                Clear Board
              </button>
            )}
          </>
        }
        expandedRight={
          <>
            {(activeVertical === verticals?.CHARGING_HUBS?.id || HUB_VIEWS.includes(activeVertical)) && (

              <>
                <TaskCSVDownload className="master-action-btn" data={filteredTasks} label="Export Tasks" />
                <TaskCSVDownload className="master-action-btn" isTemplate label="Download Template" />
                <TaskCSVImport className="master-action-btn" verticalId={activeVertical} onImportComplete={() => refreshTasks(false)} />
                <FixTasksButton permissions={permissions} refreshTasks={refreshTasks} />
              </>
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
            updateTaskStage(editingTask.id, 'IN_PROGRESS');
          } else if (status === 'approved' && editingTask) {
            updateTaskStage(editingTask.id, 'COMPLETED');
          }
          // Close the edit modal so the board immediately reflects the change
          setIsModalOpen(false);
          setEditingTask(null);
          if (props.refreshTasks) props.refreshTasks(false);
        }}
        openSubmissionModal={openSubmissionModal}
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
          updateTaskStage(taskId, 'REVIEW');
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

      {/* Backdrop only exists in the DOM on mobile/tablet (≤ 1024px).
           On desktop the header menu is an inline row — no overlay needed. */}
      {!isDesktop && isHeaderMenuOpen && (
        <div 
          className="menu-backdrop" 
          onClick={() => setIsHeaderMenuOpen(false)} 
        />
      )}

      {/* Blur is a mobile-only UX cue for when an overlay panel covers content.
           On desktop the sub-sidebar is an inline panel and the menu is an inline
           row — blurring the board would block access to controls. */}
      <div className={`workspace-main-view ${(!isDesktop && (isHeaderMenuOpen || isSubSidebarOpen)) ? 'is-blurred' : ''}`}>
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
            canAddSubtask={canAddSubtask}
            canCloneTask={canCloneTask}
            updateTaskStage={handleUIMoveTask}

            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            onCloneTask={handleCloneTask}
            openAddSubtaskModal={handleAddSubtask}
            onMoveToParent={handleMoveToParent}
            onDuplicateMerge={openEditModal}
            onPromote={handleMoveToParent}
            TaskTileComponent={TaskTileComponent}
            openSubmissionModal={openSubmissionModal}
            handleApproveSubmission={handleApproveSubmission}
            handleRejectClick={handleRejectClick}
            expandedTaskId={expandedTaskId}
            setExpandedTaskId={setExpandedTaskId}
          />
        ) : viewMode === 'list' ? (
          <TaskListView
            tasks={filteredTasks}
            stageList={STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED')}
            activeVertical={rootVerticalId || activeVertical}
            canUpdate={canUserUpdate}
            canEditTask={canEditTask}
            canManageHierarchy={canManageHierarchy}
            canAddSubtask={canAddSubtask}
            canCloneTask={canCloneTask}
            canDelete={canUserDelete}

            updateTaskStage={handleUIMoveTask}
            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            onCloneTask={handleCloneTask}
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
            expandedTaskId={expandedTaskId}
            setExpandedTaskId={setExpandedTaskId}
          />
        ) : (
          <TaskTreeView
            tasks={filteredTasks}
            activeVertical={rootVerticalId || activeVertical}
            canUpdate={canUserUpdate}
            canEditTask={canEditTask}
            canManageHierarchy={canManageHierarchy}
            canAddSubtask={canAddSubtask}
            canCloneTask={canCloneTask}
            canDelete={canUserDelete}

            updateTaskStage={handleUIMoveTask}
            deleteTask={handleInternalDelete}
            openEditModal={openEditModal}
            onCloneTask={handleCloneTask}
            openAddSubtaskModal={handleAddSubtask}
            onMoveToParent={handleMoveToParent}
            TaskTileComponent={TaskTileComponent}
            currentUser={props.user}
            canCreate={canUserCreate}
            permissions={permissions}
            openSubmissionModal={openSubmissionModal}
            handleApproveSubmission={handleApproveSubmission}
            handleRejectClick={handleRejectClick}
            expandedTaskId={expandedTaskId}
            setExpandedTaskId={setExpandedTaskId}
          />
        )}
      </div>

      <BulkActionBar 
        selectedCount={selectedTaskIds.length}
        isTrayVisible={isTrayVisible}
        canUpdate={canUserUpdate}
        canDelete={canUserDelete}
        sameStage={sameStage}
        commonStageId={commonStageId}
        onAction={handleBulkAction}
        onClear={clearSelection}
      />
    </div>
  );
};

export default TaskController;