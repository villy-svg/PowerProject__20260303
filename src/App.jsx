import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';
import './components/Header.css';

// Services — Core
import { masterErrorHandler } from './services/core/masterErrorHandler';
import { verticalService } from './services/core/verticalService';
// Services — Auth
import { taskService } from './services/tasks/taskService';
import { authService } from './services/auth/authService';
// Hooks
import { useAuth } from './app/contexts/AuthContext';
import { AppNavigationProvider, useAppNavigation } from './app/contexts/AppNavigationContext';
import { useTasks } from './hooks/useTasks';
import { useDailyTasks } from './hooks/useDailyTasks';
import { useRBAC } from './hooks/useRBAC';
import { useOTAUpdate } from './hooks/useOTAUpdate';
import { resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget } from './registry/verticalRegistry';


// Constants
import { VERTICALS as STATIC_VERTICALS, VERTICAL_LIST as STATIC_VERTICAL_LIST, updateStaticVerticals } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS } from './constants/roles';

// Components
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import VerticalWorkspace from './components/VerticalWorkspace';
import ExecutiveSummary from './components/ExecutiveSummary';
import Configuration from './components/Configuration';
import UserProfile from './components/UserProfile';
import UserRoleManagement from './components/UserRoleManagement';
import UserManagement from './components/UserManagement';
import CustomSelect from './components/CustomSelect';
import HubManagement from './verticals/ChargingHubs/HubManagement';
import HubFunctionManagement from './verticals/ChargingHubs/HubFunctionManagement';
import DailyTasksManagement from './verticals/ChargingHubs/DailyTasksManagement';
import EmployeeManagement from './verticals/Employees/EmployeeManagement';
import DepartmentManagement from './verticals/Employees/DepartmentManagement';
import EmployeeRoleManagement from './verticals/Employees/EmployeeRoleManagement';
import ClientManagement from './verticals/Clients/ClientManagement';
import ClientCategoryManagement from './verticals/Clients/ClientCategoryManagement';
import ClientBillingModelManagement from './verticals/Clients/ClientBillingModelManagement';
import ClientServiceManagement from './verticals/Clients/ClientServiceManagement';

import Login from './components/Login';

// Assets
import powerLogo from './assets/logo.svg';

