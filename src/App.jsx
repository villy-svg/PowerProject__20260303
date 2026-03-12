import React, { useState, useEffect } from 'react';
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
  createdAt: row.createdat ?? row.createdAt,
  updatedAt: row.updatedat ?? row.updatedAt,
});

function App() {
  const { darkMode, toggleTheme } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVertical, setActiveVertical] = useState(null);

  // 2. Initial Data Fetch from Supabase
  // useEffect(() => {
  //   const fetchTasks = async () => {
  //     setLoading(true);
  //     const { data, error } = await supabase
  //       .from('tasks')
  //       .select('*')
  //       .order('createdat', { ascending: true });

  //     if (error) {
  //       console.error("Error fetching tasks:", error.message);
  //     } else {
  //       setTasks(data || []);
  //     }
  //     setLoading(false);
  //   };

  //   fetchTasks();
  // }, []);

  // src/App.jsx - around line 35
  useEffect(() => {
  const fetchTasks = async () => {
    setLoading(true);
    console.log("🚩 TRACE 1: Starting Fetch...");
    
    try {
      const { data, error, status } = await supabase
        .from('tasks')
        .select('*')
        .order('updatedat', { ascending: true });

      if (error) {
        console.error(`❌ TRACE 1 ERROR [Status ${status}]:`, error.message);
      } else {
        console.log("✅ TRACE 1 SUCCESS: Rows received:", data?.length);
        setTasks((data || []).map(normalizeTask));
      }
    } catch (err) {
      console.error("❌ TRACE 1 CRASH:", err);
    }finally {
    // 🚩 THIS IS THE FIX: This must be outside the 'else' but inside the function
    console.log("🚩 TRACE 1.2: Setting loading to false now.");
    setLoading(false); 
  }
  };
  fetchTasks();
}, []);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfileError(null);
  };

  // Sync Local Preferences
  useEffect(() => { if(user) localStorage.setItem('power_project_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); }, [rolePermissions]);
  useEffect(() => { localStorage.setItem('sidebar_state', isSidebarOpen); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('sub_sidebar_state', isSubSidebarOpen); }, [isSubSidebarOpen]);

  // 4. Supabase CRUD Helpers (Replaces LocalStorage mutation)
  
  /**
   * Adds a task to the Supabase cloud.
   * Logic: Inserts and then updates local state with the returned DB object (including its new UUID).
   */
  const addTask = async (taskData) => {
    // Remap camelCase keys to the lowercase column names Supabase uses
    const dbRow = {
      id: taskData.id,
      text: taskData.text,
      verticalid: taskData.verticalId,
      stageid: taskData.stageId,
      createdat: taskData.createdAt,
      updatedat: taskData.updatedAt,
    };
    const { data, error } = await supabase
      .from('tasks')
      .insert([dbRow])
      .select();

    if (error) {
      console.error("Error adding task:", error.message);
    } else if (data) {
      setTasks(prev => [...prev, normalizeTask(data[0])]);
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

  const handleRoleChange = (roleId, assignedVerticalId) => {
    const roleLabels = {
      master_admin: "Master Admin",
      vertical_admin: "Vertical Admin",
      master_viewer: "Master Viewer",
      vertical_viewer: "Vertical Viewer"
    };
    
    setUser(prev => {
      const currentVerticals = Array.isArray(prev?.assignedVerticals) ? prev.assignedVerticals : [];
      let newVerticals = [...currentVerticals];
      if (assignedVerticalId && !newVerticals.includes(assignedVerticalId)) {
        newVerticals.push(assignedVerticalId);
      }
      return { ...prev, roleId: roleId, role: roleLabels[roleId], assignedVerticals: newVerticals };
    });
    setActiveVertical(null);
  };

  const currentUserPermissions = user ? (rolePermissions[user.roleId] || DEFAULT_ROLE_PERMISSIONS[user.roleId] || DEFAULT_ROLE_PERMISSIONS['vertical_viewer']) : {};

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

console.log("🚩 TRACE 1.5: Current activeVertical is:", activeVertical);

  return (
    <div className="app-container" data-theme={darkMode ? 'dark' : 'light'}>
      <div className="app-layout">
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
          setActiveVertical={setActiveVertical} 
          activeVertical={activeVertical}
          user={user}
          permissions={currentUserPermissions} 
        />
        <div className="app-main-area">
          <header className="app-header">
            <div className="header-left">
              <button className={`logo-button ${isSidebarOpen ? 'hidden' : ''}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <img src={powerLogo} alt="Logo" className="logo-svg" />
              </button>
            </div>
            <div className="header-center"><h1 className="brand-title">PowerProject</h1></div>
            <div className="header-right">
              <ThemeToggle darkMode={darkMode} toggleTheme={toggleTheme} />
              <div style={{ width: '16px' }} />
              <UserProfile user={user} onRoleChange={handleRoleChange} onConfigClick={() => setActiveVertical('configuration')} onLogout={handleLogout} />
            </div>
          </header>
          <main className="app-content">
            {!activeVertical ? (
              <ExecutiveSummary tasks={tasks} user={user} permissions={currentUserPermissions} /> 
            ) : activeVertical === 'configuration' ? (
              <Configuration tasks={tasks} setTasks={setTasks} user={user} setActiveVertical={setActiveVertical} />
            ) : activeVertical === 'role_management' ? (
              <RoleManagement permissions={rolePermissions} setPermissions={setRolePermissions} onBack={() => setActiveVertical('configuration')} />
            ) : (
              <VerticalWorkspace 
                label={VERTICALS[activeVertical]?.label}
                activeVertical={activeVertical}
                tasks={tasks}
                setTasks={addTask} // Re-wired to use the addTask helper
                deleteTask={deleteTask}
                updateTaskStage={updateTaskStage}
                isSubSidebarOpen={isSubSidebarOpen}
                setIsSubSidebarOpen={setIsSubSidebarOpen}
                user={user} 
                permissions={currentUserPermissions} 
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;