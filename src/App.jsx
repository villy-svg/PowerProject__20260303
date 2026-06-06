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
import { MobileLongPressProvider } from './app/contexts/MobileLongPressContext';
import { useRBAC } from './hooks/useRBAC';
import { useOTAUpdate } from './hooks/useOTAUpdate';
import { usePushNotifications } from './hooks/usePushNotifications';

// Shell components
import LayoutShell from './app/shells/LayoutShell';
import ContentRouter from './app/shells/ContentRouter';

// Constants
import { VERTICALS as STATIC_VERTICALS, VERTICAL_LIST as STATIC_VERTICAL_LIST, updateStaticVerticals } from './constants/verticals';
import { DEFAULT_ROLE_PERMISSIONS } from './constants/roles';
import { APP_VERSION } from './constants/appVersion';

import Login from './components/Login';
import PendingActivation from './components/PendingActivation';
import OnlineSyncBanner from './components/OnlineSyncBanner';
import TutorialSlideshowViewer from './features/tutorials/TutorialSlideshowViewer';
import { TUTORIAL_FLOWS, parseRuleSlides } from './features/tutorials/TutorialHub';
import { fetchRules } from './services/employees/rulesService';
import { getRuleLogo, LOGO_KEYWORD_MAPPINGS } from './features/tutorials/logoConfig';