function AppShell({ verticals, verticalList }) {
  const { darkMode } = useTheme();
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen, setIsSidebarOpen,
    isSubSidebarOpen, setIsSubSidebarOpen,
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  const {
    user, realUser, impersonatedUser, impersonationUsers,
    profileError,
    handleImpersonate,
    handleLogout,
  } = useAuth();

  // 2. Main Task state
  const {
    tasks,
    setTasks,
    loading: tasksLoading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  } = useTasks(user);

  // 3. Daily Task state
  const {
    tasks: dailyTasks,
    addTask: addDailyTask,
    updateTask: updateDailyTask,
    updateTaskStage: updateDailyTaskStage,
    bulkUpdateTasks: bulkUpdateDailyTasks,
    deleteTask: deleteDailyTask,
  } = useDailyTasks(tasks, setTasks, user, fetchTasks);

  // 4. Escalation Task state (Filtered from global tasks)
  const escalationTasks = useMemo(() => {
    const hubId = verticals.CHARGING_HUBS?.id;
    if (!hubId) return [];

    return tasks.filter(t => {
      const isHubTask = t.verticalId === hubId;
      if (!isHubTask) return false;
      return Array.isArray(t.task_board) && t.task_board.includes('Escalations');
    });
  }, [tasks, verticals.CHARGING_HUBS?.id]);

  const [rolePermissions, setRolePermissions] = useState(() => {
    const saved = localStorage.getItem('power_project_permissions');
    const defaults = DEFAULT_ROLE_PERMISSIONS;
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      const merged = { ...defaults };
      Object.keys(parsed).forEach(role => {
        merged[role] = { ...defaults[role], ...parsed[role] };
      });
      return merged;
    } catch {
      return defaults;
    }
  });

  // Compute current permissions via dedicated RBAC hook
  const currentUserPermissions = useRBAC(user, activeVertical, verticals);

  // OTA Update Hook
  useOTAUpdate();

  /**
   * SECURITY VALIDATION:
   * Ensures the user has permissions for the currently 'activeVertical'.
   */
  useEffect(() => {
    if (!user || !activeVertical) return;

    const isMasterAdmin = user.roleId === 'master_admin';
    const isGlobalScope = currentUserPermissions.scope === 'global';
    const isConfigView = ['configuration', 'role_management', 'user_management'].includes(activeVertical);

    const isSpecialAdminView = ['user_management', 'role_management'].includes(activeVertical);
    const hasSpecialAccess = isMasterAdmin;

    if (isSpecialAdminView && !hasSpecialAccess) {
      setActiveVertical(null);
      return;
    }

    if (activeVertical === 'configuration' && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null);
      return;
    }

    if (activeVertical === 'hub_management' && !isMasterAdmin && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null);
      return;
    }

    if (activeVertical === 'daily_task_templates' && !currentUserPermissions.canAccessDailyTaskTemplates) {
      setActiveVertical(null);
      return;
    }

    const verticalKeys = Object.keys(verticals);
    if (verticalKeys.includes(activeVertical)) {
      const isAssigned = user.assignedVerticals?.includes(activeVertical);
      if (!isAssigned && !isGlobalScope) {
        setActiveVertical(null);
      }
    }
  }, [user, activeVertical, currentUserPermissions, verticals]);

  // Sync Local Preferences (Non-nav)
  useEffect(() => { 
    localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); 
  }, [rolePermissions]);

  // Profile Error or Missing Profile gates
  if (!user) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          {profileError ? (
            <>
              <h2 style={{ color: '#ff4444' }}>Profile Error</h2>
              <p style={{ maxWidth: '400px', textAlign: 'center' }}>{profileError}</p>
              <button
                onClick={handleLogout}
                style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Sign Out & Try Again
              </button>
            </>
          ) : (
            <>
              <h2>Finalizing Profile...</h2>
              <p>Just a moment while we set up your workspace.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const { SidebarComponent, TaskFormComponent, TaskTileComponent } =
    resolveVerticalComponents(activeVertical, verticals);
  const { label: workspaceLabel, boardLabel: workspaceBoardLabel } =
    resolveVerticalLabels(activeVertical, verticals);
  const headerClickTarget =
    resolveHeaderClickTarget(activeVertical, verticals, currentUserPermissions);

  return (
    <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="app-layout">
        <button className={`logo-button ${activeVertical ? 'mobile-hidden' : ''}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <img src={powerLogo} alt="Logo" className="logo-svg" />
        </button>
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          setActiveVertical={setActiveVertical}
          activeVertical={activeVertical}
          user={user}
          permissions={currentUserPermissions}
          verticalList={verticalList}
        />
        <h1 className={`brand-title-centered ${activeVertical ? 'mobile-hidden' : ''}`}>PowerProject</h1>
        <div 
          className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
          onClick={() => setIsSidebarOpen(false)} 
        />
        <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
          <header className={`app-header ${activeVertical ? 'mobile-hidden' : ''}`}>
            <div className="header-left"></div>
            <div className="header-center"></div>
            <div className="header-right">
              {realUser?.roleId === 'master_admin' && (
                <div className="impersonation-header-wrapper">
                  {impersonatedUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-color)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        View: <strong>{impersonatedUser.name}</strong>
                        <span className="neutral-badge" style={{ fontSize: '0.75rem', padding: '2px 6px', opacity: 0.8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          {impersonatedUser.roleId}
                        </span>
                      </span>
                      <button 
                        className="halo-button" 
                        style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--border-color)', color: 'var(--brand-green)', cursor: 'pointer' }}
                        onClick={() => handleImpersonate(null)}
                      >
                        Stop
                      </button>
                    </div>
                  ) : (
                    <CustomSelect
                      id="impersonation-select"
                      placeholder="Simulate User..."
                      options={impersonationUsers.map(u => ({
                        value: u.id,
                        label: `${u.name} (${u.role_id})`
                      }))}
                      onChange={(val) => handleImpersonate(val)}
                    />
                  )}
                </div>
              )}
              <UserProfile user={user} onConfigClick={() => setActiveVertical('configuration')} onLogout={handleLogout} />
            </div>
          </header>
          <main className="app-content">
            {!activeVertical ? (
              <ExecutiveSummary tasks={tasks} user={user} permissions={currentUserPermissions} verticals={verticals} verticalList={verticalList} loading={tasksLoading} />
            ) : activeVertical === 'configuration' ? (
              <Configuration
                tasks={tasks}
                setTasks={setTasks}
                user={user}
                permissions={currentUserPermissions}
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
                verticals={verticals}
                verticalList={verticalList}
              />
            ) : activeVertical === 'role_management' ? (
              <UserRoleManagement 
                permissions={rolePermissions} 
                setPermissions={setRolePermissions} 
                onBack={() => setActiveVertical('configuration')} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'user_management' ? (
              <UserManagement 
                currentUser={user} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'hub_management' ? (
              <HubManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'hub_function_management' ? (
              <HubFunctionManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'department_management' ? (
              <DepartmentManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'employee_role_management' ? (
              <EmployeeRoleManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'client_category_management' ? (
              <ClientCategoryManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'client_service_management' ? (
              <ClientServiceManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : activeVertical === 'client_billing_model_management' ? (
              <ClientBillingModelManagement 
                user={user} 
                permissions={currentUserPermissions} 
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
              />
            ) : (
              <VerticalWorkspace
                label={workspaceLabel}
                boardLabel={workspaceBoardLabel}
                activeVertical={activeVertical}
                tasks={
                  activeVertical === 'daily_hub_tasks' ? dailyTasks : 
                  activeVertical === 'escalation_tasks' ? escalationTasks :
                  tasks
                }
                setTasks={setTasks}
                addTask={activeVertical === 'daily_hub_tasks' ? addDailyTask : addTask}
                actualSetTasks={setTasks}
                refreshTasks={fetchTasks}
                updateTask={activeVertical === 'daily_hub_tasks' ? updateDailyTask : updateTask}
                bulkUpdateTasks={activeVertical === 'daily_hub_tasks' ? bulkUpdateDailyTasks : bulkUpdateTasks}
                deleteTask={activeVertical === 'daily_hub_tasks' ? deleteDailyTask : deleteTask}
                updateTaskStage={activeVertical === 'daily_hub_tasks' ? updateDailyTaskStage : updateTaskStage}
                isSubSidebarOpen={isSubSidebarOpen}
                setIsSubSidebarOpen={setIsSubSidebarOpen}
                isMainSidebarOpen={isSidebarOpen}
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)}
                SidebarComponent={SidebarComponent}
                TaskFormComponent={TaskFormComponent}
                TaskTileComponent={TaskTileComponent}
                onHeaderClick={headerClickTarget ? () => setActiveVertical(headerClickTarget) : null}
                user={user}
                permissions={currentUserPermissions}
                verticals={verticals}
              >
                {activeVertical === verticals.EMPLOYEES?.id && (
                  <EmployeeManagement
                    user={user}
                    permissions={currentUserPermissions}
                    tasks={tasks.filter(t => t.verticalId === verticals.EMPLOYEES?.id)}
                  />
                )}
                {activeVertical === verticals.CLIENTS?.id && (
                  <ClientManagement
                    user={user}
                    permissions={currentUserPermissions}
                    tasks={tasks.filter(t => t.verticalId === verticals.CLIENTS?.id)}
                  />
                )}
                {activeVertical === 'daily_task_templates' && (
                  <DailyTasksManagement
                    permissions={currentUserPermissions}
                    refreshTasks={fetchTasks}
                    currentUser={user}
                  />
                )}
              </VerticalWorkspace>
            )}
          </main>
        </div>
      </div>
      <BottomNav 
        activeVertical={activeVertical} 
        setActiveVertical={setActiveVertical} 
        onMenuClick={() => setIsSidebarOpen(true)}
        verticals={verticals}
        showOverlay={showBottomNavOverlay}
        onCloseOverlay={() => setShowBottomNavOverlay(false)}
      />
    </div>
  );
}

function App() {
  const { darkMode } = useTheme();
  const {
    isAppInitializing, setIsAppInitializing,
    session, setSession,
    fetchUserProfile,
  } = useAuth();
  const [verticals, setVerticals] = useState(STATIC_VERTICALS);
  const [verticalList, setVerticalList] = useState(STATIC_VERTICAL_LIST);

  // Unified Initial Data Load
  useEffect(() => {
    const initAppData = async () => {
      try {
        const [vResult, sessionData] = await Promise.all([
          verticalService.getVerticals().catch(err => {
            console.warn('Falling back to static verticals.', err);
            return { list: null, map: null };
          }),
          authService.getSession()
        ]);
        if (vResult.list && vResult.list.length > 0) {
          setVerticals(vResult.map);
          setVerticalList(vResult.list);
          updateStaticVerticals(vResult.list);
        }
        setSession(sessionData);
        if (sessionData) {
          await fetchUserProfile(sessionData.user.id);
        }
      } catch (err) {
        console.error('App Initialization Error:', err);
      } finally {
        setIsAppInitializing(false);
      }
    };
    initAppData();
  }, []); // fetchTasks dependency removed as it's now in AppShell/Context

  // Test database connection on app start
  useEffect(() => {
    masterErrorHandler.testDatabaseConnection();
  }, []);

  // Unified Loading Screen for initial boot
  if (isAppInitializing) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <img src={powerLogo} className="loading-logo" alt="logo" style={{ width: '80px', marginBottom: '1rem' }} />
          <h2>Connecting to Cloud Database...</h2>
        </div>
      </div>
    );
  }

  // Not Logged In
  if (!session) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <Login />
      </div>
    );
  }

  return (
    <AppNavigationProvider verticals={verticals}>
      <AppShell verticals={verticals} verticalList={verticalList} />
    </AppNavigationProvider>
  );
}

export default App;