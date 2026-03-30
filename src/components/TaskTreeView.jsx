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
import './TaskListView.css'; // Reusing some list styles for consistency

const TaskTreeView = ({
  tasks,
  activeVertical,
  canUpdate,
  canEditTask,
  canManageHierarchy,
  canDelete,
  deleteTask,
  updateTaskStage,
  openEditModal,
  openAddSubtaskModal,
  openSubmissionModal,
  onMoveToParent,
  TaskTileComponent,
  currentUser,
  canCreate,
  permissions = {},
  handleApproveSubmission,
  handleRejectClick
}) => {
  const [expandedIds, setExpandedIds] = useState(new Set());

  // Auto-expand tree to show current user's tasks
  React.useEffect(() => {
    if (!currentUser || !tasks || tasks.length === 0) return;

    const newExpanded = new Set();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // Find tasks assigned to "YOU"
    const myTasks = tasks.filter(t =>
      (currentUser.employeeId && t.assigned_to === currentUser.employeeId) ||
      (currentUser.id && t.assigned_to === currentUser.id)
    );

    // Trace back all ancestors for each of my tasks
    myTasks.forEach(task => {
      let curr = task;
      while (curr.parentTask && taskMap.has(curr.parentTask)) {
        newExpanded.add(curr.parentTask);
        curr = taskMap.get(curr.parentTask);
      }
    });

    if (newExpanded.size > 0) {
      setExpandedIds(prev => new Set([...prev, ...newExpanded]));
    }
  }, [currentUser, tasks]);

  const toggleExpand = (id, e) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  // Sort by priority, then latest created first
  const sortFn = (a, b) => {
    // 1. Rework Priority (Rejected tasks always first)
    const isReworkA = a.latestSubmission?.status === 'rejected';
    const isReworkB = b.latestSubmission?.status === 'rejected';
    if (isReworkA && !isReworkB) return -1;
    if (!isReworkA && isReworkB) return 1;

    // 2. Review Priority (Children in review)
    // Only relevant for managers (canUpdate)
    if (canUpdate) {
      const isReviewA = a.hasReviewDescendant;
      const isReviewB = b.hasReviewDescendant;
      if (isReviewA && !isReviewB) return -1;
      if (!isReviewA && isReviewB) return 1;
    }

    const dateA = new Date(a.created_at || a.createdAt || 0);
    const dateB = new Date(b.created_at || b.createdAt || 0);
    return dateB - dateA;
  };

  // Build the full tree regardless of stage
  const verticalTasks = tasks.filter(t => t.verticalId === activeVertical);
  const treeTasks = hierarchyUtils.sortByHierarchy(verticalTasks, 'id', 'parentTask', sortFn);

  // Identify root-level tasks that HAVE children
  const topLevelTasksWithChildren = new Set(
    verticalTasks
      .filter(t => !t.parentTask && verticalTasks.some(child => child.parentTask === t.id))
      .map(t => t.id)
  );

  // Split tasks into three groups while preserving tree order
  const reworkTasks = [];
  const projectTreeTasks = [];
  const standaloneTasks = [];

  const taskMap = new Map(verticalTasks.map(t => [t.id, t]));

  treeTasks.forEach(task => {
    // 0. Check if this task itself is a Rework task
    const isRework = task.latestSubmission?.status === 'rejected';

    // 1. Find the root of this task's branch to determine if it's a tree or standalone
    let root = task;
    while (root.parentTask && taskMap.has(root.parentTask)) {
      root = taskMap.get(root.parentTask);
    }

    if (isRework) {
      reworkTasks.push(task);
    } else if (topLevelTasksWithChildren.has(root.id)) {
      projectTreeTasks.push(task);
    } else {
      standaloneTasks.push(task);
    }
  });

  const TreeRow = ({ task, stage }) => {
    const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
      itemId: task.id,
      onDrop: onMoveToParent,
      disabled: task.isContextOnly || !canManageHierarchy(task)
    });

    const effectiveCanUpdate = canEditTask ? canEditTask(task) : canUpdate;
    const permsWithUpdate = { ...permissions, ...effectiveCanUpdate ? { canUpdate: effectiveCanUpdate } : {} };
    const canEditDescription = taskUtils.canUserEditField(task, 'description', permsWithUpdate, currentUser);

    return (
      <div
        className={`list-task-row tree-row ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
        style={{
          '--stage-color': stage.color,
          marginLeft: `${(task.depth || 0) * 24}px`,
          opacity: task.isContextOnly ? 0.7 : 1
        }}
        {...dragProps}
        {...dropProps}
        onDoubleClick={() => !task.isContextOnly && (effectiveCanUpdate || canEditDescription) && openEditModal(task)}
      >
        <div className="list-row-main">
          <div className="tree-expander" onClick={(e) => toggleExpand(task.id, e)}>
            {tasks.some(t => t.parentTask === task.id) ? (expandedIds.has(task.id) ? '▼' : '▶') : ''}
          </div>

          <div className="list-row-badges">
            {task.isContextOnly && (
              <span className="card-priority" title="Context Only" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px' }}>
                VIEWER
              </span>
            )}

            <AssigneeBadge task={task} currentUser={currentUser} className="mini" />

            {TaskTileComponent && (
              <div className="list-row-vertical-meta">
                <TaskTileComponent task={task} stage={stage} />
              </div>
            )}

            {/* Hierarchy Progress Badges */}
            {tasks.some(t => t.parentTask === task.id) && (() => {
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

          <div className="list-row-content" title={task.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {task.latestSubmission?.status === 'rejected' && task.stageId === 'IN_PROGRESS' && (
              <span className="rejected-red-dot" title="Submission Rejected: Rework Required" />
            )}
            {canUpdate && task.hasReviewDescendant && (
              <span className="review-yellow-dot" title="Subtask(s) in Review: Action Required" />
            )}
            {task.text}
          </div>
        </div>

        <div className="list-row-controls">
          {(() => {
            const isRejected = task.latestSubmission?.status === 'rejected';
            const blockArrows = isRejected && permissions.level !== 'admin';

            const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
            const leftStageId = currentIndex > 0 ? STAGE_LIST[currentIndex - 1].id : null;
            const rightStageId = currentIndex < STAGE_LIST.length - 1 ? STAGE_LIST[currentIndex + 1].id : null;

            const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permissions, currentUser);
            const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permissions, currentUser);

            if (!canMoveLeft && !canMoveRight) return null;

            return (
              <div className="list-nav-group">
                <button
                  className={`card-nav-button ${!canMoveLeft ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canMoveLeft) updateTaskStage(task.id, leftStageId);
                  }}
                  disabled={!canMoveLeft}
                  title="Move Back"
                >
                  <IconArrowLeft size={14} />
                </button>
                <button
                  className={`card-nav-button ${(!canMoveRight || task.stageId === 'COMPLETED' || blockArrows) ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canMoveRight && task.stageId !== 'COMPLETED' && !blockArrows) updateTaskStage(task.id, rightStageId);
                  }}
                  disabled={!canMoveRight || task.stageId === 'COMPLETED' || blockArrows}
                  title={blockArrows ? "Rework Required before moving" : task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
                >
                  <IconArrowRight size={14} />
                </button>
              </div>
            );
          })()}

          <div className="list-action-group">
            {!task.isContextOnly && effectiveCanUpdate && canManageHierarchy(task) && (
              <React.Fragment>
                {task.parentTask && (
                  <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                    {tasks.find(t => t.id === task.parentTask)?.parentTask && (
                      <button
                        className="card-nav-button promote-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const parent = tasks.find(t => t.id === task.parentTask);
                          if (parent) onMoveToParent(task.id, parent.parentTask);
                        }}
                        title="Move to Parent's Sibling (Promote to Grandparent)"
                        style={{ color: 'var(--brand-blue)' }}
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
                      style={{ color: 'var(--brand-blue)' }}
                    >
                      <IconPromote size={14} />
                    </button>
                  </div>
                )}
                {canCreate && (
                  <button
                    className="card-add-sub-button"
                    onClick={(e) => { e.stopPropagation(); openAddSubtaskModal(task.id); }}
                    title="Add Subtask Under This"
                    style={{ color: 'var(--brand-green)' }}
                  >
                    <IconPlus size={14} />
                  </button>
                )}
              </React.Fragment>
            )}

            {/* RBAC: Only Contributor+ (non-creator) can submit proof on active tasks */}
            {!task.isContextOnly &&
              ['contributor', 'editor', 'admin'].includes(permissions.level) &&
              ((task.createdBy || task.created_by) !== currentUser.id) && // Only if NOT the creator
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
            {task.stageId === 'REVIEW' && ['editor', 'admin'].includes(permissions.level) && task.latestSubmission && task.latestSubmission.status === 'pending' && (
              <>
                <button
                  className="halo-button save-btn"
                  style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: 'auto', marginLeft: '4px' }}
                  onClick={(e) => { e.stopPropagation(); handleApproveSubmission(task.id, task.latestSubmission.id); }}
                  title="Approve Submission"
                >
                  ✓ Appr
                </button>
                <button
                  className="halo-button delete-btn"
                  style={{ padding: '2px 6px', fontSize: '0.75rem', minWidth: 'auto', marginLeft: '4px' }}
                  onClick={(e) => { e.stopPropagation(); handleRejectClick(task); }}
                  title="Reject Submission & Request Rework"
                >
                  ✗ Rej
                </button>
              </>
            )}

            {!task.isContextOnly && (effectiveCanUpdate || canEditDescription) && (
              <button
                className="card-edit-button"
                onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                title="Edit Task"
              >
                <IconEdit size={14} />
              </button>
            )}

            {task.stageId === 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'BACKLOG', permissions, currentUser) && (
              <button
                className="card-reprio-button"
                onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'BACKLOG'); }}
                title="Move back to Pending"
                style={{ color: 'var(--brand-green)' }}
              >
                <IconPromote size={14} />
              </button>
            )}
            {task.stageId !== 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'DEPRIORITIZED', permissions, currentUser) && (
              <button
                className="card-deprio-button"
                onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'DEPRIORITIZED'); }}
                title="Move to Deprioritized"
              >
                <IconArrowLeft size={14} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            )}

            {!task.isContextOnly && canDelete && (
              <button
                className="card-delete-button"
                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
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

  const renderNode = (task) => {
    const isExpanded = expandedIds.has(task.id);
    const stage = TASK_STAGES[task.stageId] || { color: 'var(--text-secondary)', label: 'Unknown' };

    return (
      <div key={task.id} className="tree-node-wrapper">
        <TreeRow task={task} stage={stage} />
      </div>
    );
  };

  // Filter out tasks whose ancestors are collapsed
  const visibleTasks = treeTasks.filter(task => {
    let curr = task;
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    while (curr.parentTask) {
      if (!expandedIds.has(curr.parentTask)) return false;
      curr = taskMap.get(curr.parentTask);
      if (!curr) break;
    }
    return true;
  });

  return (
    <div className="task-tree-view">
      <div className="list-task-container">
        {reworkTasks.length > 0 && (
          <div className="tree-group-section rework-section">
            <h5 className="tree-group-header">Rework Required</h5>
            {reworkTasks.map(renderNode)}
          </div>
        )}

        {projectTreeTasks.length > 0 && (
          <div className="tree-group-section">
            <h5 className="tree-group-header">Integrated Project Trees</h5>
            {projectTreeTasks.filter(t => {
              let curr = t;
              const taskMap = new Map(tasks.map(t => [t.id, t]));
              while (curr.parentTask) {
                if (!expandedIds.has(curr.parentTask)) return false;
                curr = taskMap.get(curr.parentTask);
                if (!curr) break;
              }
              return true;
            }).map(renderNode)}
          </div>
        )}

        {standaloneTasks.length > 0 && (
          <div className="tree-group-section">
            <h5 className="tree-group-header">Standalone Tasks</h5>
            {standaloneTasks.map(renderNode)}
          </div>
        )}

        {projectTreeTasks.length === 0 && standaloneTasks.length === 0 && (
          <p className="empty-msg" style={{ padding: '2rem', textAlign: 'center' }}>No tasks found in this vertical.</p>
        )}
      </div>
    </div>
  );
};

export default TaskTreeView;