// TanStack Query Imports
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // Keep cached data for 24 hours
      staleTime: 1000 * 60 * 5,    // Consider data stale after 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'power_project_react_query_cache',
});


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

  // Onboarding Slideshow Autoplay State (Queue-based sequential player)
  const [tutorialQueue, setTutorialQueue] = useState([]);
  const [currentTutorialIndex, setCurrentTutorialIndex] = useState(-1);

  const rawOnboardingFlow = TUTORIAL_FLOWS.find(f => f.layout === 'onboarding');
  const onboardingFlow = React.useMemo(() => {
    if (!rawOnboardingFlow) return null;
    
    // Apply metadata overrides (title, description, category) from local storage
    let flow = { ...rawOnboardingFlow };
    const metaOverrideKey = `powerpod_tutorial_meta_override_${flow.id}`;
    const metaOverrideStr = localStorage.getItem(metaOverrideKey);
    if (metaOverrideStr) {
      try {
        const parsedMeta = JSON.parse(metaOverrideStr);
        flow.title = parsedMeta.title ?? flow.title;
        flow.description = parsedMeta.description ?? flow.description;
        flow.category = parsedMeta.category ?? flow.category;
      } catch (e) {
        console.error('[AppShell] Meta override parse failed for onboarding:', e);
      }
    }

    // 1. Check for full array override (supports add/delete slides)
    const arrayOverrideKey = `powerpod_tutorial_override_array_${flow.id}`;
    const arrayOverrideStr = localStorage.getItem(arrayOverrideKey);
    if (arrayOverrideStr) {
      try {
        const parsedArray = JSON.parse(arrayOverrideStr);
        if (Array.isArray(parsedArray)) {
          return {
            ...flow,
            desktopSlides: parsedArray,
            mobileSlides: parsedArray
          };
        }
      } catch (e) {
        console.error('[AppShell] Array override parse failed for onboarding flow:', e);
      }
    }

    // 2. Check for legacy index-based override
    const legacyOverrideKey = `powerpod_tutorial_override_${flow.id}`;
    const legacyOverrideStr = localStorage.getItem(legacyOverrideKey);
    if (!legacyOverrideStr) return flow;

    try {
      const overrides = JSON.parse(legacyOverrideStr);
      const mapOverride = (slidesList) => slidesList.map((slide, idx) => {
        if (overrides[idx]) {
          return {
            ...slide,
            title: overrides[idx].title ?? slide.title,
            text: overrides[idx].text ?? slide.text ?? slide.caption,
            caption: overrides[idx].text ?? slide.caption
          };
        }
        return slide;
      });

      return {
        ...flow,
        desktopSlides: mapOverride(flow.desktopSlides || []),
        mobileSlides: mapOverride(flow.mobileSlides || [])
      };
    } catch (e) {
      console.error('[AppShell] Legacy override parse failed for onboarding flow:', e);
      return flow;
    }
  }, [rawOnboardingFlow]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlShiftR = e.ctrlKey && e.shiftKey && (e.key === 'R' || e.key === 'r' || e.keyCode === 82);
      const isCtrlF5 = e.ctrlKey && (e.key === 'F5' || e.keyCode === 116);
      if (isCtrlShiftR || isCtrlF5) {
        console.log('[App] Hard reload detected via keypress. Clearing intro tutorial seen flags...');
        localStorage.removeItem(`intro_tutorial_seen_${APP_VERSION}`);
        localStorage.removeItem(`intro_tutorial_seen_standalone_${APP_VERSION}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (user && user.isActive !== false) {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const storageKey = isStandalone ? `intro_tutorial_seen_standalone_${APP_VERSION}` : `intro_tutorial_seen_${APP_VERSION}`;
        const seen = localStorage.getItem(storageKey);
        if (!seen) {
          try {
            // Load rules to check for special condition tutorials
            const rulesData = await fetchRules({ activeOnly: true });
            const specialRules = rulesData.filter(rule => {
              const catName = rule.category?.name?.toLowerCase() || '';
              const title = rule.title?.toLowerCase() || '';
              const matchesKeyword = LOGO_KEYWORD_MAPPINGS.some(mapping =>
                mapping.keywords.some(kw => title.includes(kw))
              );
              return catName.includes('special') || matchesKeyword;
            });

            const queue = [];
            if (onboardingFlow) {
              queue.push(onboardingFlow);
            }

            specialRules.forEach(rule => {
              const parsedSlides = parseRuleSlides(rule.title, rule.content || '');
              const flowSlides = parsedSlides.map((slide, idx) => {
                const imgPath = getRuleLogo(rule.title, idx);
                return {
                  image: imgPath,
                  fallbackImage: imgPath,
                  title: slide.isIntro ? rule.title : slide.title,
                  text: slide.text,
                  annotations: []
                };
              });

              queue.push({
                id: `rule_${rule.id}`,
                title: rule.title,
                category: rule.category?.name || 'Rules & Regulations',
                description: rule.impact || `Interactive guidelines detailing ${rule.title}.`,
                accessLevel: 'All Users',
                badgeColor: 'rgba(16, 185, 129, 0.1)',
                badgeText: '#10b981',
                layout: 'onboarding',
                desktopSlides: flowSlides,
                mobileSlides: flowSlides
              });
            });

            if (queue.length > 0) {
              setTutorialQueue(queue);
              setCurrentTutorialIndex(0);
            }
          } catch (err) {
            console.error('Error loading onboarding rules:', err);
            if (onboardingFlow) {
              setTutorialQueue([onboardingFlow]);
              setCurrentTutorialIndex(0);
            }
          }
        }
      }
    };
    checkOnboarding();
  }, [user, onboardingFlow]);

  const handleCloseTutorial = (completed = false) => {
    const activeTutorial = tutorialQueue[currentTutorialIndex];
    const isSpecial = activeTutorial && activeTutorial.id !== 'customer_support';
    const isMasterAdmin = user?.roleId === 'master_admin';

    // Enforcement: do not allow skip unless completed or master admin
    if (!completed && !isMasterAdmin && isSpecial) {
      alert("You must complete this special conditions tutorial. Skipping is not allowed.");
      return;
    }

    if (currentTutorialIndex < tutorialQueue.length - 1) {
      setCurrentTutorialIndex(currentTutorialIndex + 1);
    } else {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const storageKey = isStandalone ? `intro_tutorial_seen_standalone_${APP_VERSION}` : `intro_tutorial_seen_${APP_VERSION}`;
      localStorage.setItem(storageKey, 'true');
      setTutorialQueue([]);
      setCurrentTutorialIndex(-1);
    }
  };

  // SECURITY VALIDATION: Enforces vertical access based on RBAC rules.
  useEffect(() => {
    if (!user || !activeVertical) return;

    const isMasterAdmin = user.roleId === 'master_admin';
    const isGlobalScope = currentUserPermissions.scope === 'global';
    
    // Special admin-only views
    const isSpecialAdminView = ['user_management', 'role_management', 'rule_management'].includes(activeVertical);
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

  // Security gate: Block inactive users from entering the layout or fetching any further workspace data
  if (user.isActive === false) {
    return <PendingActivation onLogout={handleLogout} />;
  }

  // ─── LAYOUT SHELL SWITCHOVER ───────────────────────────────────────
  // All chrome (sidebar, header, nav) is now handled by LayoutShell.
  // AppShell only provides data props and renders ContentRouter.
  return (
    <>
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

      {currentTutorialIndex >= 0 && tutorialQueue[currentTutorialIndex] && (
        <TutorialSlideshowViewer
          flow={tutorialQueue[currentTutorialIndex]}
          platform={window.innerWidth <= 768 ? 'mobile' : 'desktop'}
          onClose={handleCloseTutorial}
          user={user}
          permissions={currentUserPermissions}
          preventSkip={tutorialQueue[currentTutorialIndex].id !== 'customer_support' && user?.roleId !== 'master_admin'}
          onlyFirstSlide={true}
        />
      )}
    </>
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
        // --- Cache Auto-Clean Logic ---
        const cachedVersion = localStorage.getItem('last_app_version');
        if (cachedVersion !== APP_VERSION) {
          console.log(`[Cache] Version mismatch: ${cachedVersion} -> ${APP_VERSION}. Clearing caches...`);
          try {
            if (window.caches) {
              const keys = await window.caches.keys();
              await Promise.all(keys.map(key => window.caches.delete(key)));
            }
          } catch (e) {
            console.warn('[Cache] Failed to clear caches:', e);
          }
          localStorage.setItem('last_app_version', APP_VERSION);
        }
        // ------------------------------

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
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: localStoragePersister }}
    >
      <AppNavigationProvider verticals={verticals}>
        <TaskBoardProvider user={user} verticals={verticals}>
          <MobileLongPressProvider>
            <OnlineSyncBanner />
            <AppShell verticals={verticals} verticalList={verticalList} />
          </MobileLongPressProvider>
        </TaskBoardProvider>
      </AppNavigationProvider>
    </PersistQueryClientProvider>
  );
}

export default App;