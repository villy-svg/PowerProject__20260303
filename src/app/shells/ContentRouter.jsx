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

import React, { Suspense, lazy } from 'react';

// Eagerly loaded: default landing view (and AttendanceSelfService, already bundled inside ExecutiveSummary)
import ExecutiveSummary from '../../components/dashboard/ExecutiveSummary';
import AttendanceSelfService from '../../verticals/Employees/attendance/AttendanceSelfService';

// Route-level code splitting: lazy-load secondary views directly from their module files
// (bypassing barrel exports so Rollup splits each view into its own chunk)
const VerticalWorkspace = lazy(() => import('../../components/workspaces/VerticalWorkspace'));
const Configuration = lazy(() => import('../../components/workspaces/Configuration'));
const UserRoleManagement = lazy(() => import('../../components/users/UserRoleManagement'));
const UserManagement = lazy(() => import('../../components/users/UserManagement'));
const TutorialHub = lazy(() => import('../../features/tutorials/TutorialHub'));

// Vertical Management Pages (lazy-loaded on navigation)
const HubManagement = lazy(() => import('../../verticals/ChargingHubs/HubManagement'));
const HubFunctionManagement = lazy(() => import('../../verticals/ChargingHubs/HubFunctionManagement'));
const DailyTasksManagement = lazy(() => import('../../verticals/ChargingHubs/DailyTasksManagement'));
const CleaningQRGenerator = lazy(() => import('../../verticals/ChargingHubs/CleaningQRGenerator'));

const EmployeeManagement = lazy(() => import('../../verticals/Employees/EmployeeManagement'));
const DepartmentManagement = lazy(() => import('../../verticals/Employees/DepartmentManagement'));
const EmployeeRoleManagement = lazy(() => import('../../verticals/Employees/EmployeeRoleManagement'));
const EmployeeRulesBoard = lazy(() => import('../../verticals/Employees/EmployeeRulesBoard'));
const EmployeeAttendanceBoard = lazy(() => import('../../verticals/Employees/EmployeeAttendanceBoard'));
const RuleManagement = lazy(() => import('../../verticals/Employees/RuleManagement'));

const ClientManagement = lazy(() => import('../../verticals/Clients/ClientManagement'));
const ClientCategoryManagement = lazy(() => import('../../verticals/Clients/ClientCategoryManagement'));
const ClientBillingModelManagement = lazy(() => import('../../verticals/Clients/ClientBillingModelManagement'));
const ClientServiceManagement = lazy(() => import('../../verticals/Clients/ClientServiceManagement'));

const DataManagerWorkspace = lazy(() => import('../../verticals/DataManager/DataManagerWorkspace'));
const LeaveDashboard = lazy(() =>
  import('../../features/LeaveManagement/components/LeaveDashboard').then((m) => ({
    default: m.LeaveDashboard,
  }))
);

/**
 * Guards lazy-loaded route chunks against stale-deploy 404s or network errors.
 * Resets automatically when `resetKey` (activeVertical) changes.
 */
class LazyRouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ContentRouter] Lazy route load failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="loading-screen-layout">
          <h2 className="error-heading">Unable to Load View</h2>
          <p className="error-message-text">
            A newer version of the app may be available or your connection dropped.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="halo-button error-logout-btn"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Contexts
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTaskBoard } from '../contexts/TaskBoardContext';
import { useAuth } from '../contexts/AuthContext';

// Registry
import {
  resolveVerticalComponents,
  resolveVerticalLabels,
  resolveHeaderClickTarget,
  resolveVerticalRootId,
} from '../../registry/verticalRegistry';
import { LOCKED_FEATURE_VIEWS } from '../../constants/verticalFeatures';

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

  // Guard against direct or stale navigation into any locked vertical or its sub-routes
  const resolvedRootId = activeVertical ? resolveVerticalRootId(activeVertical, verticals) : null;
  const isClientMgmtRoute =
    activeVertical === 'client_category_management' ||
    activeVertical === 'client_service_management' ||
    activeVertical === 'client_billing_model_management';
  const isLockedFeatureRoute = LOCKED_FEATURE_VIEWS.includes(activeVertical);
  const isLockedRoute = Boolean(
    (resolvedRootId && verticals?.[resolvedRootId]?.locked) ||
    (isClientMgmtRoute && verticals?.CLIENTS?.locked)
  );

  React.useEffect(() => {
    if (isLockedRoute) {
      setActiveVertical(null);
    } else if (isLockedFeatureRoute) {
      // Redirect locked feature routes (e.g. Leave Manager, Daily Task Board/Templates) to their parent vertical
      const fallbackTarget =
        resolvedRootId === verticals?.EMPLOYEES?.id
          ? (verticals?.EMPLOYEES?.id || null)
          : resolvedRootId === verticals?.CHARGING_HUBS?.id
            ? (verticals?.CHARGING_HUBS?.id || null)
            : null;
      setActiveVertical(fallbackTarget);
    }
  }, [isLockedRoute, isLockedFeatureRoute, resolvedRootId, verticals, setActiveVertical]);

  if (!activeVertical || isLockedRoute || isLockedFeatureRoute) {
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

  // All secondary views are lazy-loaded; render inside Suspense + chunk error boundary
  const renderLazyRoute = () => {
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

  if (activeVertical === 'cleaning_qr_generator') {
    return (
      <CleaningQRGenerator 
        permissions={permissions}
        onBack={() => setActiveVertical('configuration')}
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

  return (
    <LazyRouteErrorBoundary resetKey={activeVertical}>
      <Suspense fallback={<div className="loading-screen-layout"><p>Loading view...</p></div>}>
        {renderLazyRoute()}
      </Suspense>
    </LazyRouteErrorBoundary>
  );
};

export default ContentRouter;
