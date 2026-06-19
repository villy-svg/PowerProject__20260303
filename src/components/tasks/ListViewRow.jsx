/**
 * ListViewRow.jsx
 * Renders a single row in the Task List View, including:
 * - Priority badge, assignee badge, custom vertical tile
 * - Hierarchy progress badges (direct + recursive)
 * - Stage navigation arrows (left/right)
 * - Action buttons: submit proof, edit, clone, deprio, delete, promote
 * - Hierarchy DnD (drag a task onto another to make it a child)
 *
 * Extracted from TaskListView.jsx for single-responsibility.
 * Canonical location: src/components/ListViewRow.jsx
 */
import React, { useRef } from 'react';
import {
  IconEdit,
  IconDelete,
  IconUpload,
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
  IconPromote,
  IconDiagonalUp,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconCheck,
} from '../ui/Icons';
import { useHierarchyDnd } from '../../hooks/useHierarchyDnd';
import { useTaskViewActions } from '../../features/task-board/hooks/useTaskViewActions';
import { hierarchyService } from '../../services/rules/hierarchyService';
import { taskUtils } from '../../utils/taskUtils';
import { resolvePriorityLabel } from '../../registry/verticalRegistry';
import AssigneeBadge from '../ui/AssigneeBadge';

const ListViewRow = ({
  task,
  stage,
  stageList,
  canUpdate,
  canEditTask,
  canManageHierarchy,
  canDelete,
  deleteTask,
  updateTaskStage,
  openEditModal,
  onCloneTask,
  openAddSubtaskModal,
  openSubmissionModal,
  onMoveToParent,
  TaskTileComponent,
  selectedTaskIds,
  onSelect,
  onDuplicateMerge,
  currentUser,
  canCreate,
  canAddSubtask,
  canCloneTask,      // <-- Add here (receives the function, not a boolean)
  isExpanded,

  onToggleExpand,
  hasChildren,
  tasks,
  permissions = {},
  handleApproveSubmission,
  handleRejectClick,
  isRowExpanded,
  onToggleRowExpand
}) => {
  const lastTapRef = useRef(0);
  const tva = useTaskViewActions({
    onUpdateStage: updateTaskStage,
    onDeleteTask: deleteTask,
    permissions,
    currentUser,
    openEditModal,
    onCloneTask,
    openSubmissionModal,
    openAddSubtaskModal
  });

  const currentIndex = stageList.findIndex(s => s.id === task.stageId);
  const taskPerms = tva.getTaskPermissions(task);

  const effectiveCanUpdate = taskPerms.canUpdate && !task.isContextOnly;
  const effectiveCanDelete = taskPerms.canDelete && !task.isContextOnly;
  const canManage = canManageHierarchy(task);

  // Use task's own stage for color coding
  const taskStage = stageList.find(s => s.id === task.stageId) || stage;

  // DND Configuration
  const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
    itemId: task.id,
    onDrop: onMoveToParent,
    disabled: task.isContextOnly || !canManage
  });

  // Dynamic Check for buttons
  const leftStageId = currentIndex > 0 ? stageList[currentIndex - 1].id : null;
  const rightStageId = currentIndex < stageList.length - 1 ? stageList[currentIndex + 1].id : null;

  const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permissions, currentUser);
  const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permissions, currentUser);

  const isRejected = task.latestSubmission?.status === 'rejected';
  const blockArrows = isRejected && permissions.level !== 'admin';

  const handleTouchEnd = (e) => {
    if (e.target.closest('button') || e.target.closest('.list-row-selection') || e.target.closest('.tree-expander') || e.target.closest('.list-hierarchy-badges')) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault();
      if (task.isDuplicate) {
        onDuplicateMerge(task);
      } else if (effectiveCanUpdate) {
        openEditModal(task);
      }
    }
    lastTapRef.current = now;
  };

  return (
    <div
      className={`list-task-row ${selectedTaskIds.includes(task.id) ? 'selected' : ''} ${isRowExpanded ? 'is-expanded' : ''} ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
      {...dragProps}
      {...dropProps}
      onClick={(e) => {
        // Only toggle expand if NOT clicking a button, checkbox or expander
        if (e.target.closest('button') || e.target.closest('.list-row-selection') || e.target.closest('.tree-expander')) return;
        if (onToggleRowExpand) onToggleRowExpand();
      }}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={() => {
        if (task.isDuplicate) {
          onDuplicateMerge(task);
        } else if (effectiveCanUpdate) {
          openEditModal(task);
        }
      }}
      style={{
        '--stage-color': taskStage.color,
        opacity: task.isContextOnly ? 0.7 : 1,
        cursor: task.isContextOnly ? 'default' : 'pointer',
      }}
    >
      {/* LEFT SIDE: Identity & Content */}
      <div className="list-row-main" style={{ paddingLeft: task.depth ? `${task.depth * 24}px` : undefined }}>
        <div
          className="tree-expander"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}
          style={{ opacity: hasChildren ? 1 : 0 }}
        >
          {hasChildren ? (isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />) : ''}
        </div>
        {task.depth > 0 && (
          <span className="hierarchy-arrow">↳</span>
        )}
        {/* 1. Select Checkbox */}
        <div className="list-row-selection" onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}>
          <div className={`selection-checkbox ${selectedTaskIds.includes(task.id) ? 'checked' : ''}`}>
            {selectedTaskIds.includes(task.id) && '✓'}
          </div>
        </div>

        {/* 2. Priority */}
        {task.isContextOnly && (
          <span className="card-priority context-viewer-badge" title="Context Only">
            VIEWER
          </span>
        )}
        <div className="list-row-badges">
          {task.priority && (
            <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
              {resolvePriorityLabel(task.priority, task.verticalId)}
            </span>
          )}

          {task.isDuplicate && (
            <span className="duplicate-badge-mini" title={`${task.duplicateCount} identical tasks found`}>
              Dup
            </span>
          )}

          <AssigneeBadge task={task} currentUser={currentUser} className="mini" />

          {TaskTileComponent && (
            <div className="list-row-vertical-meta">
              <TaskTileComponent task={task} stage={taskStage} />
            </div>
          )}

          {/* Hierarchy Progress Badges (Same as TaskCard) */}
          {tasks?.some(t => t.parentTask === task.id) && (() => {
            const directTasks = tasks.filter(t => t.parentTask === task.id);
            const completedDirect = directTasks.filter(t => t.stageId === 'COMPLETED').length;
            const recursiveStats = hierarchyService.getRecursiveTaskStats(task.id, tasks);

            return (
              <div className="list-hierarchy-badges">
                <span className="subtask-progress-badge mini" title="Direct Children Progress">
                  {completedDirect}/{directTasks.length} D
                </span>
                {recursiveStats.total > directTasks.length && (
                  <span className="recursive-progress-badge mini" title="Total Recursive Progress">
                    {recursiveStats.completed}/{recursiveStats.total} T
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* 6. Task Summary */}
        <div className="list-row-content" title={task.text}>
          {isRejected && task.stageId === 'IN_PROGRESS' && (
            <span className="rejected-red-dot" title="Submission Rejected: Rework Required" />
          )}
          {effectiveCanUpdate && !!task.hasReviewDescendant && (
            <span className="review-yellow-dot" title="Subtask(s) in Review: Action Required" />
          )}
          {task.text}
        </div>
      </div>

      {/* RIGHT SIDE: Controls (Wrappable) */}
      <div className="list-row-controls">
        {(canMoveLeft || canMoveRight) && (
          <div className="list-nav-group">
              <button
                className={`card-nav-button ${!canMoveLeft ? 'disabled' : ''}`}
                onClick={() => tva.handleMove(task, 'left')}
                disabled={!canMoveLeft}
                title="Move Back"
              >
                <IconArrowLeft size={14} />
              </button>
              <button
                className={`card-nav-button ${(!canMoveRight || task.stageId === 'COMPLETED' || blockArrows) ? 'disabled' : ''}`}
                onClick={() => tva.handleMove(task, 'right')}
                disabled={!canMoveRight || task.stageId === 'COMPLETED' || blockArrows}
                title={blockArrows ? "Rework Required before moving" : task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
              >
                <IconArrowRight size={14} />
              </button>
          </div>
        )}

        <div className="list-action-group">
          {!task.isContextOnly && (
            <>
              {/* Hierarchy Promotion Actions — restricted to managers/creators only */}
              {canManage && task.parentTask && (
                <div className="hierarchy-nav-group">
                  {tasks?.find(t => t.id === task.parentTask)?.parentTask && (
                    <button
                      className="card-nav-button promote-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const parent = tasks.find(t => t.id === task.parentTask);
                        if (parent) onMoveToParent(task.id, parent.parentTask);
                      }}
                      title="Promote to Parent's Sibling (Promote to Grandparent)"
                    >
                      <IconDiagonalUp size={14} />
                    </button>
                  )}
                  <button
                    className="card-nav-button promote-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToParent(task.id, null);
                    }}
                    title="Make Top Level Task"
                  >
                    <IconPromote size={14} />
                  </button>
                </div>
              )}
              {/* Subtask Creation — available to managers, creators, AND assignees */}
              {canAddSubtask && canAddSubtask(task) && (
                <button
                  className="card-add-sub-button"
                  onClick={(e) => { e.stopPropagation(); tva.handleAddSubtask(task.id); }}
                  title="Add Subtask Under This"
                >
                  <IconPlus size={14} />
                </button>
              )}
            </>
          )}


          {/* RBAC: Contributor+ OR Viewer-as-Assignee can submit proof on active tasks */}
          {!task.isContextOnly &&
            (['contributor', 'editor', 'admin'].includes(permissions.level) || (permissions.level === 'viewer' && ((task.assigned_to || []).includes(currentUser?.employeeId) || (task.assigned_to || []).includes(currentUser?.id)))) &&
            task.stageId !== 'DEPRIORITIZED' &&
            task.stageId !== 'COMPLETED' && (
              <button
                className="card-submit-proof-button"
                onClick={(e) => { e.stopPropagation(); tva.handleSubmitProof(task); }}
                title="Submit Proof of Work"
              >
                <IconUpload size={14} />
              </button>
            )}

          {/* MANAGER APPROVE / REJECT */}
          {!task.isContextOnly && task.stageId === 'REVIEW' && ['editor', 'admin'].includes(permissions.level) && task.latestSubmission && task.latestSubmission.status === 'pending' && (
            <>
              <button
                className="halo-button btn-approve review-action-btn"
                onClick={(e) => { e.stopPropagation(); handleApproveSubmission(task.id, task.latestSubmission.id); }}
                title="Approve Submission"
              >
                ✓ Appr
              </button>
              <button
                className="halo-button btn-reject review-action-btn"
                onClick={(e) => { e.stopPropagation(); handleRejectClick(task); }}
                title="Reject Submission & Request Rework"
              >
                ✗ Rej
              </button>
            </>
          )}

          {(effectiveCanUpdate || taskUtils.canUserEditField(task, 'description', permissions, currentUser)) && (
            <button
              className="card-edit-button"
              onClick={(e) => { e.stopPropagation(); tva.handleEdit(task); }}
              title="Edit Task"
            >
              <IconEdit size={14} />
            </button>
          )}

          {permissions?.level === 'admin' && task.stageId !== 'COMPLETED' && !task.isContextOnly && (
            <button
              className="card-mark-completed-button"
              onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'COMPLETED'); }}
              title="Mark as Completed (Admin Only)"
            >
              <IconCheck size={14} />
            </button>
          )}

          {canCloneTask && canCloneTask(task) && (
            <button
              className="card-clone-button"
              onClick={(e) => { e.stopPropagation(); tva.handleClone(task); }}
              title="Clone Task"
            >
              <IconCopy size={14} />
            </button>
          )}
          {task.stageId === 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'BACKLOG', permissions, currentUser) && (
            <button
              className="card-reprio-button"
              onClick={() => updateTaskStage(task.id, 'BACKLOG')}
              title="Move back to Pending"
            >
              <IconPromote size={14} />
            </button>
          )}
          {task.stageId !== 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'DEPRIORITIZED', permissions, currentUser) && (
            <button
              className="card-deprio-button"
              onClick={() => updateTaskStage(task.id, 'DEPRIORITIZED')}
              title="Move to Deprioritized"
            >
              <IconChevronDown size={14} />
            </button>
          )}
          {effectiveCanDelete && (
            <button
              className="card-delete-button"
              onClick={(e) => { e.stopPropagation(); tva.handleDelete(task.id); }}
              title="Delete Task"
            >
              <IconDelete size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListViewRow;
