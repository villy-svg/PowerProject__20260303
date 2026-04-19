import React, { useState, useEffect } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';
import './components/Header.css';

// Services — Core
import { masterErrorHandler } from './services/core/masterErrorHandler';
import { verticalService } from './services/core/verticalService';
// Services — Auth
import { taskService } from './services/tasks/taskService';
import { dailyTaskService } from './services/tasks/dailyTaskService';
import { authService } from './services/auth/authService';
import { profileService } from './services/auth/profileService';
// Hooks
import { useTasks } from './hooks/useTasks';
import { useDailyTasks } from './hooks/useDailyTasks';
import { useRBAC } from './hooks/useRBAC';
import { useOTAUpdate } from './hooks/useOTAUpdate';

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
import HubManagement from './verticals/ChargingHubs/HubManagement';
import HubFunctionManagement from './verticals/ChargingHubs/HubFunctionManagement';
import HubSubSidebar from './verticals/ChargingHubs/HubSubSidebar';
import DailyTasksManagement from './verticals/ChargingHubs/DailyTasksManagement';
import HubTaskForm from './verticals/ChargingHubs/HubTaskForm';
import HubTaskTile from './verticals/ChargingHubs/HubTaskTile';
import EmployeeSubSidebar from './verticals/Employees/EmployeeSubSidebar';
import EmployeeTaskForm from './verticals/Employees/EmployeeTaskForm';
import EmployeeTaskTile from './verticals/Employees/EmployeeTaskTile';
import EmployeeManagement from './verticals/Employees/EmployeeManagement';
import DepartmentManagement from './verticals/Employees/DepartmentManagement';
import EmployeeRoleManagement from './verticals/Employees/EmployeeRoleManagement';
import ClientSubSidebar from './verticals/Clients/ClientSubSidebar';
import ClientManagement from './verticals/Clients/ClientManagement';
import ClientCategoryManagement from './verticals/Clients/ClientCategoryManagement';
import ClientBillingModelManagement from './verticals/Clients/ClientBillingModelManagement';
import ClientTaskForm from './verticals/Clients/ClientTaskForm';
import ClientTaskTile from './verticals/Clients/ClientTaskTile';
import ClientServiceManagement from './verticals/Clients/ClientServiceManagement';
import Login from './components/Login';

// Assets
import powerLogo from './assets/logo.svg';

