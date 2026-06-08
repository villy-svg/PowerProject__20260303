import React, { useState } from 'react';
import { hierarchyService } from '../services/rules/hierarchyService';
import { useIsMobile } from '../hooks/useIsMobile';
import { IconEye, IconBoards, IconZap, IconBulb, IconWarning } from './Icons';
import { taskUtils } from '../utils/taskUtils';
import { useMobileLongPress } from '../app/contexts/MobileLongPressContext';
import './ExecutiveSummary.css';

// Core Sub-Components
import ExecutiveMetricsSection from './ExecutiveMetricsSection';
import CentralisedTaskBoard from './CentralisedTaskBoard';
import HomeEscalationsBoard from './HomeEscalationsBoard';
import WorkspaceModals from './WorkspaceModals';
import { useAppNavigation } from '../app/contexts/AppNavigationContext';
import powerLogo from '../assets/logo.svg';
import SandboxManagerModal from './SandboxManagerModal';

import { updateSubmissionStatus, submitProofOfWork } from '../services/tasks/submissionService';
import { cloneUtils } from '../utils/cloneUtils';
import { supabase } from '../services/core/supabaseClient';
import { useTaskBoard } from '../app/contexts/TaskBoardContext';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
import { useRBAC } from '../hooks/useRBAC';
import { useAuth } from '../app/contexts/AuthContext';
import UserProfile from './UserProfile';

/**
 * ExecutiveSummary Component
 * Displays task aggregates and personal Kanban workspace based on permissions.
 * Serves as the lightweight Orchestrator / Container Component.
 */
