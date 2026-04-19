import React from 'react';
import TaskCard from './TaskCard';

/**
 * TaskKanbanView Component
 * Dedicated view for the Kanban board layout.
 * Extracted from TaskController for better maintainability.
 */
const TaskKanbanView = ({
  tasks,
  filteredTasks,
  stageList,
  showDeprioritized,
  permissions,
  user,
  drillDownId,
  setDrillDownId,
  drillPath,
  boardLabel,
  label,
  selectedTaskIds,
  toggleTaskSelection,
  toggleStageSelection,
  canUserUpdate,
  canEditTask,
  canUserDelete,
  canManageHierarchy,
  updateTaskStage,
  deleteTask,
  openEditModal,
  openAddSubtaskModal,
  openSubmissionModal,
  onMoveToParent,
  onDuplicateMerge,
  onPromote,
  TaskTileComponent,
  handleApproveSubmission,
  handleRejectClick,
  expandedTaskId,
  setExpandedTaskId
}) => {
  return (
    <div className="kanban-view-container">
      {permissions.canViewKanbanHierarchy && (drillDownId || drillPath.length > 0) && (
        <div className="drill-breadcrumb" style={{ padding: '0 24px 12px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <button 
            onClick={() => setDrillDownId(null)}
            style={{ background: 'none', border: 'none', color: 'var(--brand-green)', cursor: 'pointer', padding: 0, fontWeight: 600 }}
          >
            {boardLabel || label || 'Board'}
          </button>
          {drillPath.map((node, idx) => (
            <React.Fragment key={node.id}>
              <span>/</span>
              <button 
                onClick={() => setDrillDownId(node.id)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: idx === drillPath.length - 1 ? 'var(--text-color)' : 'var(--brand-green)', 
                  cursor: 'pointer', 
                  padding: 0,
                  fontWeight: idx === drillPath.length - 1 ? 700 : 500
                }}
              >
                {node.text}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      <div className="kanban-board">
        {stageList.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED').map((stage) => {
          const getPriorityWeight = (p) => {
            if (!p) return 0;
            const lowerP = p.toLowerCase();
            if (lowerP === 'high') return 3;
            if (lowerP === 'medium') return 2;
            if (lowerP === 'low') return 1;
            return 0;
          };

          const stageTasks = filteredTasks
            .filter((t) => t.stageId === stage.id)
            .sort((a, b) => {
              // 1. Rework Priority (Rejected tasks always first)
              const isReworkA = a.latestSubmission?.status === 'rejected';
              const isReworkB = b.latestSubmission?.status === 'rejected';
              if (isReworkA && !isReworkB) return -1;
              if (!isReworkA && isReworkB) return 1;

              // 2. Review Priority (Children in review)
              // Only relevant for managers (canUpdate)
              if (canUserUpdate) {
                const isReviewA = a.hasReviewDescendant;
                const isReviewB = b.hasReviewDescendant;
                if (isReviewA && !isReviewB) return -1;
                if (!isReviewA && isReviewB) return 1;
              }

              // 3. Standard Priority weight
              const weightA = getPriorityWeight(a.priority);
              const weightB = getPriorityWeight(b.priority);
              if (weightA !== weightB) return weightB - weightA;

              // 3. Duplicate Grouping
              if (a.isDuplicate && !b.isDuplicate) return -1;
              if (!a.isDuplicate && b.isDuplicate) return 1;

              // 4. Metadata
              const hubA = a.hub_code || '';
              const hubB = b.hub_code || '';
              if (hubA !== hubB) return hubA.localeCompare(hubB);

              const funcA = a.function || '';
              const funcB = b.function || '';
              if (funcA !== funcB) return funcA.localeCompare(funcB);

              return 0;
            });

          const allSelected = stageTasks.length > 0 && stageTasks.every(t => selectedTaskIds.includes(t.id));

          return (
            <div
              key={stage.id}
              className="kanban-stage-halo"
              style={{
                borderTop: `4px solid ${stage.color}`,
                borderColor: `${stage.color}44`,
                backgroundColor: `${stage.color}08`
              }}
            >
              <div className="stage-header">
                <div className="header-left-group">
                  <h4 style={{ fontWeight: 700 }}>{stage.label}</h4>
                  {(stage.id === 'DEPRIORITIZED' || stage.id === 'COMPLETED') && stageTasks.length > 0 && (
                    <button
                      onClick={() => toggleStageSelection(stage.id, stageTasks)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--brand-green)',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0 8px',
                        marginLeft: '4px',
                        height: '100%',
                        opacity: 0.8
                      }}
                    >
                      {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
                    </button>
                  )}
                </div>
                <span
                  className="task-count-badge"
                  style={{ backgroundColor: `${stage.color}22`, color: stage.color, fontWeight: 700 }}
                >
                  {stageTasks.length}
                </span>
              </div>

              <div className="task-drop-zone">
                {stageTasks.map((task) => (
                  <div
                    key={task.id}
                    className="task-card-container"
                  >
                    <TaskCard
                      task={task}
                      stage={stage}
                      canUpdate={canEditTask ? canEditTask(task) : canUserUpdate}
                      canDelete={canUserDelete}
                      canManageHierarchy={canManageHierarchy(task)}
                      updateTaskStage={updateTaskStage}
                      deleteTask={deleteTask}
                      openEditModal={openEditModal}
                      openAddSubtaskModal={openAddSubtaskModal}
                      openSubmissionModal={openSubmissionModal}
                      handleApproveSubmission={handleApproveSubmission}
                      handleRejectClick={handleRejectClick}
                      onMoveToParent={onMoveToParent}
                      onDuplicateMerge={onDuplicateMerge}
                      STAGE_LIST={stageList}
                      isSelected={selectedTaskIds.includes(task.id)}
                      onSelect={() => toggleTaskSelection(task.id)}
                      currentUser={user}
                      tasks={tasks} // Full list for hierarchy lookups if needed
                      onPromote={onPromote}
                      onDrillDown={setDrillDownId}
                      showHierarchy={permissions.canViewKanbanHierarchy}
                      permissions={permissions}
                      isExpanded={expandedTaskId === task.id}
                      onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                    >
                      {TaskTileComponent && (
                        <TaskTileComponent
                          task={task}
                          stage={stage}
                        />
                      )}
                    </TaskCard>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskKanbanView;
