import React, { useState, useEffect } from 'react';
import { useTheme } from './theme/useTheme';
import ThemeToggle from './theme/themeToggle'; 
import './App.css';

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

  /**
   * 1. PERSISTENT USER STATE
   * Ensures assignedVerticals is always initialized as an array.
   */
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('power_project_user');
    if (!savedUser) return {
      name: "Alex Rivera",
      role: "Master Admin",
      roleId: "master_admin",
      assignedVerticals: ["v1"], 
      id: "u1"
    };
    
    try {
      const parsed = JSON.parse(savedUser);
      // Migration: Ensure assignedVerticals exists if loading an old singular record
      return {
        ...parsed,
        assignedVerticals: parsed.assignedVerticals || (parsed.assignedVertical ? [parsed.assignedVertical] : ["v1"])
      };
    } catch {
      return { name: "Alex Rivera", role: "Master Admin", roleId: "master_admin", assignedVerticals: ["v1"], id: "u1" };
    }
  });

  // 2. PERSISTENT PERMISSIONS
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

  const [activeVertical, setActiveVertical] = useState(null);
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('power_project_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  // Sync effects
  useEffect(() => { localStorage.setItem('power_project_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('power_project_permissions', JSON.stringify(rolePermissions)); }, [rolePermissions]);
  useEffect(() => { localStorage.setItem('power_project_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('sidebar_state', isSidebarOpen); }, [isSidebarOpen]);
  useEffect(() => { localStorage.setItem('sub_sidebar_state', isSubSidebarOpen); }, [isSubSidebarOpen]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  /**
   * REFACTORED ROLE CHANGE HANDLER
   * Fixes the TypeError by ensuring prev.assignedVerticals is always treated as an array.
   */
  const handleRoleChange = (roleId, assignedVerticalId) => {
    const roleLabels = {
      master_admin: "Master Admin",
      vertical_admin: "Vertical Admin",
      master_viewer: "Master Viewer",
      vertical_viewer: "Vertical Viewer"
    };
    
    setUser(prev => {
      // Fix: Use a fallback empty array to prevent spreading undefined/null
      const currentVerticals = Array.isArray(prev?.assignedVerticals) ? prev.assignedVerticals : [];
      let newVerticals = [...currentVerticals];
      
      if (assignedVerticalId && !newVerticals.includes(assignedVerticalId)) {
        newVerticals.push(assignedVerticalId);
      }

      return {
        ...prev,
        roleId: roleId,
        role: roleLabels[roleId],
        assignedVerticals: newVerticals 
      };
    });
    setActiveVertical(null);
  };

  // Helpers
  const deleteTask = (taskId) => {
    if (window.confirm("Delete this task?")) {
      setTasks(tasks.filter(t => t.id !== taskId));
    }
  };

  const updateTaskStage = (taskId, newStageId) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, stageId: newStageId } : t));
  };

  const currentUserPermissions = rolePermissions[user.roleId] || DEFAULT_ROLE_PERMISSIONS[user.roleId];

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
              <button className={`logo-button ${isSidebarOpen ? 'hidden' : ''}`} onClick={toggleSidebar}>
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
                setTasks={setTasks}
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