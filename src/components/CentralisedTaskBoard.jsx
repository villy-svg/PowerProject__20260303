import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';
import { taskUtils } from '../utils/taskUtils';
import { resolveVerticalComponents } from '../registry/verticalRegistry';
import TaskCard from './TaskCard';
import { IconClock, IconZap, IconEye, IconCheck } from './Icons';
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
  setExpandedTaskId
}) => {
  const [activeBoardStageId, setActiveBoardStageId] = useState('BACKLOG');
  
  const myTasks = tasks.filter(t => taskUtils.isAssignee(t, user));
  const boardStages = STAGE_LIST.filter(s => s.id !== 'DEPRIORITIZED');

  if (myTasks.length === 0) {
    return (
      <div className="centralised-task-view-wrapper animate-fade-in">
        <div className="centralised-task-view">
          <div className="summary-header secondary-header">
            <h2>Centralised Task View</h2>
          </div>
          <p className="section-description">A unified, interactive workspace showing all active tasks assigned to you across all verticals.</p>
          <div className="centralised-board-empty">
            <div className="empty-glow" />
            <span className="empty-icon">✓</span>
            <h3>All Caught Up!</h3>
            <p>You have no active tasks assigned to you right now. Enjoy your clear queue!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="centralised-task-view-wrapper animate-fade-in">
      <div className="centralised-task-view">
        <div className="summary-header secondary-header">
          <h2>Centralised Task View</h2>
        </div>
        <p className="section-description">A unified, interactive workspace showing all active tasks assigned to you across all verticals.</p>

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
                      {stage.id === 'BACKLOG' && <IconClock size={20} />}
                      {stage.id === 'IN_PROGRESS' && <IconZap size={18} />}
                      {stage.id === 'REVIEW' && <IconEye size={20} />}
                      {stage.id === 'COMPLETED' && <IconCheck size={20} />}
                      {count > 0 && <span className="centralised-stage-badge-count">{count}</span>}
                    </div>
                    <span className="centralised-stage-nav-label">{stage.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <div className="centralised-board">
          {boardStages.map(stage => {
            const stageTasks = myTasks.filter(t => t.stageId === stage.id);
            const isColumnActive = !isMobile || activeBoardStageId === stage.id;
            
            if (!isColumnActive) return null;
            
            return (
              <div 
                key={stage.id} 
                className={`centralised-column ${isMobile ? 'active' : ''}`} 
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
      </div>
    </div>
  );
};

export default CentralisedTaskBoard;