const ExecutiveSummary = ({ tasks = [], user, permissions = {}, verticals = {}, verticalList = [], loading = false, updateTaskStage }) => {
  const { isMobile } = useIsMobile();
  const { bindLongPress } = useMobileLongPress();
  const { activeVertical, setActiveVertical, setIsSidebarOpen } = useAppNavigation();
  const [activeView, setActiveView] = useState('centralised_task_view'); // Option 1 by default
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const {
    realUser,
    impersonatedUser,
    impersonationUsers,
    handleImpersonate,
    handleLogout
  } = useAuth();
  const isBypassActive = import.meta.env.DEV && import.meta.env.VITE_OFFLINE_BYPASS === 'true';

  const escalationPermissions = useRBAC(user, 'escalation_tasks', verticals);
  const openAddEscalationModal = () => {
    setEditingTask({ verticalId: 'escalation_tasks', priority: 'High' });
    setIsModalOpen(true);
  };


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
        const targetVerticalId = parentTask ? parentTask.verticalId : (editingTask?.verticalId || 'CHARGING_HUBS');
        
        const { files, ...taskPayload } = formData;
        const newTask = {
          text: taskPayload.text,
          verticalId: targetVerticalId,
          stageId: 'BACKLOG',
          parentTask: editingTask?.parentTask || null,
          isSubTask: !!editingTask?.parentTask,
          priority: taskPayload.priority || 'Medium',
          assigned_to: taskPayload.assigned_to || [],
          createdBy: user?.id,
          ...taskPayload
        };
        const createdTask = await addTask(newTask);

        const primaryTask = Array.isArray(createdTask) ? createdTask[0] : createdTask;
        const targetTaskId = primaryTask?.id;

        if (files && files.length > 0 && targetTaskId) {
          await submitProofOfWork({
            taskId: targetTaskId,
            userId: user?.id,
            comment: taskPayload.description || `Attached photos during task creation.`,
            files,
            moveToReview: false
          });
        }
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

  const handleRejectClick = (taskId, submissionId, taskText) => {
    setRejectionModalState({ isOpen: true, taskId, submissionId, taskText });
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

  // Hierarchy organizational filtering rules
  const hierarchyFiltered = hierarchyService.filterTasksByHierarchy(user, tasks, null, verticals, permissions);
  const hasGlobalScope = permissions.scope === 'global';
  const visibleTasks = hasGlobalScope 
    ? hierarchyFiltered 
    : hierarchyFiltered.filter(t => user?.assignedVerticals?.includes(t.verticalId));

  const topLevelVisibleCount = visibleTasks.filter(t => !t.parentTask).length;

  const myTasks = tasks.filter(t => taskUtils.isAssignee(t, user) && t.stageId !== 'COMPLETED');
  const hubId = verticals?.CHARGING_HUBS?.id || 'CHARGING_HUBS';

  // isCreator: the current user raised this task (created_by or createdBy field)
  const isCreator = (t) =>
    (t.created_by && t.created_by === user?.id) ||
    (t.createdBy && t.createdBy === user?.id);

  // escalationTasks: tasks shown in Team Support panel.
  // Includes tasks the user is ASSIGNED to OR tasks the user CREATED,
  // so creators can always track tickets they raised regardless of assignment.
  const escalationTasks = tasks.filter(t =>
    t.stageId !== 'COMPLETED' && (
      t.verticalId === 'escalation_tasks' ||
      ((t.verticalId === hubId || t.verticalId === 'CHARGING_HUBS') &&
       (t.priority === 'High' || t.priority === 'Urgent' || (Array.isArray(t.task_board) && t.task_board.includes('Escalations'))))
    ) && (
      taskUtils.isAssignee(t, user) || isCreator(t)
    )
  );
  const regularMyTasks = myTasks.filter(t => !escalationTasks.some(et => et.id === t.id));
  const hasEscalations = escalationTasks.length > 0;

  // Auto-switch away from escalations if they disappear
  React.useEffect(() => {
    if (!hasEscalations && activeView === 'escalations') {
      setActiveView('centralised_task_view');
    }
  }, [hasEscalations, activeView]);

  // Reset scroll position to hide stage-navigation-tray behind sticky header switcher by default
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const scrollContainer = document.querySelector('.home-summary-view');
      if (scrollContainer) {
        if (activeView === 'escalations') {
          scrollContainer.scrollTop = 76; // Height of stage switcher tray (68px + 8px margin)
        } else if (activeView === 'centralised_task_view') {
          scrollContainer.scrollTop = 54; // Height of centralized switcher tray (46px + 8px margin)
        } else {
          scrollContainer.scrollTop = 0;
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [activeView]);

  return (
    <div className="home-summary-view">
      {/* Mobile Sticky Header, Spacer, and Switcher Container */}
      {isMobile && (
        <div className="mobile-header-switcher-sticky-container">
          <header className="mobile-top-header-bar">
            {/* Tutorials Button (Icon Only, Top Left) */}
            <button 
              className={`halo-button mobile-header-tutorial-btn ${activeVertical === 'tutorial' ? 'active' : ''}`}
              onClick={() => setActiveVertical('tutorial')}
              title="Tutorials"
            >
              <IconBulb size={14} />
            </button>

            {/* Sandbox Button (Offline Bypass — Icon Only) */}
            {isBypassActive && (
              <button 
                className="halo-button mobile-header-sandbox-btn"
                onClick={() => setIsSandboxOpen(true)}
                title="Sandbox Active"
              >
                <IconWarning size={14} style={{ color: 'var(--brand-yellow)' }} />
              </button>
            )}

            {/* Brand Title */}
            <h1 className="brand-title-centered">PowerProject</h1>

            {/* Profile Button (Top Right) */}
            <div className="mobile-header-profile-container">
              <UserProfile 
                user={user} 
                onConfigClick={() => setActiveVertical('configuration')} 
                onLogout={handleLogout} 
                realUser={realUser}
                impersonatedUser={impersonatedUser}
                impersonationUsers={impersonationUsers}
                onImpersonate={handleImpersonate}
              />
            </div>
          </header>

          {/* Spacing Container */}
          <div className="mobile-header-switcher-spacer"></div>

          {/* Mobile-Only Summary View Navigation Switcher Tray */}
          <nav className="summary-navigation-tray">
            <div className="summary-nav-container">
              {hasEscalations && (
                <button
                  className={`summary-nav-item stage-red ${activeView === 'escalations' ? 'active' : ''}`}
                  onClick={() => setActiveView('escalations')}
                  {...bindLongPress("Team Support has all the requests and support tickets raised by all the members of PowerPod\n\nಪವರ್ಪಾಡ್ನ ಎಲ್ಲಾ ಸದಸ್ಯರು ಎತ್ತಿರುವ ಎಲ್ಲಾ ವಿನಂತಿಗಳು ಮತ್ತು ಬೆಂಬಲ ಟಿಕೆಟ್ಗಳನ್ನು ಟೀಮ್ ಸಪೋರ್ಟ್ ಹೊಂದಿದೆ.")}
                >
                  <div className="summary-icon-wrapper">
                    <IconZap size={14} />
                    <span className="summary-badge-count">{escalationTasks.length}</span>
                  </div>
                  <span className="summary-nav-label">Team Support</span>
                </button>
              )}
               <button
                className={`summary-nav-item stage-green ${activeView === 'centralised_task_view' ? 'active' : ''}`}
                onClick={() => setActiveView('centralised_task_view')}
                {...bindLongPress("Centralized Tasks workspace has all active tasks assigned to you by your team and managers at PowerPod.\n\nಕೇಂದ್ರೀಕೃತ ಕಾರ್ಯಗಳ ಕಾರ್ಯಸ್ಥಳವು ನಿಮ್ಮ ತಂಡ ಮತ್ತು ಪವರ್ಪಾಡ್ನಲ್ಲಿ ವ್ಯವಸ್ಥಾಪಕರು ನಿಮಗೆ ನಿಯೋಜಿಸಿದ ಎಲ್ಲಾ ಸಕ್ರಿಯ ಕಾರ್ಯಗಳನ್ನು ಹೊಂದಿದೆ.")}
              >
                <div className="summary-icon-wrapper">
                  <IconBoards size={14} />
                  {regularMyTasks.length > 0 && (
                    <span className="summary-badge-count">{regularMyTasks.length}</span>
                  )}
                </div>
                <span className="summary-nav-label">Centralised Tasks</span>
              </button>
              <button
                className={`summary-nav-item stage-slate ${activeView === 'executive_summary' ? 'active' : ''}`}
                onClick={() => setActiveView('executive_summary')}
                {...bindLongPress("Executive Summary gives you summary of all tasks related to you or your team and the stage in which they are.\n\nಕಾರ್ಯನಿರ್ವಾಹಕ ಸಾರಾಂಶವು ನಿಮಗೆ ಅಥವಾ ನಿಮ್ಮ ತಂಡಕ್ಕೆ ಸಂಬಂಧಿಸಿದ ಎಲ್ಲಾ ಕಾರ್ಯಗಳ ಸಾರಾಂಶವನ್ನು ಮತ್ತು ಅವು ಯಾವ ಹಂತದಲ್ಲಿವೆ ಎಂಬುದನ್ನು ನೀಡುತ್ತದೆ.")}
              >
                <div className="summary-icon-wrapper">
                  <IconEye size={14} />
                  {topLevelVisibleCount > 0 && (
                    <span className="summary-badge-count">{topLevelVisibleCount}</span>
                  )}
                </div>
                <span className="summary-nav-label">Executive Summary</span>
              </button>
              {!!user && (
                <button
                  className="summary-nav-item stage-mint"
                  onClick={openAddEscalationModal}
                >
                  <div className="summary-icon-wrapper">
                    <span className="request-support-plus">+</span>
                  </div>
                  <span className="summary-nav-label">Request Support</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Welcome Header & Tutorial Quick Start (Desktop Only) */}
      {!isMobile && (
        <div className="home-dashboard-header">
          <div className="welcome-greeting">
            <h2>Welcome back, <span className="highlight-name">{user?.name || 'User'}</span></h2>
            <p className="welcome-subtitle">Manage your escalations and centralized tasks in a unified workspace.</p>
          </div>
        </div>
      )}

      {/* 0. Escalations Section */}
      {/* tasks prop: union of tasks the user is assigned to OR created,
          so creators can always see the tickets they raised here. */}
      {hasEscalations && (!isMobile || activeView === 'escalations') && (
        <HomeEscalationsBoard
          tasks={escalationTasks}
          user={user}
          permissions={permissions}
          verticals={verticals}
          verticalList={verticalList}
          isMobile={isMobile}
          updateTaskStage={updateTaskStage}
          canEditTask={canEditTask}
          canUserDelete={canUserDelete}
          canManageHierarchy={canManageHierarchy}
          canAddSubtask={canAddSubtask}
          canCloneTask={canCloneTask}
          handleInternalDelete={handleInternalDelete}
          openEditModal={openEditModal}
          handleCloneTask={handleCloneTask}
          handleAddSubtask={handleAddSubtask}
          openSubmissionModal={openSubmissionModal}
          handleApproveSubmission={handleApproveSubmission}
          handleRejectClick={handleRejectClick}
          handleMoveToParent={handleMoveToParent}
          setMergeTaskCluster={setMergeTaskCluster}
          expandedTaskId={expandedTaskId}
          setExpandedTaskId={setExpandedTaskId}
          canCreateEscalation={!!user}
          openAddEscalationModal={openAddEscalationModal}
          defaultCollapsed={false}
        />
      )}

      {/* 1. Centralised Task View Section */}
      {(!isMobile || activeView === 'centralised_task_view') && (
        <CentralisedTaskBoard
          title="Centralised Task View"
          description={"Centralized Tasks workspace has all active tasks assigned to you by your team and managers at PowerPod.\n\nಕೇಂದ್ರೀಕೃತ ಕಾರ್ಯಗಳ ಕಾರ್ಯಸ್ಥಳವು ನಿಮ್ಮ ತಂಡ ಮತ್ತು ಪವರ್ಪಾಡ್ನಲ್ಲಿ ವ್ಯವಸ್ಥಾಪಕರು ನಿಮಗೆ ನಿಯೋಜಿಸಿದ ಎಲ್ಲಾ ಸಕ್ರಿಯ ಕಾರ್ಯಗಳನ್ನು ಹೊಂದಿದೆ."}
          tasks={tasks.filter(t => 
            t.stageId !== 'COMPLETED' &&
            t.verticalId !== 'escalation_tasks' && 
            !((t.verticalId === (verticals?.CHARGING_HUBS?.id || 'CHARGING_HUBS') || t.verticalId === 'CHARGING_HUBS') && 
              (t.priority === 'High' || t.priority === 'Urgent' || (Array.isArray(t.task_board) && t.task_board.includes('Escalations'))))
          )}
          user={user}
          permissions={permissions}
          verticals={verticals}
          verticalList={verticalList}
          isMobile={isMobile}
          updateTaskStage={updateTaskStage}
          canEditTask={canEditTask}
          canUserDelete={canUserDelete}
          canManageHierarchy={canManageHierarchy}
          canAddSubtask={canAddSubtask}
          canCloneTask={canCloneTask}
          handleInternalDelete={handleInternalDelete}
          openEditModal={openEditModal}
          handleCloneTask={handleCloneTask}
          handleAddSubtask={handleAddSubtask}
          openSubmissionModal={openSubmissionModal}
          handleApproveSubmission={handleApproveSubmission}
          handleRejectClick={handleRejectClick}
          handleMoveToParent={handleMoveToParent}
          setMergeTaskCluster={setMergeTaskCluster}
          expandedTaskId={expandedTaskId}
          setExpandedTaskId={setExpandedTaskId}
          canCreateEscalation={!!user}
          openAddEscalationModal={openAddEscalationModal}
          defaultCollapsed={true}
        />
      )}

      {/* 2. Executive Summary Grid Metrics Section */}
      {(!isMobile || activeView === 'executive_summary') && (
        <ExecutiveMetricsSection
          visibleTasks={visibleTasks}
          verticalList={verticalList}
          loading={loading}
          isMobile={isMobile}
        />
      )}



      {/* Shared Consolidation Workspace Modals */}
      <WorkspaceModals
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        editingTask={editingTask}
        setEditingTask={setEditingTask}
        saving={saving}
        user={user}
        permissions={permissions}
        tasks={tasks}
        verticals={verticals}
        handleSaveTask={handleSaveTask}
        updateTaskStage={updateTaskStage}
        fetchTasks={fetchTasks}
        submissionTask={submissionTask}
        closeSubmissionModal={closeSubmissionModal}
        openSubmissionModal={openSubmissionModal}
        rejectionModalState={rejectionModalState}
        setRejectionModalState={setRejectionModalState}
        submitRejection={submitRejection}
        mergeTaskCluster={mergeTaskCluster}
        setMergeTaskCluster={setMergeTaskCluster}
        executeMerge={executeMerge}
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
      />
      {isMobile && (
        <SandboxManagerModal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} />
      )}
    </div>
  );
};

export default ExecutiveSummary;