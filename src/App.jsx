import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';

// 1. New Supabase Import
import { supabase } from './services/supabaseClient';

// Constants
import { VERTICALS } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS } from './constants/roles';

// Components
import Sidebar from './components/Sidebar';
import VerticalWorkspace from './components/VerticalWorkspace';
import ExecutiveSummary from './components/ExecutiveSummary';
import Configuration from './components/Configuration';
import UserProfile from './components/UserProfile';
import RoleManagement from './components/RoleManagement';
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
import Login from './components/Login';

// Assets
import powerLogo from './assets/logo.svg';

/**
 * Supabase stores column names in lowercase.
 * This mapper converts them to the camelCase keys the rest of the app expects.
 */
const normalizeTask = (row) => ({
  id: row.id,
  text: row.text,
  verticalId: row.verticalid ?? row.verticalId,
  stageId: row.stageid ?? row.stageId,
  priority: row.priority,
  description: row.description,
  hub_id: row.hub_id,
  city: row.city,
  function: row.function,
  createdAt: row.createdat ?? row.createdAt,
  updatedAt: row.updatedat ?? row.updatedAt,
});

function App() {
  const { darkMode, toggleTheme } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVertical, setActiveVertical] = useState(() => localStorage.getItem('power_project_active_vertical'));


  // src/App.jsx - around line 35
  const fetchTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);

    try {
      const { data, error, status } = await supabase
        .from('tasks')
        .select('*')
        .order('updatedat', { ascending: true });

      if (error) {
        console.error(`❌ TRACE 1 ERROR [Status ${status}]:`, error.message);
      } else {
        setTasks((data || []).map(normalizeTask));
      }
    } catch (err) {
      console.error("❌ TRACE 1 CRASH:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // 3. Auth and User Identity
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const [rolePermissions, setRolePermissions] = useState(() => {
    const saved = localStorage.getItem('power_project_permissions');
    if (!saved) return DEFAULT_ROLE_PERMISSIONS;
    try {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
    } catch {
      return DEFAULT_ROLE_PERMISSIONS;
    }
  });

  // Persistent UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => localStorage.getItem('sidebar_state') === 'true');
  const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sub_sidebar_state');
    return saved !== null ? saved === 'true' : true;
  });

  const currentUserPermissions = user ? (rolePermissions[user.roleId] || DEFAULT_ROLE_PERMISSIONS[user.roleId] || DEFAULT_ROLE_PERMISSIONS['vertical_viewer']) : {};

  // Auth State Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      // If code is PGRST116 (0 rows returned), the trigger may not have fired
      if (error.code === 'PGRST116') {
        setProfileError("User profile not found in database. Did you run the SQL script or sign in before the trigger was added?");
      } else {
        setProfileError(error.message);
      }
    } else if (data) {
      setUser({
        id: data.id,
        name: data.name || "User",
        role: data.role_id,
        roleId: data.role_id,
        assignedVerticals: data.assigned_verticals || ["CHARGING_HUBS"]
      });
      setProfileError(null);
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
    const isConfigView = ['configuration', 'role_management', 'user_management'].includes(activeVertical);

    // Check if the vertical is strictly assigned OR if they are a Master Admin
    const isSpecialAdminView = ['user_management', 'role_management'].includes(activeVertical);
    const hasSpecialAccess = isMasterAdmin; // Only Master Admin can see these

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
    if (activeVertical === 'hub_management' && !isMasterAdmin) {
      setActiveVertical(null);
      return;
    }

    // Standard Vertical validation
    const verticalKeys = Object.keys(VERTICALS);
    if (verticalKeys.includes(activeVertical)) {
      const isAssigned = user.assignedVerticals?.includes(activeVertical);
      if (!isAssigned && !isMasterAdmin) {
        setActiveVertical(null);
      }
    }
  }, [user, activeVertical, currentUserPermissions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
      const persistentVerticals = ['CHARGING_HUBS', 'EMPLOYEES', 'employee_tasks'];
      if (persistentVerticals.includes(activeVertical)) {
        localStorage.setItem('power_project_active_vertical', activeVertical);
      }
    } else {
      localStorage.removeItem('power_project_active_vertical');
    }
  }, [activeVertical]);

  // 4. Supabase CRUD Helpers (Replaces LocalStorage mutation)

  /**
   * Adds a task to the Supabase cloud.
   * Logic: Inserts and then updates local state with the returned DB object (including its new UUID).
   */
  const addTask = async (taskData) => {
    const taskRow = {
      id: taskData.id,
      text: taskData.text,
      verticalid: taskData.verticalId,
      stageid: taskData.stageId,
      priority: taskData.priority || null,
      description: taskData.description || null,
      hub_id: taskData.hub_id === '' ? null : (taskData.hub_id || null),
      city: taskData.city || null,
      function: taskData.function || null,
      createdat: taskData.createdAt,
      updatedat: taskData.updatedAt,
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskRow])
        .select();

      if (error) throw error;
      if (data) {
        setTasks(prev => [...prev, normalizeTask(data[0])]);
      }
    } catch (err) {
      console.error("❌ Cloud Sync Error:", err.message);
      throw err;
    }
  };

  /**
   * Deletes a task from Supabase.
   */
  const deleteTask = async (taskId) => {
    if (window.confirm("Delete this task?")) {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error("Error deleting task:", error.message);
      } else {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    }
  };

  /**
   * Updates a task stage in Supabase.
   */
  const updateTaskStage = async (taskId, newStageId) => {
    const { error } = await supabase
      .from('tasks')
      .update({ stageid: newStageId, updatedat: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error("Error updating stage:", error.message);
    } else {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, stageId: newStageId } : t));
    }
  };

  /**
   * Performs a full update of a task in Supabase.
   */
  const updateTask = async (taskData) => {
    const taskRow = {
      text: taskData.text,
      verticalid: taskData.verticalId,
      stageid: taskData.stageId,
      priority: taskData.priority || null,
      description: taskData.description || null,
      hub_id: taskData.hub_id === '' ? null : (taskData.hub_id || null),
      city: taskData.city || null,
      function: taskData.function || null,
      updatedat: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(taskRow)
        .eq('id', taskData.id)
        .select();

      if (error) throw error;
      if (data) {
        setTasks(prev => prev.map(t => t.id === taskData.id ? normalizeTask(data[0]) : t));
      }
    } catch (err) {
      console.error("❌ Task Update Error:", err.message);
      throw err;
    }
  };

  /**
   * Bulk updates multiple tasks in Supabase.
   * Useful for "Clear Board" operations.
   */
  const bulkUpdateTasks = async (taskIds, updates) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({ ...updates, updatedat: new Date().toISOString() })
        .in('id', taskIds)
        .select();

      if (error) throw error;

      if (data) {
        const normalized = data.map(normalizeTask);
        setTasks(prev => prev.map(t => {
          const updated = normalized.find(n => n.id === t.id);
          return updated || t;
        }));
      }
    } catch (err) {
      console.error("❌ Bulk Update Error:", err.message);
      throw err;
    }
  };

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
              {/* Spacer for absolute logo */}
            </div>
            <div className="header-center"><h1 className="brand-title">PowerProject</h1></div>
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
              <Configuration tasks={tasks} setTasks={setTasks} user={user} setActiveVertical={setActiveVertical} />
            ) : activeVertical === 'role_management' ? (
              <RoleManagement permissions={rolePermissions} setPermissions={setRolePermissions} onBack={() => setActiveVertical('configuration')} />
            ) : activeVertical === 'user_management' ? (
              <UserManagement currentUser={user} />
            ) : activeVertical === 'hub_management' ? (
              <HubManagement />
            ) : activeVertical === 'hub_function_management' ? (
              <HubFunctionManagement />
            ) : activeVertical === 'department_management' ? (
              <DepartmentManagement />
            ) : activeVertical === 'employee_role_management' ? (
              <EmployeeRoleManagement />
            ) : (
              <VerticalWorkspace
                label={(activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? "Employees" : VERTICALS[activeVertical]?.label}
                activeVertical={activeVertical}
                tasks={tasks}
                setTasks={addTask}
                actualSetTasks={setTasks} // Pass raw setter for local updates
                refreshTasks={fetchTasks}
                updateTask={updateTask}
                bulkUpdateTasks={bulkUpdateTasks}
                deleteTask={deleteTask}
                updateTaskStage={updateTaskStage}
                isSubSidebarOpen={isSubSidebarOpen}
                setIsSubSidebarOpen={setIsSubSidebarOpen}
                setActiveVertical={setActiveVertical}
                SidebarComponent={
                  activeVertical === 'CHARGING_HUBS' ? HubSubSidebar :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeSubSidebar :
                      null
                }
                TaskFormComponent={
                  activeVertical === 'CHARGING_HUBS' ? HubTaskForm :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskForm :
                      null
                }
                TaskTileComponent={
                  activeVertical === 'CHARGING_HUBS' ? HubTaskTile :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskTile :
                      null
                }
                onHeaderClick={
                  (activeVertical === 'employee_tasks')
                    ? () => setActiveVertical('EMPLOYEES')
                    : (user?.roleId === 'master_admin' && activeVertical === 'CHARGING_HUBS')
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
              </VerticalWorkspace>
            )}

          </main>
        </div>
      </div>
    </div>
  );
}

export default App;