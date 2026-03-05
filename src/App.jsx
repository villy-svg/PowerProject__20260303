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

// Assets
import powerLogo from './assets/logo.svg';

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
        setTasks(data || []);
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

  // 3. User Identity (Keeping LocalStorage for fast profile loading)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('power_project_user');
    if (!savedUser) return {
      name: "Alex Rivera",
      role: "Master Admin",
      roleId: "master_admin",
      assignedVerticals: ["CHARGING_HUBS"], 
      id: "u1"
    };
    try {
      const parsed = JSON.parse(savedUser);
      return {
        ...parsed,
        assignedVerticals: parsed.assignedVerticals || ["v1"]
      };
    } catch {
      return { name: "Alex Rivera", role: "Master Admin", roleId: "master_admin", assignedVerticals: ["v1"], id: "u1" };
    }
  });

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

  // Sync Local Preferences
  useEffect(() => { localStorage.setItem('power_project_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); }, [rolePermissions]);
  useEffect(() => { localStorage.setItem('sidebar_state', isSidebarOpen); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('sub_sidebar_state', isSubSidebarOpen); }, [isSubSidebarOpen]);

  // 4. Supabase CRUD Helpers (Replaces LocalStorage mutation)
  
  /**
   * Adds a task to the Supabase cloud.
   * Logic: Inserts and then updates local state with the returned DB object (including its new UUID).
   */
  const addTask = async (taskData) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select();

    if (error) {
      console.error("Error adding task:", error.message);
    } else if (data) {
      setTasks(prev => [...prev, data[0]]);
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
      .update({ stageId: newStageId, updatedat: new Date().toISOString() })
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

  const currentUserPermissions = rolePermissions[user.roleId] || DEFAULT_ROLE_PERMISSIONS[user.roleId];

  // Loading Screen for initial fetch
  if (loading) {
    return (
      <div className="loading-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <h2>Connecting to Cloud Database...</h2>
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
              <UserProfile user={user} onRoleChange={handleRoleChange} onConfigClick={() => setActiveVertical('configuration')} />
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