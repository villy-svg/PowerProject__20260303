import React, { useState, useRef } from 'react';
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
  IconCopy,
  IconCheck
} from './Icons';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { useTaskViewActions } from '../features/task-board/hooks/useTaskViewActions';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';
import { useIsMobile } from '../hooks/useIsMobile';
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
  canAddSubtask = false,
  canCloneTask = false,
  updateTaskStage,

  deleteTask,
  openEditModal,
  onCloneTask,
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
  permissions = {},
  isExpanded = false,
  onToggleExpand
}) => {
  const { isMobile } = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);
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

  const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
  const taskPerms = tva.getTaskPermissions(task);

  // Dynamic Check for buttons
  const isRejected = task.latestSubmission?.status === 'rejected';
  const blockArrows = isRejected && permissions.level !== 'admin';

  const leftStageId = currentIndex > 0 ? STAGE_LIST[currentIndex - 1].id : null;
  const rightStageId = currentIndex < STAGE_LIST.length - 1 ? STAGE_LIST[currentIndex + 1].id : null;

  const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permissions, currentUser);
  const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permissions, currentUser);

  const effectiveCanUpdate = taskPerms.canUpdate && !task.isContextOnly;
  const effectiveCanDelete = taskPerms.canDelete && !task.isContextOnly;

  const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
    itemId: task.id,
    onDrop: onMoveToParent,
    disabled: task.isContextOnly || !canManageHierarchy
  });

  const handleTouchEnd = (e) => {
    // Only handle if it's not a button or similar interactive child
    if (e.target.closest('button') || e.target.closest('.task-selection-area') || e.target.closest('.subtask-progress-badge') || e.target.closest('.read-more-btn')) return;

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
      className={`task-card-master ${task.isDuplicate && task.isFirstInCluster ? 'is-duplicate-stacked' : ''} ${isSelected ? 'selected' : ''} ${isExpanded ? 'is-expanded' : ''} ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
      {...dragProps}
      {...dropProps}
      onClick={(e) => {
        // Only toggle expand if NOT clicking a button or checkbox
        if (e.target.closest('button') || e.target.closest('.task-selection-area') || e.target.closest('.subtask-progress-badge')) return;
        if (onToggleExpand) onToggleExpand();
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
        borderLeft: `2px solid color-mix(in srgb, ${stage?.color || 'var(--border-color)'}, transparent 30%)`,
        '--stage-color': stage?.color || 'var(--brand-green)',
        opacity: task.isContextOnly ? 0.7 : 1,
        cursor: task.isContextOnly ? 'default' : 'pointer'
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
      <div className="card-row-2" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          {isRejected && task.stageId === 'IN_PROGRESS' && (
            <span className="rejected-red-dot" title="Submission Rejected: Rework Required" />
          )}
          {permissions.canUpdate && !!task.hasReviewDescendant && (
            <span className="review-yellow-dot" title="Subtask(s) in Review: Action Required" />
          )}
          {task.text?.startsWith('[DRAFT]') && (
            <span className="draft-gray-dot" title="Draft Task" />
          )}
          <span className="card-task-name" title={task.text}>{task.text}</span>
        </div>

        {/* Read More button & Description for Mobile */}
        {isMobile && task.description && (
          <div className="mobile-description-container">
            <button
              type="button"
              className="read-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
            >
              <span>{showDetails ? 'Read Less' : 'Read More'}</span>
              <IconChevronDown size={14} className={`read-more-chevron ${showDetails ? 'is-expanded' : ''}`} />
            </button>
            
            {showDetails && (
              <div className="task-detailed-description">
                <div className="task-detailed-description-title">Detailed Description</div>
                <p style={{ margin: 0, lineHeight: '1.4' }}>{task.description}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Row 3: Unified Controls (Navigation + Management) */}
      <div className="card-row-3">
        {(canMoveLeft || canMoveRight) && (
          <>
            <button
              className="action-icon-btn"
              onClick={() => tva.handleMove(task, 'left')}
              disabled={!canMoveLeft}
              title="Move Back"
            >
              <IconArrowLeft size={14} />
            </button>
            <button
              className="action-icon-btn"
              onClick={() => tva.handleMove(task, 'right')}
              disabled={!canMoveRight || task.stageId === 'COMPLETED' || blockArrows}
              title={blockArrows ? "Rework Required before moving" : task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
            >
              <IconArrowRight size={14} />
            </button>
          </>
        )}

        {/* Hierarchy Navigation (Promote buttons) — restricted to managers/creators */}
        {!task.isContextOnly && canManageHierarchy && showHierarchy && task.parentTask && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {tasks.find(t => t.id === task.parentTask)?.parentTask && (
              <button
                className="action-icon-btn"
                style={{ color: 'var(--brand-blue)' }}
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
              className="action-icon-btn"
              style={{ color: 'var(--brand-green)' }}
              onClick={(e) => { e.stopPropagation(); onPromote(task.id, null); }}
              title="Promote to Top Level"
            >
              <IconPromote size={14} />
            </button>
          </div>
        )}

        {/* Subtask Creation Trigger — available to managers, creators, AND assignees */}
        {!task.isContextOnly && canAddSubtask && showHierarchy && (
          <button
            className="action-icon-btn"
            style={{ color: 'var(--brand-green)' }}
            onClick={() => tva.handleAddSubtask(task.id)}
            title="Add Subtask Under This"
          >
            <IconPlus size={14} />
          </button>
        )}


        {!task.isContextOnly &&
          (['contributor', 'editor', 'admin'].includes(permissions.level) || (permissions.level === 'viewer' && ((task.assigned_to || []).includes(currentUser?.employeeId) || (task.assigned_to || []).includes(currentUser?.id)))) &&
          task.stageId !== 'DEPRIORITIZED' &&
          task.stageId !== 'COMPLETED' && (
            <button
              className="action-icon-btn"
              onClick={(e) => { e.stopPropagation(); tva.handleSubmitProof(task); }}
              title="Submit Proof of Work"
            >
              <IconUpload size={14} />
            </button>
          )}

        {effectiveCanUpdate && (
          <button
            className="action-icon-btn"
            onClick={() => tva.handleEdit(task)}
            title="Edit Task"
          >
            <IconEdit size={14} />
          </button>
        )}

        {permissions?.level === 'admin' && task.stageId !== 'COMPLETED' && !task.isContextOnly && (
          <button
            className="action-icon-btn btn-mark-completed"
            onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'COMPLETED'); }}
            title="Mark as Completed (Admin Only)"
          >
            <IconCheck size={14} />
          </button>
        )}

        {canCloneTask && (
          <button
            className="action-icon-btn"
            onClick={() => tva.handleClone(task)}
            title="Clone Task"
          >
            <IconCopy size={14} />
          </button>
        )}

        {task.stageId === 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'BACKLOG', permissions, currentUser) && (
          <button
            className="action-icon-btn"
            onClick={() => updateTaskStage(task.id, 'BACKLOG')}
            title="Move back to Pending"
            style={{ color: 'var(--brand-green)', fontWeight: 800 }}
          >
            <IconPromote size={14} />
          </button>
        )}

        {task.stageId !== 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'DEPRIORITIZED', permissions, currentUser) && (
          <button
            className="action-icon-btn"
            onClick={() => updateTaskStage(task.id, 'DEPRIORITIZED')}
            title="Move to Deprioritized"
          >
            <IconChevronDown size={14} />
          </button>
        )}

        {effectiveCanDelete && (
          <button
            className="action-icon-btn delete"
            onClick={() => tva.handleDelete(task.id)}
            title="Delete Task"
          >
            <IconDelete size={14} />
          </button>
        )}
      </div>

      {/* Row 4: Approval Actions (Dedicated row for Review stage) */}
      {!task.isContextOnly && task.stageId === 'REVIEW' && ['editor', 'admin'].includes(permissions.level) && task.latestSubmission && task.latestSubmission.status === 'pending' && (
        <div className="card-row-approval">
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
        </div>
      )}
    </div>
  );
};

export default TaskCard;
