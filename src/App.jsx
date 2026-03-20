import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle';
import './App.css';

// 1. New Supabase Import
import { supabase } from './services/supabaseClient';
import { masterErrorHandler } from './services/masterErrorHandler';

// Constants
import { VERTICALS } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS, getPermissionsForLevel } from './constants/roles';

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
  assigned_to: row.assigned_to,
  assigneeName: row.employees?.full_name || row.assigneeName, // Support joined data or flat data
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
        .select(`
          *,
          employees:assigned_to (
            full_name
          )
        `)
        .order('updatedat', { ascending: true });

      if (error) {
        masterErrorHandler.handleDatabaseError(error, 'Task Fetch');
      } else {
        setTasks((data || []).map(normalizeTask));
      }
    } catch (err) {
      masterErrorHandler.handleComponentError(err, 'App', 'Task Fetch');
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

  // Compute current permissions dynamically based on active vertical
  const currentUserPermissions = useMemo(() => {
    if (!user) return { scope: 'loading' }; 
    
    const roleId = user.roleId;
    const isMasterScope = roleId?.startsWith('master_');
    const baseCaps = user.baseCapabilities || {};
    
    if (isMasterScope) {
      return { 
        ...baseCaps, 
        scope: 'global',
        canManageRoles: user.roleId === 'master_admin',
        // In Master scope, features are generally enabled by default
        canAccessClients: true,
        canAccessClientTasks: true,
        canAccessLeadsFunnel: true,
        canAccessEmployees: true,
        canAccessEmployeeTasks: true,
        canAccessHubTasks: true
      };
    } else {
      // Vertical scope: look up assignments for active vertical
      const rootVerticalId = 
        (activeVertical === 'CHARGING_HUBS' || activeVertical === 'hub_tasks') ? 'CHARGING_HUBS' :
        (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? 'CLIENTS' :
        (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? 'EMPLOYEES' :
        activeVertical.toUpperCase();

      const permData = user.verticalPermissions?.[rootVerticalId];
      const level = permData?.level || 'none';
      const featureLevels = permData?.features || {};
      
      // Calculate effective capability (minimum of Base and Vertical)
      const verticalCaps = getPermissionsForLevel(level);
      
      // Build final permissions
      const finalPerms = {
        ...verticalCaps,
        scope: 'assigned',
        canAccessConfig: level === 'admin'
      };

      // Add feature flags (boolean) and feature-specific capabilities
      Object.keys(featureLevels).forEach(fId => {
        const fLvl = featureLevels[fId];
        const featureCaps = getPermissionsForLevel(fLvl);
        
        // Feature flag (for sub-sidebar visibility)
        finalPerms[fId] = fLvl !== 'none';
        
        // Granular CRUD flags for this specific feature
        // Pattern: canCreateClients, canUpdateEmployeeTasks, etc.
        const featureBaseName = fId.replace('canAccess', ''); 
        
        // Effective permission: Minimum of Vertical Cap and Feature Cap
        finalPerms[`canCreate${featureBaseName}`] = verticalCaps.canCreate && featureCaps.canCreate;
        finalPerms[`canRead${featureBaseName}`] = verticalCaps.canRead && featureCaps.canRead;
        finalPerms[`canUpdate${featureBaseName}`] = verticalCaps.canUpdate && featureCaps.canUpdate;
        finalPerms[`canDelete${featureBaseName}`] = verticalCaps.canDelete && featureCaps.canDelete;
      });

      return finalPerms;
    }
  }, [user, activeVertical]);

  // Test database connection on app start
  useEffect(() => {
    masterErrorHandler.testDatabaseConnection();
  }, []);

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
    try {
      // 1. Fetch Profile
      const { data: profile, error: pError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (pError) throw pError;

      // 2. Fetch Base Role Permissions (Global Defaults)
      const { data: rolePerms, error: rError } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('role_id', profile.role_id)
        .single();
      
      // 3. Fetch Vertical Access Assignments
      const { data: vAccess, error: vError } = await supabase
        .from('vertical_access')
        .select('*')
        .eq('user_id', userId);

      // 4. Fetch Feature Access Assignments
      const { data: fAccess, error: fError } = await supabase
        .from('feature_access')
        .select('*')
        .eq('user_id', userId);

      if (profile) {
        // Build vertical permissions map
        const vPermsMap = {};
        (vAccess || []).forEach(v => {
          vPermsMap[v.vertical_id] = { level: v.access_level, features: {} };
        });
        
        // Add features to the map
        (fAccess || []).forEach(f => {
          if (vPermsMap[f.vertical_id]) {
            vPermsMap[f.vertical_id].features[f.feature_id] = f.access_level;
          }
        });

        setUser({
          id: profile.id,
          name: profile.name || "User",
          role: profile.role_id,
          roleId: profile.role_id,
          assignedVerticals: (vAccess || []).map(v => v.vertical_id),
          verticalPermissions: vPermsMap,
          baseCapabilities: rolePerms?.permissions || {}
        });
        setProfileError(null);
      }
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
      const persistentVerticals = ['CHARGING_HUBS', 'EMPLOYEES', 'employee_tasks', 'CLIENTS', 'client_tasks', 'leads_funnel'];
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
      assigned_to: taskData.assigned_to || null,
      createdat: taskData.createdAt,
      updatedat: taskData.updatedAt,
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskRow])
        .select('*, employees:assigned_to (full_name)');

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
      assigned_to: taskData.assigned_to || null,
      updatedat: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(taskRow)
        .eq('id', taskData.id)
        .select('*, employees:assigned_to (full_name)');

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
        .select('*, employees:assigned_to (full_name)');

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
                  activeVertical === 'CHARGING_HUBS' ? HubSubSidebar :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeSubSidebar :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientSubSidebar :
                        null
                }
                TaskFormComponent={
                  activeVertical === 'CHARGING_HUBS' ? HubTaskForm :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskForm :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskForm :
                        null
                }
                TaskTileComponent={
                  activeVertical === 'CHARGING_HUBS' ? HubTaskTile :
                    (activeVertical === 'EMPLOYEES' || activeVertical === 'employee_tasks') ? EmployeeTaskTile :
                      (activeVertical === 'CLIENTS' || activeVertical === 'client_tasks' || activeVertical === 'leads_funnel') ? ClientTaskTile :
                        null
                }
                onHeaderClick={
                  (activeVertical === 'employee_tasks')
                    ? () => setActiveVertical('EMPLOYEES')
                    : (activeVertical === 'client_tasks' || activeVertical === 'leads_funnel')
                       ? () => setActiveVertical('CLIENTS')
                      : (currentUserPermissions.canAccessConfig && activeVertical === 'CHARGING_HUBS')
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
      </div>
    </div>
  );
}

export default App;