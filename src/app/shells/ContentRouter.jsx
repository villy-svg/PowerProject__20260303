/**
 * ContentRouter.jsx
 *
 * Pure content routing component. Determines which page/vertical/management
 * view to render based on activeVertical. This is the exact same ternary
 * chain from the original App.jsx AppShell, extracted for clarity.
 *
 * This component NEVER renders chrome (sidebar, header, nav).
 * It only decides WHAT content to show.
 *
 * Skill compliance:
 * - development-best-practices §4 Component Architecture
 * - development-best-practices §10 Service & Data Fetching Layer
 */

import React from 'react';

// Components
import VerticalWorkspace from '../../components/workspaces/VerticalWorkspace';
import ExecutiveSummary from '../../components/dashboard/ExecutiveSummary';
import Configuration from '../../components/workspaces/Configuration';
import UserRoleManagement from '../../components/users/UserRoleManagement';
import UserManagement from '../../components/users/UserManagement';
import TutorialHub from '../../features/tutorials/TutorialHub';

// Vertical Management Pages
import {
  HubManagement, HubFunctionManagement, DailyTasksManagement,
} from '../../verticals/ChargingHubs';
import {
  EmployeeManagement, DepartmentManagement, EmployeeRoleManagement,
  EmployeeRulesBoard, EmployeeAttendanceBoard, RuleManagement, AttendanceSelfService,
} from '../../verticals/Employees';
import {
  ClientManagement, ClientCategoryManagement, ClientBillingModelManagement, ClientServiceManagement,
} from '../../verticals/Clients';
import { DataManagerWorkspace } from '../../verticals/DataManager';
import { LeaveDashboard } from '../../features/LeaveManagement/components/LeaveDashboard';

// Contexts
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTaskBoard } from '../contexts/TaskBoardContext';
import { useAuth } from '../contexts/AuthContext';

// Registry
import { resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget } from '../../registry/verticalRegistry';