function App() {
  const { darkMode, toggleTheme } = useTheme();
  const [activeVertical, setActiveVertical] = useState(() => {
    const saved = localStorage.getItem('power_project_active_vertical');
    return (saved === 'home' || !saved) ? null : saved;
  });

  // 1. Auth and User Identity
  const [isAppInitializing, setIsAppInitializing] = useState(true);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [verticals, setVerticals] = useState(STATIC_VERTICALS);
  const [verticalList, setVerticalList] = useState(STATIC_VERTICAL_LIST);

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
    setTasks: setDailyTasks,
    loading: dailyTasksLoading,
    fetchTasks: fetchDailyTasks,
    addTask: addDailyTask,
    updateTask: updateDailyTask,
    updateTaskStage: updateDailyTaskStage,
    bulkUpdateTasks: bulkUpdateDailyTasks,
    deleteTask: deleteDailyTask,
  } = useDailyTasks(user);

  // Unified Initial Data Load
  useEffect(() => {
    const initAppData = async () => {
      try {
        // Parallel Step 1: Critical infrastructure (Verticals and Session)
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

        // Step 2: Fetch Identity (Blocking)
        if (sessionData) {
          await fetchUserProfile(sessionData.user.id);

          // Step 3: Trigger Data (Non-blocking / Progressive)
          // We don't 'await' these here so the app can start showing the UI immediately
          fetchTasks();
          fetchDailyTasks();
        }
      } catch (err) {
        console.error('App Initialization Error:', err);
      } finally {
        setIsAppInitializing(false);
      }
    };

    initAppData();
  }, [fetchTasks, fetchDailyTasks]);

  const [rolePermissions, setRolePermissions] = useState(() => {
    const saved = localStorage.getItem('power_project_permissions');
    const defaults = DEFAULT_ROLE_PERMISSIONS;
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved);
      // Deep merge at the role level to ensure new flags (like canManageRoles, scope) exist
      const merged = { ...defaults };
      Object.keys(parsed).forEach(role => {
        merged[role] = { ...defaults[role], ...parsed[role] };
      });
      return merged;
    } catch {
      return defaults;
    }
  });

  // Persistent UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('sidebar_state') === 'true');
  const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sub_sidebar_state');
    return saved !== null ? saved === 'true' : true;
  });
  
  // Mobile Overlay Nav State
  const [showBottomNavOverlay, setShowBottomNavOverlay] = useState(false);

  // Compute current permissions via dedicated RBAC hook
  const currentUserPermissions = useRBAC(user, activeVertical, verticals);

  // OTA Update Hook — no-op on web, checks for updates on native platform
  // CRITICAL: Do NOT conditionally call this hook (Rules of Hooks). The hook
  // itself handles the Capacitor.isNativePlatform() guard internally.
  useOTAUpdate();

  // Test database connection on app start
  useEffect(() => {
    masterErrorHandler.testDatabaseConnection();
  }, []);

  // Auth State Listener
  useEffect(() => {
    authService.getSession().then(session => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const subscription = authService.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const userData = await profileService.fetchUserProfile(userId);
      setUser(userData);
      setProfileError(null);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfileError(error.message);
    }
  };


  /**
   * SECURITY VALIDATION:
   * Ensures the user has permissions for the currently 'activeVertical'.
   * If permissions are revoked in the backend, we force them back to the dashboard.
   */
  useEffect(() => {
    if (!user || !activeVertical) return;

    // Public/Special views logic
    const isMasterAdmin = user.roleId === 'master_admin';
    const isGlobalScope = currentUserPermissions.scope === 'global';
    const isConfigView = ['configuration', 'role_management', 'user_management'].includes(activeVertical);

    // Check if the vertical is strictly assigned OR if they have global scope
    const isSpecialAdminView = ['user_management', 'role_management'].includes(activeVertical);
    const hasSpecialAccess = isMasterAdmin; // Only Master Admin can see these management tools

    // Validate access
    if (isSpecialAdminView && !hasSpecialAccess) {
      setActiveVertical(null);
      return;
    }

    if (activeVertical === 'configuration' && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null);
      return;
    }

    // Charging Hubs special CRUD view handling
    if (activeVertical === 'hub_management' && !isMasterAdmin && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null);
      return;
    }

    // Daily Task Templates security guard
    if (activeVertical === 'daily_task_templates' && !currentUserPermissions.canAccessDailyTaskTemplates) {
      setActiveVertical(null);
      return;
    }

    // Standard Vertical validation
    const verticalKeys = Object.keys(verticals);
    if (verticalKeys.includes(activeVertical)) {
      const isAssigned = user.assignedVerticals?.includes(activeVertical);
      if (!isAssigned && !isGlobalScope) {
        setActiveVertical(null);
      }
    }
  }, [user, activeVertical, currentUserPermissions, verticals]);

  const handleLogout = async () => {
    await authService.signOut();
    setProfileError(null);
  };

  // Sync Local Preferences
  useEffect(() => { if (user) localStorage.setItem('power_project_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); }, [rolePermissions]);
  useEffect(() => { localStorage.setItem('sidebar_state', isSidebarOpen); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('sub_sidebar_state', isSubSidebarOpen); }, [isSubSidebarOpen]);
  useEffect(() => {
    if (activeVertical) {
      // Don't save transient management sub-views
      const persistentVerticals = ['home', verticals.CHARGING_HUBS?.id, 'hub_tasks', 'daily_hub_tasks', 'daily_task_templates', verticals.EMPLOYEES?.id, 'employee_tasks', verticals.CLIENTS?.id, 'client_tasks', 'leads_funnel'];
      if (persistentVerticals.includes(activeVertical)) {
        localStorage.setItem('power_project_active_vertical', activeVertical);
      }
    } else {
      localStorage.setItem('power_project_active_vertical', 'home');
    }
  }, [activeVertical, verticals]);


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

  // Profile Error or Missing Profile
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
            <div className="header-left">
              {/* Spacer for absolute branding */}
            </div>
            <div className="header-center">
              {/* Title moved to top-level for static positioning */}
            </div>
            <div className="header-right">
              {user?.roleId === 'master_admin' && (
                <ThemeToggle darkMode={darkMode} toggleTheme={toggleTheme} />
              )}
              <div style={{ width: '16px' }} />
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
                verticals={verticals}
                verticalList={verticalList}
              />
            ) : activeVertical === 'role_management' ? (
              <UserRoleManagement permissions={rolePermissions} setPermissions={setRolePermissions} onBack={() => setActiveVertical('configuration')} />
            ) : activeVertical === 'user_management' ? (
              <UserManagement currentUser={user} />
            ) : activeVertical === 'hub_management' ? (
              <HubManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'hub_function_management' ? (
              <HubFunctionManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'department_management' ? (
              <DepartmentManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'employee_role_management' ? (
              <EmployeeRoleManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'client_category_management' ? (
              <ClientCategoryManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'client_service_management' ? (
              <ClientServiceManagement user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'client_billing_model_management' ? (
              <ClientBillingModelManagement user={user} permissions={currentUserPermissions} />
            ) : (
              <VerticalWorkspace
                label={
                  (activeVertical === 'daily_task_templates' || activeVertical === 'daily_hub_tasks' || activeVertical === 'hub_tasks' || activeVertical === verticals.CHARGING_HUBS?.id) ? 'Hubs List' :
                    (activeVertical === verticals.EMPLOYEES?.id || activeVertical === 'employee_tasks') ? 'Employees' :
                      (activeVertical === verticals.CLIENTS?.id || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? 'Clients' :
                        verticals[activeVertical]?.label
                }
                boardLabel={
                  (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :
                    (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
                      (activeVertical === 'hub_tasks') ? 'Hub Task Board' :
                        (activeVertical === verticals.CHARGING_HUBS?.id) ? 'Hubs Task Board' :
                          (activeVertical === 'employee_tasks') ? 'Employee Task Board' :
                            (activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? 'Client Task Board' :
                              verticals[activeVertical]?.label || 'Board'
                }
                activeVertical={activeVertical}
                tasks={activeVertical === 'daily_hub_tasks' ? dailyTasks : tasks}
                setTasks={activeVertical === 'daily_hub_tasks' ? addDailyTask : addTask}
                addTask={activeVertical === 'daily_hub_tasks' ? addDailyTask : addTask}
                actualSetTasks={activeVertical === 'daily_hub_tasks' ? setDailyTasks : setTasks}
                refreshTasks={activeVertical === 'daily_hub_tasks' ? fetchDailyTasks : fetchTasks}
                updateTask={activeVertical === 'daily_hub_tasks' ? updateDailyTask : updateTask}
                bulkUpdateTasks={activeVertical === 'daily_hub_tasks' ? bulkUpdateDailyTasks : bulkUpdateTasks}
                deleteTask={activeVertical === 'daily_hub_tasks' ? deleteDailyTask : deleteTask}
                updateTaskStage={activeVertical === 'daily_hub_tasks' ? updateDailyTaskStage : updateTaskStage}
                isSubSidebarOpen={isSubSidebarOpen}
                setIsSubSidebarOpen={setIsSubSidebarOpen}
                setActiveVertical={setActiveVertical}
                onShowBottomNav={() => setShowBottomNavOverlay(true)}
                SidebarComponent={
                  (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'daily_task_templates') ? HubSubSidebar :
                    (activeVertical === verticals.EMPLOYEES?.id || activeVertical === 'employee_tasks') ? EmployeeSubSidebar :
                      (activeVertical === verticals.CLIENTS?.id || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientSubSidebar :
                        null
                }
                TaskFormComponent={
                  (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'daily_task_templates') ? HubTaskForm :
                    (activeVertical === verticals.EMPLOYEES?.id || activeVertical === 'employee_tasks') ? EmployeeTaskForm :
                      (activeVertical === verticals.CLIENTS?.id || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskForm :
                        null
                }
                TaskTileComponent={
                  (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'daily_task_templates') ? HubTaskTile :
                    (activeVertical === verticals.EMPLOYEES?.id || activeVertical === 'employee_tasks') ? EmployeeTaskTile :
                      (activeVertical === verticals.CLIENTS?.id || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskTile :
                        null
                }
                onHeaderClick={
                  (activeVertical === 'employee_tasks')
                    ? () => setActiveVertical(verticals.EMPLOYEES?.id)
                    : (activeVertical === 'client_tasks' || activeVertical === 'leads_funnel')
                      ? () => setActiveVertical(verticals.CLIENTS?.id)
                      : (currentUserPermissions.canAccessConfig && (activeVertical === verticals.CHARGING_HUBS?.id || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks' || activeVertical === 'daily_task_templates'))
                        ? () => setActiveVertical('hub_management')
                        : null
                }
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
                    refreshTasks={fetchDailyTasks}
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

export default App;