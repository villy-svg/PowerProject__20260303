import React, { useState } from 'react';
import { hierarchyUtils } from '../utils/hierarchyUtils';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { TASK_STAGES } from '../constants/stages';
import AssigneeBadge from './AssigneeBadge';
import './TaskListView.css'; // Reusing some list styles for consistency

const TaskTreeView = ({
  tasks,
  activeVertical,
  canUpdate,
  canDelete,
  deleteTask,
  updateTaskStage,
  openEditModal,
  openAddSubtaskModal,
  onMoveToParent,
  TaskTileComponent,
  currentUser
}) => {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const toggleExpand = (id, e) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedIds(newExpanded);
  };

  // Build the full tree regardless of stage
  const verticalTasks = tasks.filter(t => t.verticalId === activeVertical);
  const treeTasks = hierarchyUtils.sortByHierarchy(verticalTasks, 'id', 'parentTask');

  const TreeRow = ({ task, stage }) => {
    const { isDragOver, dragProps, dropProps } = useHierarchyDnd({
      itemId: task.id,
      onDrop: onMoveToParent,
      disabled: task.isContextOnly || !canUpdate
    });

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
        onDoubleClick={() => !task.isContextOnly && canUpdate && openEditModal(task)}
      >
        <div className="list-row-main">
          <div className="tree-expander" onClick={(e) => toggleExpand(task.id, e)}>
            {tasks.some(t => t.parentTask === task.id) ? (expandedIds.has(task.id) ? '▼' : '▶') : ''}
          </div>
          
          <div 
            className="stage-dot" 
            style={{ backgroundColor: stage.color }} 
            title={stage.label}
          />

          {task.isContextOnly && (
            <span className="card-priority" title="Context Only" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px', marginRight: '8px' }}>
              VIEWER
            </span>
          )}

          <AssigneeBadge task={task} currentUser={currentUser} className="mini" />

          {TaskTileComponent && (
            <div className="list-row-vertical-meta">
              <TaskTileComponent task={task} stage={stage} />
            </div>
          )}

          <div className="list-row-content" title={task.text}>
            {task.text}
          </div>
        </div>

        <div className="list-row-controls">
          <div className="list-action-group">
            {!task.isContextOnly && canUpdate && (
              <>
                <button 
                  className="card-add-sub-button"
                  onClick={() => openAddSubtaskModal(task.id)}
                  title="Add Subtask Under This"
                  style={{ color: 'var(--brand-green)', fontWeight: 800, fontSize: '1.1rem' }}
                >
                  +
                </button>
                <button
                  className="card-edit-button"
                  onClick={() => openEditModal(task)}
                  title="Edit Task"
                >
                  ✎
                </button>
              </>
            )}
            {!task.isContextOnly && canDelete && (
              <button
                className="card-delete-button"
                onClick={() => deleteTask(task.id)}
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
        {visibleTasks.length > 0 ? (
          visibleTasks.map(renderNode)
        ) : (
          <p className="empty-msg" style={{ padding: '2rem', textAlign: 'center' }}>No tasks found in this vertical.</p>
        )}
      </div>
    </div>
  );
};

export default TaskTreeView;
