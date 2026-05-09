import React from 'react';
import { hierarchyUtils } from '../utils/hierarchyUtils';
import ListViewRow from './ListViewRow';
import './TaskListView.css';

const TaskListView = ({
  tasks,
  stageList,
  activeVertical,
  canUpdate,
  canEditTask,
  canManageHierarchy,
  canAddSubtask,
  canCloneTask,      // <-- Add here
  canDelete,

  deleteTask,
  updateTaskStage,
  openEditModal,
  onCloneTask,
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
  handleRejectClick,
  expandedTaskId,
  setExpandedTaskId
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
            // 1. Rework Priority (Rejected tasks always first)
            const isReworkA = a.latestSubmission?.status === 'rejected';
            const isReworkB = b.latestSubmission?.status === 'rejected';
            if (isReworkA && !isReworkB) return -1;
            if (!isReworkA && isReworkB) return 1;

            // 2. Review Priority (Children in review)
            const isReviewA = !!a.hasReviewDescendant;
            const isReviewB = !!b.hasReviewDescendant;
            if (isReviewA && !isReviewB) return -1;
            if (!isReviewA && isReviewB) return 1;

            // 3. Draft Priority (Starts with [DRAFT])
            const isDraftA = a.text?.startsWith('[DRAFT]');
            const isDraftB = b.text?.startsWith('[DRAFT]');
            if (isDraftA && !isDraftB) return -1;
            if (!isDraftA && isDraftB) return 1;

            // 4. Standard Priority Level
            const priorityOrderMap = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
            const pA = priorityOrderMap[(a.priority || '').toLowerCase()] ?? 99;
            const pB = priorityOrderMap[(b.priority || '').toLowerCase()] ?? 99;
            if (pA !== pB) return pA - pB;

            // 5. Fallback: Latest First (createdAt descending)
            const dateA = new Date(a.createdAt || a.created_at || 0).getTime();
            const dateB = new Date(b.createdAt || b.created_at || 0).getTime();
            if (dateA !== dateB) return dateB - dateA;

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
                  canAddSubtask={canAddSubtask}
                  canDelete={canDelete}

                  deleteTask={deleteTask}
                  updateTaskStage={updateTaskStage}
                  openEditModal={openEditModal}
                  onCloneTask={onCloneTask}
                  openAddSubtaskModal={openAddSubtaskModal}
                  openSubmissionModal={openSubmissionModal}
                  onMoveToParent={onMoveToParent}
                  TaskTileComponent={TaskTileComponent}
                  selectedTaskIds={selectedTaskIds}
                  onSelect={onSelect}
                  onDuplicateMerge={onDuplicateMerge}
                  currentUser={currentUser}
                  canCreate={canCreate}
                  canCloneTask={canCloneTask}
                  isExpanded={expandedIds.has(task.id)}
                  onToggleExpand={() => toggleExpand(task.id)}
                  hasChildren={tasks.some(child => child.parentTask === task.id)}
                  tasks={tasks}
                  permissions={permissions}
                  handleApproveSubmission={handleApproveSubmission}
                  handleRejectClick={handleRejectClick}
                  isRowExpanded={expandedTaskId === task.id}
                  onToggleRowExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
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