const ContentRouter = ({
  verticals,
  verticalList,
  permissions,
  rolePermissions,
  setRolePermissions,
}) => {
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen,
    isSubSidebarOpen, setIsSubSidebarOpen,
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  const {
    tasks, setTasks, tasksLoading, fetchTasks,
    activeTasks, activeAddTask, activeUpdateTask,
    activeUpdateTaskStage, activeBulkUpdateTasks, activeDeleteTask,
  } = useTaskBoard();

  const { user } = useAuth();

  // Resolve vertical-specific components
  const { SidebarComponent, TaskFormComponent, TaskTileComponent } =
    resolveVerticalComponents(activeVertical, verticals);
  const { label: workspaceLabel, boardLabel: workspaceBoardLabel } =
    resolveVerticalLabels(activeVertical, verticals);
  const headerClickTarget =
    resolveHeaderClickTarget(activeVertical, verticals, permissions);

  // Helper for BottomNav overlay toggle
  const onShowBottomNav = () => setShowBottomNavOverlay(prev => !prev);

  if (!activeVertical) {
    return (
      <ExecutiveSummary
        tasks={tasks}
        user={user}
        permissions={permissions}
        verticals={verticals}
        verticalList={verticalList}
        loading={tasksLoading}
        updateTaskStage={activeUpdateTaskStage}
      />
    );
  }

  if (activeVertical === 'configuration') {
    return (
      <Configuration
        tasks={tasks}
        setTasks={setTasks}
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        verticals={verticals}
        verticalList={verticalList}
      />
    );
  }

  if (activeVertical === 'role_management') {
    return (
      <UserRoleManagement
        permissions={rolePermissions}
        setPermissions={setRolePermissions}
        onBack={() => setActiveVertical('configuration')}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'user_management') {
    return (
      <UserManagement
        currentUser={user}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'hub_management') {
    return (
      <HubManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'hub_function_management') {
    return (
      <HubFunctionManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'department_management') {
    return (
      <DepartmentManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'employee_role_management') {
    return (
      <EmployeeRoleManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'rule_management') {
    return (
      <RuleManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_category_management') {
    return (
      <ClientCategoryManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_service_management') {
    return (
      <ClientServiceManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_billing_model_management') {
    return (
      <ClientBillingModelManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }


  if (activeVertical === 'tutorial') {
    return (
      <TutorialHub
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  // Default: VerticalWorkspace (task board view)
  return (
    <VerticalWorkspace
      label={workspaceLabel}
      boardLabel={workspaceBoardLabel}
      activeVertical={activeVertical}
      tasks={activeTasks}
      setTasks={setTasks}
      addTask={activeAddTask}
      actualSetTasks={setTasks}
      refreshTasks={fetchTasks}
      updateTask={activeUpdateTask}
      bulkUpdateTasks={activeBulkUpdateTasks}
      deleteTask={activeDeleteTask}
      updateTaskStage={activeUpdateTaskStage}
      isSubSidebarOpen={isSubSidebarOpen}
      setIsSubSidebarOpen={setIsSubSidebarOpen}
      isMainSidebarOpen={isSidebarOpen}
      setActiveVertical={setActiveVertical}
      onShowBottomNav={onShowBottomNav}
      SidebarComponent={SidebarComponent}
      TaskFormComponent={TaskFormComponent}
      TaskTileComponent={TaskTileComponent}
      onHeaderClick={headerClickTarget ? () => setActiveVertical(headerClickTarget) : null}
      user={user}
      permissions={permissions}
      verticals={verticals}
    >
      {activeVertical === verticals.EMPLOYEES?.id && (
        <EmployeeManagement 
          user={user} 
          permissions={permissions} 
          tasks={tasks.filter(t => t.verticalId === verticals.EMPLOYEES?.id)} 
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}
      {activeVertical === 'employee_rules_board' && (
        <EmployeeRulesBoard
          user={user}
          permissions={permissions}
          setActiveVertical={setActiveVertical}
          onShowBottomNav={onShowBottomNav}
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}
      {activeVertical === 'employee_attendance_board' && (
        <EmployeeAttendanceBoard
          user={user}
          permissions={permissions}
          setActiveVertical={setActiveVertical}
          onShowBottomNav={onShowBottomNav}
          isSubSidebarOpen={isSubSidebarOpen}
          setIsSubSidebarOpen={setIsSubSidebarOpen}
          SidebarComponent={SidebarComponent}
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}
      {activeVertical === 'employee_leave_wallet' && (
        <LeaveDashboard
          userId={user?.employeeId}
          managerId={user?.managerId}
          user={user}
          permissions={permissions}
          setActiveVertical={setActiveVertical}
          onShowBottomNav={onShowBottomNav}
          isSubSidebarOpen={isSubSidebarOpen}
          setIsSubSidebarOpen={setIsSubSidebarOpen}
          SidebarComponent={SidebarComponent}
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}
      {activeVertical === 'attendance_self_service' && (
        <AttendanceSelfService
          user={user}
          permissions={permissions}
          setActiveVertical={setActiveVertical}
          onShowBottomNav={onShowBottomNav}
          isSubSidebarOpen={isSubSidebarOpen}
          setIsSubSidebarOpen={setIsSubSidebarOpen}
          SidebarComponent={SidebarComponent}
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}

      {activeVertical === verticals.CLIENTS?.id && (
        <ClientManagement 
          user={user} 
          permissions={permissions} 
          tasks={tasks.filter(t => t.verticalId === verticals.CLIENTS?.id)} 
          verticals={verticals}
          activeVertical={activeVertical}
        />
      )}
      {(activeVertical === verticals.DATA_MANAGER?.id || activeVertical === 'model_verification_board') && (
        <DataManagerWorkspace key={activeVertical} user={user} permissions={permissions} activeVertical={activeVertical} />
      )}
      {activeVertical === 'daily_task_templates' && (
        <DailyTasksManagement permissions={permissions} refreshTasks={fetchTasks} currentUser={user} />
      )}
    </VerticalWorkspace>
  );
};

export default ContentRouter;
