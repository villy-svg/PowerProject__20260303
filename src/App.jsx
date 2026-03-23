import React, { useState, useEffect } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';

// Services — Core
import { masterErrorHandler } from './services/core/masterErrorHandler';
// Services — Auth
import { authService } from './services/auth/authService';
import { profileService } from './services/auth/profileService';
// Hooks
import { useTasks } from './hooks/useTasks';
import { useRBAC } from './hooks/useRBAC';

// Constants
import { VERTICALS } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS } from './constants/roles';

// Components
import Sidebar from './components/Sidebar';
import VerticalWorkspace from './components/VerticalWorkspace';
import ExecutiveSummary from './components/ExecutiveSummary';
import Configuration from './components/Configuration';
import UserProfile from './components/UserProfile';
import UserRoleManagement from './components/UserRoleManagement';
import UserManagement from './components/UserManagement';
import HubManagement from './verticals/ChargingHubs/HubManagement';
import HubFunctionManagement from './verticals/ChargingHubs/HubFunctionManagement';
import HubSubSidebar from './verticals/ChargingHubs/HubSubSidebar';
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
  const [activeVertical, setActiveVertical] = useState(() => localStorage.getItem('power_project_active_vertical'));

  // Task state and all CRUD operations via the useTasks hook
  const {
    tasks,
    setTasks,
    loading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  } = useTasks();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 3. Auth and User Identity
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profileError, setProfileError] = useState(null);

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

  // Compute current permissions via dedicated RBAC hook
  const currentUserPermissions = useRBAC(user, activeVertical);

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

    // Standard Vertical validation
    const verticalKeys = Object.keys(VERTICALS);
    if (verticalKeys.includes(activeVertical)) {
      const isAssigned = user.assignedVerticals?.includes(activeVertical);
      if (!isAssigned && !isGlobalScope) {
        setActiveVertical(null);
      }
    }
  }, [user, activeVertical, currentUserPermissions]);

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
      // Don't save transient management sub-views as the default vertical
      const persistentVerticals = ['home', 'CHARGING_HUBS', 'hub_tasks', 'daily_hub_tasks', 'EMPLOYEES', 'employee_tasks', 'CLIENTS', 'client_tasks', 'leads_funnel'];
      if (persistentVerticals.includes(activeVertical)) {
        localStorage.setItem('power_project_active_vertical', activeVertical);
      }
    } else {
      localStorage.setItem('power_project_active_vertical', 'home');
    }
  }, [activeVertical]);


  // Loading Screen for initial fetch
  if (loading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2>Connecting to Cloud Database...</h2>
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
            <h2>Loading User Profile...</h2>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="app-layout">
        <button className="logo-button" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          <img src={powerLogo} alt="Logo" className="logo-svg" />
        </button>
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          setActiveVertical={setActiveVertical}
          activeVertical={activeVertical}
          user={user}
          permissions={currentUserPermissions}
        />
        <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`}>
          <header className="app-header">
            <div className="header-left">
              {/* Spacer for absolute branding */}
            </div>
            <div className="header-center">
              {/* Other tools could go here */}
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
              <ExecutiveSummary tasks={tasks} user={user} permissions={currentUserPermissions} />
            ) : activeVertical === 'configuration' ? (
              <Configuration tasks={tasks} setTasks={setTasks} user={user} permissions={currentUserPermissions} setActiveVertical={setActiveVertical} />
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
                  (activeVertical === 'hub_tasks' || activeVertical === 'CHARGING_HUBS') ? 'Hubs List' :
                  (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
                  (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? 'Employees' :
                  (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? 'Clients' :
                  VERTICALS[activeVertical]?.label
                }
                activeVertical={activeVertical}
                tasks={tasks}
                setTasks={addTask}
                actualSetTasks={setTasks}
                refreshTasks={fetchTasks}
                updateTask={updateTask}
                bulkUpdateTasks={bulkUpdateTasks}
                deleteTask={deleteTask}
                updateTaskStage={updateTaskStage}
                isSubSidebarOpen={isSubSidebarOpen}
                setIsSubSidebarOpen={setIsSubSidebarOpen}
                setActiveVertical={setActiveVertical}
                SidebarComponent={
                  (activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks') ? HubSubSidebar :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeSubSidebar :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientSubSidebar :
                        null
                }
                TaskFormComponent={
                  (activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks') ? HubTaskForm :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskForm :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskForm :
                        null
                }
                TaskTileComponent={
                  (activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks') ? HubTaskTile :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskTile :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskTile :
                        null
                }
                onHeaderClick={
                  (activeVertical === 'employee_tasks')
                    ? () => setActiveVertical('EMPLOYEES')
                    : (activeVertical === 'client_tasks' || activeVertical === 'leads_funnel')
                       ? () => setActiveVertical('CLIENTS')
                      : (currentUserPermissions.canAccessConfig && (activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks' || activeVertical === 'daily_hub_tasks'))
                        ? () => setActiveVertical('hub_management')
                        : null
                }
                user={user}
                permissions={currentUserPermissions}
              >
                {activeVertical === 'EMPLOYEES' && (
                  <EmployeeManagement
                    user={user}
                    permissions={currentUserPermissions}
                    tasks={tasks.filter(t => t.verticalId === 'EMPLOYEES')}
                  />
                )}
                {activeVertical === 'CLIENTS' && (
                  <ClientManagement
                    user={user}
                    permissions={currentUserPermissions}
                    tasks={tasks.filter(t => t.verticalId === 'CLIENTS')}
                  />
                )}
              </VerticalWorkspace>
            )}

          </main>
        </div>
        <h1 className="brand-title-centered">PowerProject</h1>
      </div>
    </div>
  );
}

export default App;