import React, { useState } from 'react';
import { STAGE_LIST } from '../constants/stages';
import { VERTICAL_LIST } from '../constants/verticals';
import { hierarchyService } from '../services/rules/hierarchyService';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAppNavigation } from '../app/contexts/AppNavigationContext';
import { IconPeople, IconSettings, IconArrowLeft, IconArrowRight, IconBoards, IconEye, IconClock, IconZap, IconCheck } from './Icons';
import { taskUtils } from '../utils/taskUtils';
import './ExecutiveSummary.css';

// Parity Imports for full task card actions & modals
import TaskCard from './TaskCard';
import TaskActionModals from './TaskActionModals';
import SubmissionModal from './SubmissionModal';
import RejectionModal from './RejectionModal';
import { resolveVerticalComponents } from '../registry/verticalRegistry';
import { updateSubmissionStatus } from '../services/tasks/submissionService';
import { cloneUtils } from '../utils/cloneUtils';
import { supabase } from '../services/core/supabaseClient';
import { useTaskBoard } from '../app/contexts/TaskBoardContext';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';

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

  // Task board context hooks
  const { 
    addTask, 
    updateTask, 
    deleteTask: rawDeleteTask, 
    fetchTasks,
    bulkUpdateTasks
  } = useTaskBoard();

  // Modal and interaction states
  const [editingTask, setEditingTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submissionTask, setSubmissionTask] = useState(null);
  const [rejectionModalState, setRejectionModalState] = useState({ isOpen: false, taskId: null, submissionId: null, taskText: '' });
  const [saving, setSaving] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [mergeTaskCluster, setMergeTaskCluster] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Dynamic CRUD permission resolver per vertical
  const getTaskCRUD = (task) => {
    if (!task) return { canUserCreate: false, canUserUpdate: false, canUserDelete: false, hasVerticalAccess: false };
    const rootVerticalId = task.verticalId;
    const hasVerticalAccess = permissions.scope === 'global' || user?.assignedVerticals?.includes(rootVerticalId);

    let featureBaseName = '';
    if (rootVerticalId === 'CHARGING_HUBS') featureBaseName = 'HubTasks';
    else if (rootVerticalId === 'EMPLOYEES') featureBaseName = 'EmployeeTasks';
    else if (rootVerticalId === 'CLIENTS') featureBaseName = 'ClientTasks';

    const fCanCreate = (featureBaseName && permissions[`canCreate${featureBaseName}`] !== undefined)
      ? permissions[`canCreate${featureBaseName}`]
      : permissions.canCreate;

    const fCanUpdate = (featureBaseName && permissions[`canUpdate${featureBaseName}`] !== undefined)
      ? permissions[`canUpdate${featureBaseName}`]
      : permissions.canUpdate;

    const fCanDelete = (featureBaseName && permissions[`canDelete${featureBaseName}`] !== undefined)
      ? permissions[`canDelete${featureBaseName}`]
      : permissions.canDelete;

    return {
      canUserCreate: fCanCreate && hasVerticalAccess,
      canUserUpdate: fCanUpdate && hasVerticalAccess,
      canUserDelete: fCanDelete && hasVerticalAccess,
      hasVerticalAccess
    };
  };

  // Capability checks matching useTaskPermissions
  const canEditTask = (task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;

    const { canUserUpdate } = getTaskCRUD(task);
    if (canUserUpdate) return true;

    const isCreator = (task.createdBy || task.created_by) === user?.id;
    const assignedTo = task.assigned_to || [];
    const isAssignee = (user?.employeeId && assignedTo.includes(user.employeeId)) || (user?.id && assignedTo.includes(user.id));

    if (['contributor', 'viewer'].includes(permissions.level) && (isCreator || isAssignee)) {
      return true;
    }
    return false;
  };

  const canUserDelete = (task) => {
    return getTaskCRUD(task).canUserDelete;
  };

  const canManageHierarchy = (task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;
    if (user?.seniority > MANAGER_SENIORITY_THRESHOLD) return true;
    const isCreator = (task.createdBy || task.created_by) === user?.id;
    return isCreator;
  };

  const canAddSubtask = (task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;

    const { canUserCreate } = getTaskCRUD(task);
    if (!canUserCreate) return false;

    if (taskUtils.isManager(user)) return true;
    if (taskUtils.isCreator(task, user)) return true;
    return taskUtils.isAssignee(task, user);
  };

  const canCloneTask = (task) => {
    if (!task || task.isContextOnly) return false;
    const { canUserCreate } = getTaskCRUD(task);
    if (!canUserCreate) return false;
    if (taskUtils.isManager(user)) return true;
    return canEditTask(task);
  };

  // Local CRUD and RPC Handlers
  const handleSaveTask = async (formData) => {
    const isEditing = !!(editingTask && editingTask.id);
    if (!formData || (!isEditing && !formData.text)) {
      console.warn('[ExecutiveSummary] Blocked invalid handleSaveTask call:', { isEditing, formData });
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateTask({ ...editingTask, ...formData });
      } else {
        const parentTask = editingTask?.parentTask ? tasks.find(t => t.id === editingTask.parentTask) : null;
        const targetVerticalId = parentTask ? parentTask.verticalId : 'CHARGING_HUBS';
        const newTask = {
          text: formData.text,
          verticalId: targetVerticalId,
          stageId: 'BACKLOG',
          parentTask: editingTask?.parentTask || null,
          isSubTask: !!editingTask?.parentTask,
          priority: formData.priority || 'Medium',
          assigned_to: formData.assigned_to || [],
          createdBy: user?.id,
          ...formData
        };
        await addTask(newTask);
      }
      setIsModalOpen(false);
      setEditingTask(null);
      if (fetchTasks) fetchTasks(false);
    } catch (err) {
      alert(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleInternalDelete = (taskId) => {
    if (window.confirm("Delete this task permanently?")) {
      setSaving(true);
      rawDeleteTask(taskId)
        .then(() => {
          if (fetchTasks) fetchTasks(false);
        })
        .catch((err) => alert(`Delete failed: ${err.message}`))
        .finally(() => setSaving(false));
    }
  };

  const handleMoveToParent = async (childId, parentId) => {
    if (childId === parentId) return;
    const task = tasks.find(t => t.id === childId);
    if (!task || task.isContextOnly) return;
    if (task.parentTask === (parentId ?? null)) return;

    setSaving(true);
    try {
      const { error } = await supabase.rpc('rpc_promote_task', {
        p_task_id: childId,
        p_parent_id: parentId ?? null,
      });
      if (error) throw error;
      if (fetchTasks) fetchTasks(false);
    } catch (err) {
      alert(`Failed to promote task: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCloneTask = (task) => {
    if (!task || task.isContextOnly) return;
    const cloneData = cloneUtils.prepareClone(task, { titleField: 'text' });
    setEditingTask(cloneData);
    setIsModalOpen(true);
  };

  const handleAddSubtask = (parentId) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!parentTask) {
      alert("Error: Parent task node not found.");
      return;
    }

    if (!canAddSubtask(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks under this task.");
      return;
    }

    const sanitizedMetadata = { ...(parentTask.metadata || {}) };
    delete sanitizedMetadata.fan_out;
    delete sanitizedMetadata.is_fan_out_parent;

    setEditingTask({
      parentTask: parentId,
      city: parentTask.city || '',
      hub_ids: parentTask.hub_ids || (parentTask.hub_id ? [parentTask.hub_id] : []),
      hub_id: parentTask.hub_id || null,
      function: parentTask.function || '',
      assigned_to: [],
      priority: parentTask.priority || 'Medium',
      assigned_client_id: parentTask.assigned_client_id || '',
      metadata: sanitizedMetadata,
      verticalId: parentTask.verticalId
    });

    setIsModalOpen(true);
  };

  const handleApproveSubmission = async (taskId, submissionId) => {
    try {
      await updateSubmissionStatus(submissionId, 'approved');
      await updateTaskStage(taskId, 'COMPLETED');
      if (fetchTasks) fetchTasks(false);
    } catch (err) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const submitRejection = async (reason) => {
    try {
      await updateSubmissionStatus(rejectionModalState.submissionId, 'rejected', reason);
      await updateTaskStage(rejectionModalState.taskId, 'IN_PROGRESS');
      setRejectionModalState({ isOpen: false, taskId: null, submissionId: null, taskText: '' });
      if (fetchTasks) fetchTasks(false);
    } catch (err) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const executeMerge = async (primaryTaskId) => {
    const primaryTask = tasks.find(t => t.id === primaryTaskId);
    if (!primaryTask) return;
    const duplicates = tasks.filter(t =>
      t.id !== primaryTaskId &&
      t.text === primaryTask.text &&
      t.verticalId === primaryTask.verticalId &&
      t.parentTask === primaryTask.parentTask &&
      t.assigned_to === primaryTask.assigned_to
    );
    try {
      await bulkUpdateTasks(duplicates.map(t => t.id), { stage_id: 'DEPRIORITIZED' });
      setMergeTaskCluster(null);
      if (fetchTasks) fetchTasks(false);
    } catch (err) {
      alert(`Merge failed: ${err.message}`);
    }
  };

  const openSubmissionModal = (task) => setSubmissionTask(task);
  const closeSubmissionModal = () => setSubmissionTask(null);

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };
  
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
              style={{ '--stage-accent': 'var(--brand-green)' }}
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
              style={{ '--stage-accent': '#94a3b8' }}
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
                                      onDuplicateMerge={openEditModal}
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
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Dynamic Task Action Modals */}
      <TaskActionModals
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        saving={saving}
        activeVertical={editingTask?.verticalId || 'CHARGING_HUBS'}
        TaskFormComponent={editingTask?.verticalId ? resolveVerticalComponents(editingTask.verticalId, verticals).TaskFormComponent : null}
        handleSaveTask={handleSaveTask}
        user={user}
        permissions={permissions}
        tasks={tasks}
        rootVerticalId={editingTask?.verticalId}
        mergeTaskCluster={mergeTaskCluster}
        setMergeTaskCluster={setMergeTaskCluster}
        executeMerge={executeMerge}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
        onSubmissionReview={(subId, status) => {
          if (status === 'rejected' && editingTask) {
            updateTaskStage(editingTask.id, 'IN_PROGRESS');
          } else if (status === 'approved' && editingTask) {
            updateTaskStage(editingTask.id, 'COMPLETED');
          }
          setIsModalOpen(false);
          setEditingTask(null);
          if (fetchTasks) fetchTasks(false);
        }}
        openSubmissionModal={openSubmissionModal}
      />

      <SubmissionModal
        isOpen={!!submissionTask}
        onClose={closeSubmissionModal}
        task={submissionTask}
        user={user}
        onSubmitSuccess={(result) => {
          const taskId = submissionTask.id;
          closeSubmissionModal();
          updateTaskStage(taskId, 'REVIEW');
          if (fetchTasks) fetchTasks(false);
        }}
      />

      <RejectionModal
        isOpen={rejectionModalState.isOpen}
        onClose={() => setRejectionModalState({ isOpen: false, taskId: null, submissionId: null, taskText: '' })}
        task={{ text: rejectionModalState.taskText }}
        onSubmit={submitRejection}
      />
    </div>
  );
};

export default ExecutiveSummary;