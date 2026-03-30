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
import './TaskListView.css';

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
  openAddSubtaskModal,
  openSubmissionModal,
  onMoveToParent,
  TaskTileComponent,
  selectedTaskIds,
  onSelect,
  onDuplicateMerge,
  currentUser,
  canCreate,
  isExpanded,
  onToggleExpand,
  hasChildren,
  tasks,
  permissions = {},
  handleApproveSubmission,
  handleRejectClick
}) => {
  const currentIndex = stageList.findIndex(s => s.id === task.stageId);

  const effectiveCanUpdate = (canEditTask ? canEditTask(task) : canUpdate) && !task.isContextOnly;
  const effectiveCanDelete = canDelete && !task.isContextOnly;
  const canManage = canManageHierarchy(task);

  // Use task's own stage for color coding
  const taskStage = stageList.find(s => s.id === task.stageId) || stage;

  // DND Configuration
  const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
    itemId: task.id,
    onDrop: onMoveToParent,
    disabled: task.isContextOnly || !canManage
  });

  const handleMove = (direction) => {
    let newIndex = currentIndex;
    if (direction === 'left' && canMoveLeft) newIndex--;
    else if (direction === 'right' && canMoveRight) newIndex++;

    if (newIndex !== currentIndex) {
      const targetStageId = stageList[newIndex].id;
      if (taskUtils.canUserMoveTask(task, targetStageId, permissions, currentUser)) {
        updateTaskStage(task.id, targetStageId);
      }
    }
  };

  // Dynamic Check for buttons
  const leftStageId = currentIndex > 0 ? stageList[currentIndex - 1].id : null;
  const rightStageId = currentIndex < stageList.length - 1 ? stageList[currentIndex + 1].id : null;

  const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permissions, currentUser);
  const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permissions, currentUser);

  const isRejected = task.latestSubmission?.status === 'rejected';
  const blockArrows = isRejected && permissions.level !== 'admin';

  return (
    <div
      className={`list-task-row ${selectedTaskIds.includes(task.id) ? 'selected' : ''} ${task.isContextOnly ? 'context-only' : ''} ${isDragOver ? 'drop-target' : ''}`}
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
        '--stage-color': taskStage.color,
        opacity: task.isContextOnly ? 0.7 : 1,
      }}
    >
      {/* LEFT SIDE: Identity & Content */}
      <div className="list-row-main" style={{ paddingLeft: task.depth ? `${task.depth * 24}px` : undefined }}>
        <div
          className="tree-expander"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}
          style={{ width: '20px', display: 'flex', justifyContent: 'center', cursor: 'pointer', opacity: hasChildren ? 1 : 0 }}
        >
          {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
        </div>
        {task.depth > 0 && (
          <span style={{ color: 'var(--text-secondary)', marginRight: '4px', opacity: 0.5 }}>↳</span>
        )}
        {/* 1. Select Checkbox */}
        <div className="list-row-selection" onClick={(e) => { e.stopPropagation(); onSelect(task.id); }}>
          <div className={`selection-checkbox ${selectedTaskIds.includes(task.id) ? 'checked' : ''}`}>
            {selectedTaskIds.includes(task.id) && '✓'}
          </div>
        </div>

        {/* 2. Priority */}
        {task.isContextOnly && (
          <span className="card-priority" title="Context Only" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px' }}>
            VIEWER
          </span>
        )}
        <div className="list-row-badges">
          {task.priority && (
            <span className={`card-priority ${task.stageId === 'COMPLETED' ? 'priority-completed' : `priority-${task.priority.toLowerCase()}`}`}>
              {task.priority}
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
        <div className="list-row-content" title={task.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRejected && task.stageId === 'IN_PROGRESS' && (
            <span className="rejected-red-dot" title="Submission Rejected: Rework Required" />
          )}
          {effectiveCanUpdate && task.hasReviewDescendant && (
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
          </div>
        )}

        <div className="list-action-group">
          {!task.isContextOnly && canManage && (
            <>
              {task.parentTask && (
                <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                  {tasks?.find(t => t.id === task.parentTask)?.parentTask && (
                    <button
                      className="card-nav-button promote-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const parent = tasks.find(t => t.id === task.parentTask);
                        if (parent) onMoveToParent(task.id, parent.parentTask);
                      }}
                      title="Promote to Parent's Sibling (Promote to Grandparent)"
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
                >
                  <IconPlus size={14} />
                </button>
              )}
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

          {(effectiveCanUpdate || taskUtils.canUserEditField(task, 'description', permissions, currentUser)) && (
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
              style={{ color: 'var(--brand-green)' }}
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

const TaskListView = ({
  tasks,
  stageList,
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
  TaskTileComponent, // To render vertical-specific metadata
  selectedTaskIds = [],
  onSelect,
  onToggleStageSelection,
  onDuplicateMerge,
  currentUser,
  canCreate,
  permissions = {},
  handleApproveSubmission,
  handleRejectClick
}) => {
  const [expandedIds, setExpandedIds] = React.useState(new Set(['ALL'])); // Default expand all or empty? 
  // Actually, user wants "dropdown kind of a nesting", let's default to expanded so they see the hierarchy first, or collapsed? 
  // Conventionally, project boards start expanded but let's just use an empty set and they can expand.

  const toggleExpand = (id, e) => {
    if (e) e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  const priorityOrder = { 'Urgent': 0, 'High': 1, 'Medium': 2, 'Low': 3 };

  return (
    <div className="task-list-view">
      {stageList.map((stage) => {
        // Find tasks that belong to this stage section based on their top-level ancestor
        const rawStageRootTasks = tasks.filter(t => !t.parentTask && t.stageId === stage.id);

        // Find all descendants of these roots
        const allMemberIds = new Set();
        rawStageRootTasks.forEach(root => {
          allMemberIds.add(root.id);
          const descendants = hierarchyUtils.getDescendants(tasks, root.id, 'id', 'parentTask');
          descendants.forEach(d => allMemberIds.add(d.id));
        });

        const rawStageTasks = tasks
          .filter(t => allMemberIds.has(t.id))
          .sort((a, b) => {
            // 0. Rework Priority (Rejected tasks always first)
            const isReworkA = a.latestSubmission?.status === 'rejected';
            const isReworkB = b.latestSubmission?.status === 'rejected';
            if (isReworkA && !isReworkB) return -1;
            if (!isReworkA && isReworkB) return 1;

            // 1. Review Priority (Children in review)
            // Only relevant for managers (canUpdate)
            if (canUpdate) {
              const isReviewA = a.hasReviewDescendant;
              const isReviewB = b.hasReviewDescendant;
              if (isReviewA && !isReviewB) return -1;
              if (!isReviewA && isReviewB) return 1;
            }

            const pA = priorityOrder[a.priority] ?? 99;
            const pB = priorityOrder[b.priority] ?? 99;
            if (pA !== pB) return pA - pB;

            // Secondary: Hub codes (alphabetical)
            const hubA = a.hub_code || '';
            const hubB = b.hub_code || '';
            if (hubA !== hubB) return hubA.localeCompare(hubB);

            // Tertiary: Function codes (alphabetical)
            const funcA = a.function || '';
            const funcB = b.function || '';
            if (funcA !== funcB) return funcA.localeCompare(funcB);

            return 0;
          });

        const stageTasks = hierarchyUtils.sortByHierarchy(rawStageTasks, 'id', 'parentTask');

        if (stageTasks.length === 0) return null;

        return (
          <section key={stage.id} className="list-stage-section">
            <header className="list-stage-header">
              <div className="header-left-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ color: stage.color, fontWeight: 700 }}>{stage.label}</h4>
                {(stage.id === 'DEPRIORITIZED' || stage.id === 'COMPLETED') && stageTasks.length > 0 && (
                  <button
                    onClick={() => onToggleStageSelection(stage.id, stageTasks)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-green)',
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '0 8px',
                      height: '100%',
                      opacity: 0.8
                    }}
                  >
                    {stageTasks.every(t => selectedTaskIds.includes(t.id)) ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <span className="task-count-badge" style={{ backgroundColor: `${stage.color}22`, color: stage.color, fontWeight: 700 }}>
                {stageTasks.length}
              </span>
            </header>

            <div className="list-task-container">
              {stageTasks.filter(t => {
                // Visibility filter: ancestors must be expanded
                let curr = t;
                const taskMap = new Map(tasks.map(item => [item.id, item]));
                while (curr.parentTask) {
                  if (!expandedIds.has(curr.parentTask)) return false;
                  curr = taskMap.get(curr.parentTask);
                  if (!curr) break;
                }
                return true;
              }).map((task) => (
                <ListViewRow
                  key={task.id}
                  task={task}
                  stage={stage}
                  stageList={stageList}
                  canUpdate={canUpdate}
                  canEditTask={canEditTask}
                  canManageHierarchy={canManageHierarchy}
                  canDelete={canDelete}
                  deleteTask={deleteTask}
                  updateTaskStage={updateTaskStage}
                  openEditModal={openEditModal}
                  openAddSubtaskModal={openAddSubtaskModal}
                  openSubmissionModal={openSubmissionModal}
                  onMoveToParent={onMoveToParent}
                  TaskTileComponent={TaskTileComponent}
                  selectedTaskIds={selectedTaskIds}
                  onSelect={onSelect}
                  onDuplicateMerge={onDuplicateMerge}
                  currentUser={currentUser}
                  canCreate={canCreate}
                  isExpanded={expandedIds.has(task.id)}
                  onToggleExpand={() => toggleExpand(task.id)}
                  hasChildren={tasks.some(child => child.parentTask === task.id)}
                  tasks={tasks}
                  permissions={permissions}
                  handleApproveSubmission={handleApproveSubmission}
                  handleRejectClick={handleRejectClick}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default TaskListView;
