import React, { useState, useEffect } from 'react';
import { useTheme } from './theme/useTheme';
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
import { usePushNotifications } from './hooks/usePushNotifications';

// Shell components
import LayoutShell from './app/shells/LayoutShell';
import ContentRouter from './app/shells/ContentRouter';

// Constants
import { VERTICALS as STATIC_VERTICALS, VERTICAL_LIST as STATIC_VERTICAL_LIST, updateStaticVerticals } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS } from './constants/roles';

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
  } = useAppNavigation();

  const {
    user, realUser, impersonatedUser, impersonationUsers,
    profileError,
    handleImpersonate,
    handleLogout,
  } = useAuth();

  const {
    fetchTasks,
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
  // Push notification registration + in-app bell state.
  // Mounted here so it is active for the entire authenticated session.
  usePushNotifications({ user });

  // SECURITY VALIDATION: Enforces vertical access based on RBAC rules.
  useEffect(() => {
    if (!user || !activeVertical) return;

    const isMasterAdmin = user.roleId === 'master_admin';
    const isGlobalScope = currentUserPermissions.scope === 'global';
    
    // Special admin-only views
    const isSpecialAdminView = ['user_management', 'role_management'].includes(activeVertical);
    if (isSpecialAdminView && !isMasterAdmin) {
      // 'rbac_guard' source: security rejection — not a real user navigation
      setActiveVertical(null, 'rbac_guard');
      return;
    }

    if (activeVertical === 'configuration' && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null, 'rbac_guard');
      return;
    }

    if (activeVertical === 'hub_management' && !isMasterAdmin && !currentUserPermissions.canAccessConfig) {
      setActiveVertical(null, 'rbac_guard');
      return;
    }

    if (activeVertical === 'daily_task_templates' && !currentUserPermissions.canAccessDailyTaskTemplates) {
      setActiveVertical(null, 'rbac_guard');
      return;
    }

    const verticalKeys = Object.keys(verticals);
    if (verticalKeys.includes(activeVertical)) {
      const isAssigned = user.assignedVerticals?.includes(activeVertical);
      if (!isAssigned && !isGlobalScope) {
        setActiveVertical(null, 'rbac_guard');
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
              <p className="error-message-text">{profileError}</p>
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

  // ─── LAYOUT SHELL SWITCHOVER ───────────────────────────────────────
  // All chrome (sidebar, header, nav) is now handled by LayoutShell.
  // AppShell only provides data props and renders ContentRouter.
  return (
    <LayoutShell
      user={user}
      permissions={currentUserPermissions}
      verticals={verticals}
      verticalList={verticalList}
      onLogout={handleLogout}
      realUser={realUser}
      impersonatedUser={impersonatedUser}
      impersonationUsers={impersonationUsers}
      onImpersonate={handleImpersonate}
    >
      <ContentRouter
        verticals={verticals}
        verticalList={verticalList}
        permissions={currentUserPermissions}
        rolePermissions={rolePermissions}
        setRolePermissions={setRolePermissions}
      />
    </LayoutShell>
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