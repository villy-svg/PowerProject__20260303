import React, { useState } from 'react';
import { hierarchyUtils } from '../utils/hierarchyUtils';
import { hierarchyService } from '../services/rules/hierarchyService';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { STAGE_LIST, TASK_STAGES } from '../constants/stages';
import { taskUtils } from '../utils/taskUtils';
import AssigneeBadge from './AssigneeBadge';
import './TaskListView.css'; // Reusing some list styles for consistency

const TaskTreeView = ({
  tasks,
  activeVertical,
  canUpdate,
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
  permissions = {}
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

  // Sort by latest created first
  const sortFn = (a, b) => {
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

  // Split tasks into two groups while preserving tree order
  const projectTreeTasks = [];
  const standaloneTasks = [];

  treeTasks.forEach(task => {
    // Find the root of this task's branch
    let root = task;
    const taskMap = new Map(verticalTasks.map(t => [t.id, t]));
    while (root.parentTask && taskMap.has(root.parentTask)) {
      root = taskMap.get(root.parentTask);
    }

    if (topLevelTasksWithChildren.has(root.id)) {
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

    const permsWithUpdate = { ...permissions, ...canUpdate ? { canUpdate } : {} };
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
        onDoubleClick={() => !task.isContextOnly && (canUpdate || canEditDescription) && openEditModal(task)}
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

          <div className="list-row-content" title={task.text}>
            {task.text}
          </div>
        </div>

        <div className="list-row-controls">
          {(() => {
            const currentIndex = STAGE_LIST.findIndex(s => s.id === task.stageId);
            const leftStageId = currentIndex > 0 ? STAGE_LIST[currentIndex - 1].id : null;
            const rightStageId = currentIndex < STAGE_LIST.length - 1 ? STAGE_LIST[currentIndex + 1].id : null;

            const canMoveLeft = leftStageId && taskUtils.canUserMoveTask(task, leftStageId, permsWithUpdate, currentUser);
            const canMoveRight = rightStageId && taskUtils.canUserMoveTask(task, rightStageId, permsWithUpdate, currentUser);

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
                  ←
                </button>
                <button
                  className={`card-nav-button ${!canMoveRight ? 'disabled' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canMoveRight) updateTaskStage(task.id, rightStageId);
                  }}
                  disabled={!canMoveRight}
                  title={task.stageId === 'COMPLETED' ? "Task is Completed" : "Move Forward"}
                >
                  →
                </button>
              </div>
            );
          })()}

          <div className="list-action-group">
            {!task.isContextOnly && canUpdate && canManageHierarchy(task) && (
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
                        style={{ color: 'var(--brand-blue)', fontWeight: 800 }}
                      >
                        ↖
                      </button>
                    )}
                    <button
                      className="card-nav-button promote-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToParent(task.id, null);
                      }}
                      title="Make Top Level Task"
                      style={{ color: 'var(--brand-blue)', fontWeight: 800 }}
                    >
                      ↑
                    </button>
                  </div>
                )}
                {canCreate && (
                  <button 
                    className="card-add-sub-button"
                    onClick={(e) => { e.stopPropagation(); openAddSubtaskModal(task.id); }}
                    title="Add Subtask Under This"
                    style={{ color: 'var(--brand-green)', fontWeight: 800, fontSize: '1.1rem' }}
                  >
                    +
                  </button>
                )}
              </React.Fragment>
            )}
            
            {!task.isContextOnly && task.stageId !== 'DEPRIORITIZED' && task.stageId !== 'COMPLETED' && (
              <button
                className="card-submit-proof-button"
                onClick={(e) => { e.stopPropagation(); openSubmissionModal(task); }}
                title="Submit Proof of Work"
                style={{ color: 'var(--brand-mint)', fontWeight: 800, fontSize: '1.1rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                📤
              </button>
            )}

            {!task.isContextOnly && (canUpdate || canEditDescription) && (
              <button
                className="card-edit-button"
                onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                title="Edit Task"
              >
                ✎
              </button>
            )}

            {task.stageId === 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'BACKLOG', permsWithUpdate, currentUser) && (
              <button
                className="card-reprio-button"
                onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'BACKLOG'); }}
                title="Move back to Pending"
                style={{ color: 'var(--brand-green)', fontWeight: 800 }}
              >
                ⬆
              </button>
            )}
            {task.stageId !== 'DEPRIORITIZED' && taskUtils.canUserMoveTask(task, 'DEPRIORITIZED', permsWithUpdate, currentUser) && (
              <button
                className="card-deprio-button"
                onClick={(e) => { e.stopPropagation(); updateTaskStage(task.id, 'DEPRIORITIZED'); }}
                title="Move to Deprioritized"
              >
                ⬇
              </button>
            )}

            {!task.isContextOnly && canDelete && (
              <button
                className="card-delete-button"
                onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                title="Delete Task"
              >
                ×
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
        {projectTreeTasks.length > 0 && (
          <div className="tree-group-section">
            <h5 className="tree-group-header">INTEGRATED PROJECT TREES</h5>
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
            <h5 className="tree-group-header">STANDALONE TASKS</h5>
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
