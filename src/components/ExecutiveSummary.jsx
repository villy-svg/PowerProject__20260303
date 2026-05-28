import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';
import { hierarchyService } from '../services/rules/hierarchyService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAppNavigation } from '../app/contexts/AppNavigationContext';
import { IconPeople, IconSettings, IconArrowLeft, IconArrowRight, IconBoards, IconEye, IconClock, IconZap, IconCheck } from './Icons';
import { taskUtils } from '../utils/taskUtils';
import './ExecutiveSummary.css';

/**
 * ExecutiveSummary Component
 * Displays task aggregates based on user permissions.
 * Multi-Vertical Update: Aggregates data from all assigned verticals in the array.
 */
const ExecutiveSummary = ({ tasks = [], user, permissions = {}, verticals = {}, verticalList = [], loading = false, updateTaskStage }) => {
  const { isMobile } = useIsMobile();
  const [expandedStageId, setExpandedStageId] = useState(null);
  const { setActiveVertical } = useAppNavigation();
  const [activeView, setActiveView] = useState('centralised_task_view'); // Option 1 by default
  const [activeBoardStageId, setActiveBoardStageId] = useState('BACKLOG');
  
  /**
    * REFACTORED SCOPE LOGIC
    * 1. First, apply Hierarchy Rules (Seniority, Reportees, etc.)
    * 2. Then, restrict to Assigned Verticals (unless Global Scope)
    */
  const hierarchyFiltered = hierarchyService.filterTasksByHierarchy(user, tasks, null, verticals, permissions);

  const hasGlobalScope = permissions.scope === 'global';
  
  // Final visibility: respects both organizational hierarchy AND vertical access bounds
  const visibleTasks = hasGlobalScope 
    ? hierarchyFiltered 
    : hierarchyFiltered.filter(t => user?.assignedVerticals?.includes(t.verticalId));

  /**
   * ACCESSIBLE BREAKDOWN
   * Previously only master admins (global scope) saw the breakdown.
   * Now, anyone can see the breakdown of their own authorized tasks.
   */
  const showVerticalBreakdown = true;

  const canSeeConfig = permissions?.canAccessConfig;
  const showUserMgmt = permissions?.scope === 'global' && permissions?.canManageRoles;

  // Filter out the locked/unassigned verticals to show as "Coming Soon / Locked"
  const lockedVerticals = (verticalList.length > 0 ? verticalList : VERTICAL_LIST).filter(vertical => {
    const isAssigned = user?.assignedVerticals?.includes(vertical.id) || permissions?.scope === 'global';
    return vertical.locked || !isAssigned;
  });

  const myTasks = tasks.filter(t => taskUtils.isAssignee(t, user));

  return (
    <div className="home-summary-view">
      {/* Mobile-Only Summary View Navigation Switcher Tray */}
      {isMobile && (
        <nav className="summary-navigation-tray">
          <div className="summary-nav-container">
            <button
              className={`summary-nav-item ${activeView === 'centralised_task_view' ? 'active' : ''}`}
              onClick={() => setActiveView('centralised_task_view')}
            >
              <div className="summary-icon-wrapper">
                <IconBoards size={18} />
                {myTasks.length > 0 && (
                  <span className="summary-badge-count">{myTasks.length}</span>
                )}
              </div>
              <span className="summary-nav-label">Centralised Task View</span>
            </button>
            <button
              className={`summary-nav-item ${activeView === 'executive_summary' ? 'active' : ''}`}
              onClick={() => setActiveView('executive_summary')}
            >
              <div className="summary-icon-wrapper">
                <IconEye size={18} />
                {visibleTasks.length > 0 && (
                  <span className="summary-badge-count">{visibleTasks.length}</span>
                )}
              </div>
              <span className="summary-nav-label">Executive Summary</span>
            </button>
          </div>
        </nav>
      )}

      {/* 1. Executive Summary Grid Metrics Section */}
      {(!isMobile || activeView === 'executive_summary') && (
        <div className="executive-summary-section animate-fade-in">
          <div className="summary-header">
            <h2>Executive Summary</h2>
          </div>
          
          <div className="summary-grid">
            {STAGE_LIST.map((stage) => {
              // Calculate count based on the multi-vertical scoped visibleTasks
              const stageCount = visibleTasks.filter(t => t.stageId === stage.id).length;

              // Only calculate breakdown list if the user has visible tasks in this stage
              const activeVerticalsInStage = showVerticalBreakdown 
                ? (verticalList.length > 0 ? verticalList : VERTICAL_LIST).filter(v => 
                    visibleTasks.some(t => t.verticalId === v.id && t.stageId === stage.id)
                  )
                : [];

              const isExpanded = isMobile ? expandedStageId === stage.id : true;
              const showBreakdown = showVerticalBreakdown && stage.showInVerticalSummary && activeVerticalsInStage.length > 0 && isExpanded;

              const handleToggle = () => {
                if (!isMobile) return;
                setExpandedStageId(prev => prev === stage.id ? null : stage.id);
              };

              return (
                <div 
                  key={stage.id} 
                  className={`summary-column-group ${isMobile ? 'is-mobile' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                  style={{ '--stage-color': stage.color }}
                  onClick={handleToggle}
                >
                  <div className={`summary-card ${isMobile && activeVerticalsInStage.length > 0 ? 'is-tappable' : ''}`}>
                      <div className="summary-card-content">
                        <span className="summary-count">
                          {loading ? <span className="counting-placeholder">...</span> : stageCount}
                        </span>
                        <span className="summary-label">
                          {loading ? 'Calculating...' : stage.label}
                        </span>
                      </div>
                      {isMobile && activeVerticalsInStage.length > 0 && (
                        <div className={`expand-indicator ${isExpanded ? 'active' : ''}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      )}
                  </div>

                  {/* Breakdown list is gated by the scope permission AND expanded state on mobile */}
                  {showBreakdown && (
                    <div className="vertical-breakdown-list">
                      {activeVerticalsInStage.map((vertical) => {
                        const vCount = visibleTasks.filter(
                          (t) => t.verticalId === vertical.id && t.stageId === stage.id
                        ).length;

                        return (
                          <div key={vertical.id} className="vertical-mini-row">
                            <span className="v-mini-label">{vertical.label}</span>
                            <span className="v-mini-count">{vCount}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Centralised Task View Section */}
      {(!isMobile || activeView === 'centralised_task_view') && (
        <div className="centralised-task-view-wrapper animate-fade-in">
          <div className="centralised-task-view">
            <div className="summary-header secondary-header">
              <h2>Centralised Task View</h2>
            </div>
            <p className="section-description">A unified, interactive workspace showing all active tasks assigned to you across all verticals.</p>
            
            {(() => {
              const myTasks = tasks.filter(t => taskUtils.isAssignee(t, user));
              const boardStages = STAGE_LIST.filter(s => s.id !== 'DEPRIORITIZED');
              
              const getVerticalLabel = (verticalId) => {
                const vertical = (verticalList.length > 0 ? verticalList : VERTICAL_LIST).find(v => v.id === verticalId);
                return vertical ? vertical.label : verticalId;
              };

              const canMoveLeft = (task) => {
                const currentIndex = boardStages.findIndex(s => s.id === task.stageId);
                if (currentIndex <= 0) return false;
                const targetStageId = boardStages[currentIndex - 1].id;
                return taskUtils.canUserMoveTask(task, targetStageId, permissions, user);
              };

              const canMoveRight = (task) => {
                const currentIndex = boardStages.findIndex(s => s.id === task.stageId);
                if (currentIndex < 0 || currentIndex >= boardStages.length - 1) return false;
                const targetStageId = boardStages[currentIndex + 1].id;
                return taskUtils.canUserMoveTask(task, targetStageId, permissions, user);
              };

              const handleMoveLeft = (task) => {
                const currentIndex = boardStages.findIndex(s => s.id === task.stageId);
                if (currentIndex > 0) {
                  updateTaskStage(task.id, boardStages[currentIndex - 1].id);
                }
              };

              const handleMoveRight = (task) => {
                const currentIndex = boardStages.findIndex(s => s.id === task.stageId);
                if (currentIndex < boardStages.length - 1) {
                  updateTaskStage(task.id, boardStages[currentIndex + 1].id);
                }
              };

              if (myTasks.length === 0) {
                return (
                  <div className="centralised-board-empty">
                    <div className="empty-glow" />
                    <span className="empty-icon">✓</span>
                    <h3>All Caught Up!</h3>
                    <p>You have no active tasks assigned to you right now. Enjoy your clear queue!</p>
                  </div>
                );
              }

              return (
                <>
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
                                const verticalLabel = getVerticalLabel(task.verticalId);
                                const moveLeftAllowed = canMoveLeft(task);
                                const moveRightAllowed = canMoveRight(task);
                                
                                return (
                                  <div key={task.id} className="centralised-task-card" style={{ borderLeftColor: stage.color }}>
                                    <div className="card-top-row">
                                      <span className="vertical-meta-badge" title="Vertical Workspace">
                                        {verticalLabel}
                                      </span>
                                      {task.priority && (
                                        <span className={`card-priority priority-${task.priority.toLowerCase()}`}>
                                          {task.priority}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <h4 className="card-title" title={task.text}>{task.text}</h4>
                                    
                                    <div className="card-actions-row">
                                      {updateTaskStage ? (
                                        <>
                                          <button
                                            className="action-icon-btn"
                                            onClick={() => handleMoveLeft(task)}
                                            disabled={!moveLeftAllowed}
                                            title="Move Back"
                                          >
                                            <IconArrowLeft size={14} />
                                          </button>
                                          <button
                                            className="action-icon-btn"
                                            onClick={() => handleMoveRight(task)}
                                            disabled={!moveRightAllowed}
                                            title="Move Forward"
                                          >
                                            <IconArrowRight size={14} />
                                          </button>
                                        </>
                                      ) : (
                                        <span className="action-view-only" title="Interactivity disabled">View Only</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummary;