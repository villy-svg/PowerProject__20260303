import React, { useState } from 'react';
import { STAGE_LIST } from '../../constants/stages';
import { VERTICAL_LIST } from '../../constants/verticals';
import { taskUtils } from '../../utils/taskUtils';
import { resolveVerticalComponents } from '../../registry/verticalRegistry';
import TaskCard from './TaskCard';
import TaskListView from './TaskListView';
import { IconClock, IconZap, IconEye, IconCheck, IconChevronDown, IconInfo } from '../ui/Icons';
import './CentralisedTaskBoard.css';

/**
 * CentralisedTaskBoard Component
 * Displays interactive columns showing user tasks across all verticals,
 * respecting role bounds and screen scaling.
 */
const CentralisedTaskBoard = ({
  tasks = [],
  user,
  permissions = {},
  verticals = {},
  verticalList = [],
  isMobile = false,
  updateTaskStage,
  canEditTask,
  canUserDelete,
  canManageHierarchy,
  canAddSubtask,
  canCloneTask,
  handleInternalDelete,
  openEditModal,
  handleCloneTask,
  handleAddSubtask,
  openSubmissionModal,
  handleApproveSubmission,
  handleRejectClick,
  handleMoveToParent,
  setMergeTaskCluster,
  expandedTaskId,
  setExpandedTaskId,
  canCreateEscalation = false,
  openAddEscalationModal,
  title = "Centralised Task View",
  description = "A unified, interactive workspace showing all active tasks assigned to you across all verticals.",
  defaultCollapsed = false
}) => {
  const [activeBoardStageId, setActiveBoardStageId] = useState('BACKLOG');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  
  const assignedTasks = tasks.filter(t => taskUtils.isAssignee(t, user));
  const myTasks = assignedTasks.filter(t => {
    let current = t;
    while (current.parentTask) {
      const parent = tasks.find(pt => pt.id === current.parentTask);
      if (!parent) break;
      if (taskUtils.isAssignee(parent, user)) {
        return false;
      }
      current = parent;
    }
    return true;
  });
  const boardStages = STAGE_LIST.filter(s => s.id !== 'DEPRIORITIZED');

  if (myTasks.length === 0) {
    return (
      <div className="centralised-task-view-wrapper animate-fade-in">
        <div className="centralised-task-view">
          {!isMobile && (
            <div className="summary-header secondary-header flex-between">
              <div className="flex-center-gap">
                <div className="desktop-header-title-container">
                  <h2>{title}</h2>
                  <IconInfo size={16} className="title-info-icon" />
                  <span className="desktop-title-tooltip-text">{description}</span>
                </div>
                <button 
                  className="board-collapse-toggle-btn"
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  aria-expanded={!isCollapsed}
                  title={isCollapsed ? "Expand section" : "Collapse section"}
                >
                  <IconChevronDown 
                    className={`collapse-chevron-icon ${isCollapsed ? 'collapsed' : ''}`} 
                    size={20}
                  />
                </button>
              </div>
            </div>
          )}

          {canCreateEscalation && !isMobile && (
            <div className="centralised-actions-row">
              <button
                className="halo-button add-escalation-btn"
                onClick={openAddEscalationModal}
              >
                + Request Support
              </button>
            </div>
          )}
          <div className={`centralised-board-collapsible-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="centralised-board-collapsible-content">
              <div className="centralised-board-empty">
                <div className="empty-glow" />
                <span className="empty-icon">✓</span>
                <h3>All Caught Up!</h3>
                <p>You have no active tasks assigned to you right now. Enjoy your clear queue!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const DynamicTaskTile = ({ task, stage }) => {
    const { TaskTileComponent: DynTileComponent } = resolveVerticalComponents(task.verticalId, verticals);
    if (!DynTileComponent) return null;
    return <DynTileComponent task={task} stage={stage} />;
  };

  return (
    <div className="centralised-task-view-wrapper animate-fade-in">
      <div className="centralised-task-view">
        {!isMobile && (
          <div className="summary-header secondary-header flex-between">
            <div className="flex-center-gap">
              <div className="desktop-header-title-container">
                <h2>{title}</h2>
                <IconInfo size={16} className="title-info-icon" />
                <span className="desktop-title-tooltip-text">{description}</span>
              </div>
              <button 
                className="board-collapse-toggle-btn"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? "Expand section" : "Collapse section"}
              >
                <IconChevronDown 
                  className={`collapse-chevron-icon ${isCollapsed ? 'collapsed' : ''}`} 
                  size={20}
                />
              </button>
            </div>
          </div>
        )}

        {canCreateEscalation && !isMobile && (
          <div className="centralised-actions-row">
            <button
              className="halo-button add-escalation-btn"
              onClick={openAddEscalationModal}
            >
              + Request Support
            </button>
          </div>
        )}

        {/* Full-Fledged Stage Navigation Switcher Tray for Mobile Viewports */}
        {isMobile && (
          <nav className="centralised-stage-navigation-tray">
            <div className="centralised-stage-nav-container">
              {boardStages.map((stage) => {
                const count = myTasks.filter(t => t.stageId === stage.id).length;
                const isActive = activeBoardStageId === stage.id;
                
                return (
                  <button 
                    key={stage.id}
                    className={`centralised-stage-nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveBoardStageId(stage.id)}
                    style={{ '--stage-accent': stage.color }}
                  >
                    <div className="centralised-stage-icon-wrapper">
                      {stage.id === 'BACKLOG' && <IconClock size={14} />}
                      {stage.id === 'IN_PROGRESS' && <IconZap size={14} />}
                      {stage.id === 'REVIEW' && <IconEye size={14} />}
                      {stage.id === 'COMPLETED' && <IconCheck size={14} />}
                      {count > 0 && <span className="centralised-stage-badge-count">{count}</span>}
                    </div>
                    <span className="centralised-stage-nav-label">{stage.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {isMobile ? (
          <div className="centralised-board">
            {boardStages.map(stage => {
              const stageTasks = myTasks.filter(t => t.stageId === stage.id);
              const isColumnActive = activeBoardStageId === stage.id;
              
              if (!isColumnActive) return null;
              
              return (
                <div 
                  key={stage.id} 
                  className="centralised-column active" 
                  style={{ '--column-accent': stage.color }}
                >
                  <div className="column-header">
                    <span className="column-dot" style={{ backgroundColor: stage.color }} />
                    <span className="column-title">{stage.label}</span>
                    <span className="column-count">{stageTasks.length}</span>
                  </div>
                  
                  <div className="column-cards-container">
                    {stageTasks.length === 0 ? (
                      <div className="column-empty-state">
                        <span>No tasks in this stage</span>
                      </div>
                    ) : (
                      stageTasks.map(task => {
                        const { TaskTileComponent: DynTileComponent } = resolveVerticalComponents(task.verticalId, verticals);

                        return (
                          <div
                            key={task.id}
                            className={`task-card-container ${task.isSubTask ? 'is-subtask-render' : ''}`}
                          >
                            <TaskCard
                              task={task}
                              stage={stage}
                              canUpdate={canEditTask(task)}
                              canDelete={canUserDelete(task)}
                              canManageHierarchy={canManageHierarchy(task)}
                              canAddSubtask={canAddSubtask(task)}
                              canCloneTask={canCloneTask(task)}
                              updateTaskStage={updateTaskStage}

                              deleteTask={handleInternalDelete}
                              openEditModal={openEditModal}
                              onCloneTask={handleCloneTask}
                              openAddSubtaskModal={handleAddSubtask}
                              openSubmissionModal={openSubmissionModal}
                              handleApproveSubmission={handleApproveSubmission}
                              handleRejectClick={handleRejectClick}
                              onMoveToParent={handleMoveToParent}
                              onDuplicateMerge={setMergeTaskCluster}
                              STAGE_LIST={STAGE_LIST}
                              isSelected={false}
                              onSelect={() => {}}
                              currentUser={user}
                              tasks={tasks}
                              onPromote={handleMoveToParent}
                              onDrillDown={() => {}}
                              showHierarchy={permissions.canViewKanbanHierarchy !== false}
                              permissions={permissions}
                              isExpanded={expandedTaskId === task.id}
                              onToggleExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                            >
                              {DynTileComponent && (
                                <DynTileComponent
                                  task={task}
                                  stage={stage}
                                />
                              )}
                            </TaskCard>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`centralised-board-collapsible-wrapper ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="centralised-board-collapsible-content">
              <TaskListView
                tasks={myTasks}
                stageList={boardStages}
                activeVertical={null}
                canUpdate={permissions.canUpdate}
                canEditTask={canEditTask}
                canManageHierarchy={canManageHierarchy}
                canAddSubtask={canAddSubtask}
                canCloneTask={canCloneTask}
                canDelete={permissions.canDelete}

                updateTaskStage={updateTaskStage}
                deleteTask={handleInternalDelete}
                openEditModal={openEditModal}
                onCloneTask={handleCloneTask}
                openAddSubtaskModal={handleAddSubtask}
                openSubmissionModal={openSubmissionModal}
                onMoveToParent={handleMoveToParent}
                onDuplicateMerge={setMergeTaskCluster}
                TaskTileComponent={DynamicTaskTile}
                currentUser={user}
                canCreate={permissions.canCreate}
                permissions={permissions}
                handleApproveSubmission={handleApproveSubmission}
                handleRejectClick={handleRejectClick}
                expandedTaskId={expandedTaskId}
                setExpandedTaskId={setExpandedTaskId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CentralisedTaskBoard;
