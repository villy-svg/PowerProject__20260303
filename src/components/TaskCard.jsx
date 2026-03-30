import React from 'react';
import { 
  IconEdit, 
  IconDelete, 
  IconUpload, 
  IconPlus, 
  IconArrowLeft, 
  IconArrowRight, 
  IconPromote, 
  IconDiagonalUp 
} from './Icons';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';
import AssigneeBadge from './AssigneeBadge';
import './TaskCard.css';

/**
 * TaskCard
 * Master wrapper for all Kanban tasks enforcing a standard 3-row layout.
 * Row 1: Task Title
 * Row 2: Priority (Standard) + Vertical Meta (Children)
 * Row 3: Action Controls (Arrows, Edit, Delete)
 */
const TaskCard = ({
  task,
  stage,
  canUpdate,
  canDelete,
  canManageHierarchy = false,
  updateTaskStage,
  deleteTask,
  openEditModal,
  openAddSubtaskModal,
  openSubmissionModal,
  handleApproveSubmission,
  handleRejectClick,
  onMoveToParent,
  onDuplicateMerge,
  STAGE_LIST,
  isSelected = false,
  onSelect,
  children, // Vertical-specific metadata
  currentUser,
  tasks = [],
  onDrillDown,
  onPromote,
  showHierarchy = false,
  permissions = {}
}) => {
  const handleMove = (direction) => {
    const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
    let newIndex = currentIndex;

    if (direction === 'left' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'right' && currentIndex < STAGE_LIST.length - 1) {
      newIndex = currentIndex + 1;
    }

    if (newIndex !== currentIndex) {
      const targetStageId = STAGE_LIST[newIndex].id;
      if (taskUtils.canUserMoveTask(task, targetStageId, permissions, currentUser)) {
        updateTaskStage(task.id, targetStageId);
      }
    }
  };

  const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);

  // Dynamic Check for buttons
  const isRejected = task.latestSubmission?.status === 'rejected';
  const blockArrows = isRejected && permissions.level !== 'admin';

  const leftStageId = currentIndex > 0 ? STAGE_LIST[currentIndex - 1].id : null;
  const rightStageId = currentIndex < STAGE_LIST.length - 1 ? STAGE_LIST[currentIndex + 1].id : null;

  const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permissions, currentUser);
  const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permissions, currentUser);

  const effectiveCanUpdate = canUpdate && !task.isContextOnly;
  const effectiveCanDelete = canDelete && !task.isContextOnly;

  const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
    itemId: task.id,
    onDrop: onMoveToParent,
    disabled: task.isContextOnly || !canManageHierarchy
  });

  return (
    <div
      className={`task-card-master ${task.isDuplicate && task.isFirstInCluster ? 'is-duplicate-stacked' : ''} ${isSelected ? 'selected' : ''} ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
      {...dragProps}
      {...dropProps}
      onDoubleClick={() => {
        if (task.isDuplicate) {
          onDuplicateMerge(task);
        } else if (effectiveCanUpdate) {
          openEditModal(task);
        }
      }}
      style={{
        borderLeft: `4px solid ${stage?.color || 'var(--border-color)'}`,
        '--stage-color': stage?.color || 'var(--brand-green)',
        opacity: task.isContextOnly ? 0.7 : 1,
        cursor: task.isContextOnly ? 'default' : undefined
      }}
    >
      {/* Row 0: Header (Selection + Drill Down) */}
      <div className="card-header-row">
        <div className="task-selection-area" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          <div className={`selection-checkbox ${isSelected ? 'checked' : ''}`}>
            {isSelected && '✓'}
          </div>
        </div>

        {showHierarchy && (tasks.some(t => t.parentTask === task.id)) && (() => {
          const directTasks = tasks.filter(t => t.parentTask === task.id);
          const completedDirect = directTasks.filter(t => t.stageId === 'COMPLETED').length;
          const recursiveStats = hierarchyService.getRecursiveTaskStats(task.id, tasks);

          return (
            <div className="task-hierarchy-badges">
              <div
                className="subtask-progress-badge"
                title="Direct Children Progress"
                onClick={(e) => { e.stopPropagation(); onDrillDown(task.id); }}
              >
                {completedDirect} / {directTasks.length} Direct
              </div>

              {recursiveStats.total > directTasks.length && (
                <div
                  className="recursive-progress-badge"
                  title={`Total recursive descendants: ${recursiveStats.total} (${recursiveStats.completed} completed)`}
                  onClick={(e) => { e.stopPropagation(); onDrillDown(task.id); }}
                >
                  {recursiveStats.completed} / {recursiveStats.total} Total
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Row 1: Metadata (Priority + Tags + Assignee) */}
      <div className="card-row-1">
        {task.isContextOnly && (
          <span className="card-priority" title="Context Only (View Only)" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px' }}>
            VIEWER
          </span>
        )}
        {task.parentTask && showHierarchy && (
          <span className="subtask-tag" title="Subtask">
            ↳ Subtask
          </span>
        )}
        {task.priority && (
          <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
            {task.priority}
          </span>
        )}
        {task.isDuplicate && (
          <span className="duplicate-badge" title={`${task.duplicateCount} identical tasks found`}>
            Dup
          </span>
        )}
        <AssigneeBadge task={task} currentUser={currentUser} />
        {children}
      </div>

      {/* Row 2: Title */}
      <div className="card-row-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isRejected && task.stageId === 'IN_PROGRESS' && (
          <span className="rejected-red-dot" title="Submission Rejected: Rework Required" />
        )}
        {permissions.canUpdate && !!task.hasReviewDescendant && (
          <span className="review-yellow-dot" title="Subtask(s) in Review: Action Required" />
        )}
        <span className="card-task-name" title={task.text}>{task.text}</span>
      </div>

      {/* Row 3: Controls */}
      <div className="card-row-3">
        <div className="card-navigation">
          {(canMoveLeft || canMoveRight) && (
            <>
              <button
                className={`card-nav-button ${!canMoveLeft ? 'disabled' : ''}`}
                onClick={() => handleMove('left')}
                disabled={!canMoveLeft}
                title="Move Back"
              >
                <IconArrowLeft size={14} />
              </button>
              <button
                className={`card-nav-button ${(!canMoveRight || task.stageId === 'COMPLETED' || blockArrows) ? 'disabled' : ''}`}
                onClick={() => handleMove('right')}
                disabled={!canMoveRight || task.stageId === 'COMPLETED' || blockArrows}
                title={blockArrows ? "Rework Required before moving" : task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
              >
                <IconArrowRight size={14} />
              </button>
            </>
          )}
        </div>

        <div className="task-management-actions">
          {!task.isContextOnly && canManageHierarchy && showHierarchy && (
            <>
              {task.parentTask && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {tasks.find(t => t.id === task.parentTask)?.parentTask && (
                    <button
                      className="card-promote-button"
                      onClick={() => {
                        const parent = tasks.find(t => t.id === task.parentTask);
                        if (parent) onMoveToParent(task.id, parent.parentTask);
                        if (parent) onPromote(task.id, parent.parentTask);
                      }}
                      title="Promote to Parent's Sibling (Promote to Grandparent)"
                    >
                      <IconDiagonalUp size={14} />
                    </button>
                  )}
                  <button
                    className="card-promote-button"
                    onClick={(e) => { e.stopPropagation(); onPromote(task.id, null); }}
                    title="Promote to Top Level"
                  >
                    <IconPromote size={14} />
                  </button>
                </div>
              )}
              <button
                className="card-add-sub-button"
                onClick={() => openAddSubtaskModal(task.id)}
                title="Add Subtask Under This"
              >
                <IconPlus size={14} />
              </button>
            </>
          )}

          {/* RBAC: Contributor+ OR Viewer-as-Assignee can submit proof on active tasks */}
          {!task.isContextOnly &&
            (['contributor', 'editor', 'admin'].includes(permissions.level) || (permissions.level === 'viewer' && ((currentUser?.employeeId && task.assigned_to === currentUser.employeeId) || (currentUser?.id && task.assigned_to === currentUser.id)))) &&
            task.stageId !== 'DEPRIORITIZED' &&
            task.stageId !== 'COMPLETED' && (
              <button
                className="card-submit-proof-button"
                onClick={(e) => { e.stopPropagation(); openSubmissionModal(task); }}
                title="Submit Proof of Work"
              >
                <IconUpload size={14} />
              </button>
            )}

           {/* MANAGER APPROVE / REJECT */}
          {!task.isContextOnly && task.stageId === 'REVIEW' && ['editor', 'admin'].includes(permissions.level) && task.latestSubmission && task.latestSubmission.status === 'pending' && (
            <>
              <button
                className="halo-button btn-approve"
                onClick={(e) => { e.stopPropagation(); handleApproveSubmission(task.id, task.latestSubmission.id); }}
                title="Approve Submission"
              >
                ✓ Appr
              </button>
              <button
                className="halo-button btn-reject"
                onClick={(e) => { e.stopPropagation(); handleRejectClick(task); }}
                title="Reject Submission & Request Rework"
              >
                ✗ Rej
              </button>
            </>
          )}

          {effectiveCanUpdate && (
            <button
              className="card-edit-button"
              onClick={() => openEditModal(task)}
              title="Edit Task"
            >
              <IconEdit size={14} />
            </button>
          )}

          {task.stageId === 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'BACKLOG', permissions, currentUser) && (
            <button
              className="card-reprio-button"
              onClick={() => updateTaskStage(task.id, 'BACKLOG')}
              title="Move back to Pending"
              style={{ color: 'var(--brand-green)', fontWeight: 800 }}
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
              <IconArrowLeft size={14} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          )}

          {effectiveCanDelete && (
            <button
              className="card-delete-button"
              onClick={() => deleteTask(task.id)}
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

export default TaskCard;
