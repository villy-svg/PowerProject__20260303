import React, { useState, useEffect } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';
import './components/Header.css';

// Services — Core
import { verticalService } from './services/core/verticalService';
import { authService } from './services/auth/authService';
import { masterErrorHandler } from './services/core/masterErrorHandler';

// Hooks
import { useAuth } from './app/contexts/AuthContext';
import { AppNavigationProvider, useAppNavigation } from './app/contexts/AppNavigationContext';
import { TaskBoardProvider, useTaskBoard } from './app/contexts/TaskBoardContext';
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
import {
  HubManagement, HubFunctionManagement, DailyTasksManagement,
} from './verticals/ChargingHubs';
import {
  EmployeeManagement, DepartmentManagement, EmployeeRoleManagement,
} from './verticals/Employees';
import {
  ClientManagement, ClientCategoryManagement, ClientBillingModelManagement, ClientServiceManagement,
} from './verticals/Clients';

import Login from './components/Login';

// Assets
import powerLogo from './assets/logo.svg';

/**
 * AppShell handles the main authenticated UI layout.
 * It consumes context from Auth, Navigation, and TaskBoard providers.
 */
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

  const {
    tasks, setTasks, tasksLoading, fetchTasks,
    activeTasks, activeAddTask, activeUpdateTask,
    activeUpdateTaskStage, activeBulkUpdateTasks, activeDeleteTask,
  } = useTaskBoard();

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

  const currentUserPermissions = useRBAC(user, activeVertical, verticals);
  useOTAUpdate();

  // SECURITY VALIDATION: Enforces vertical access based on RBAC rules.
  useEffect(() => {
    if (!user || !activeVertical) return;

    const isMasterAdmin = user.roleId === 'master_admin';
    const isGlobalScope = currentUserPermissions.scope === 'global';
    
    // Special admin-only views
    const isSpecialAdminView = ['user_management', 'role_management'].includes(activeVertical);
    if (isSpecialAdminView && !isMasterAdmin) {
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
  }, [user, activeVertical, currentUserPermissions, verticals, setActiveVertical]);

  // Sync Local Preferences
  useEffect(() => { 
    localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); 
  }, [rolePermissions]);

  // Profile Error or Missing Profile gates
  if (!user) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <div className="loading-screen-layout">
          {profileError ? (
            <>
              <h2 className="error-heading">Profile Error</h2>
              <p style={{ maxWidth: '400px', textAlign: 'center' }}>{profileError}</p>
              <button onClick={handleLogout} className="halo-button error-logout-btn">
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
        <div className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)} />
        
        <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
          <header className={`app-header ${activeVertical ? 'mobile-hidden' : ''}`}>
            <div className="header-left"></div>
            <div className="header-center"></div>
            <div className="header-right">
              {realUser?.roleId === 'master_admin' && (
                <div className="impersonation-header-wrapper">
                  {impersonatedUser ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="impersonation-active-label">
                        View: <strong>{impersonatedUser.name}</strong>
                        <span className="neutral-badge impersonation-role-badge">
                          {impersonatedUser.roleId}
                        </span>
                      </span>
                      <button className="halo-button impersonation-stop-btn" onClick={() => handleImpersonate(null)}>
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
              <UserManagement currentUser={user} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'hub_management' ? (
              <HubManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'hub_function_management' ? (
              <HubFunctionManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'department_management' ? (
              <DepartmentManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'employee_role_management' ? (
              <EmployeeRoleManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'client_category_management' ? (
              <ClientCategoryManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'client_service_management' ? (
              <ClientServiceManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : activeVertical === 'client_billing_model_management' ? (
              <ClientBillingModelManagement user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} onShowBottomNav={() => setShowBottomNavOverlay(prev => !prev)} />
            ) : (
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
                  <EmployeeManagement user={user} permissions={currentUserPermissions} tasks={tasks.filter(t => t.verticalId === verticals.EMPLOYEES?.id)} />
                )}
                {activeVertical === verticals.CLIENTS?.id && (
                  <ClientManagement user={user} permissions={currentUserPermissions} tasks={tasks.filter(t => t.verticalId === verticals.CLIENTS?.id)} />
                )}
                {activeVertical === 'daily_task_templates' && (
                  <DailyTasksManagement permissions={currentUserPermissions} refreshTasks={fetchTasks} currentUser={user} />
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
    user,
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
  }, [fetchUserProfile, setIsAppInitializing, setSession]);

  useEffect(() => {
    masterErrorHandler.testDatabaseConnection();
  }, []);

  if (isAppInitializing) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <div className="loading-screen-layout">
          <img src={powerLogo} className="loading-logo" alt="logo" />
          <h2>Connecting to Cloud Database...</h2>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
        <Login />
      </div>
    );
  }

  return (
    <AppNavigationProvider verticals={verticals}>
      <TaskBoardProvider user={user} verticals={verticals}>
        <AppShell verticals={verticals} verticalList={verticalList} />
      </TaskBoardProvider>
    </AppNavigationProvider>
  );
}

export default App;