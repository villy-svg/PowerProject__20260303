# RB2-05: AppShell Switchover — LayoutShell Integration

## Objective
Rewire `App.jsx`'s `AppShell` function to use the new `LayoutShell` orchestrator from the shell
system. This is the "flip the switch" runbook — after this, the application routes through
`LayoutShell → DesktopLayout / MobileLayout` instead of the monolithic `AppShell`.

**Critical constraint**: The content routing (the ternary chain in `<main className="app-content">`)
must remain IDENTICAL. We are only swapping the chrome around it, not the content inside it.

---

## Pre-Flight Checks

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"

# 1. Confirm RB2-04 commit exists
git log --oneline -4

# 2. Build passes
npm run build

# 3. Snapshot App.jsx for rollback
Copy-Item "src\App.jsx" "src\App.jsx.bak"
```

---

## Step 1: Understand Current AppShell Structure

The current `AppShell` (lines 53–311 of App.jsx) handles:

1. **Context consumption** (lines 55–73) — useAppNavigation, useAuth, useTaskBoard
2. **Role permissions state** (lines 75–89) — localStorage-persisted permissions
3. **RBAC useEffect** (lines 95–130) — vertical access validation
4. **Profile error gate** (lines 138–159) — shows error if no user
5. **Vertical component resolution** (lines 161–166) — resolveVerticalComponents
6. **Chrome rendering** (lines 168–309):
   - Logo button
   - Sidebar
   - Brand title
   - Sidebar overlay
   - App header with impersonation
   - Content ternary chain
   - BottomNav

**What moves to shells**: Items 5 (chrome rendering) — specifically: logo, sidebar,
overlay, header, and BottomNav.

**What stays in AppShell**: Items 1-4 (context consumption, permissions, RBAC, error gates)
and the content ternary chain.

---

## Step 2: Create Content Router Component

Extract the content ternary chain into a separate component for clarity.
This component is what both shells render inside their content area.

**File**: `src/app/shells/ContentRouter.jsx`

```jsx
/**
 * ContentRouter.jsx
 *
 * Pure content routing component. Determines which page/vertical/management
 * view to render based on activeVertical. This is the exact same ternary
 * chain from the original App.jsx AppShell, extracted for clarity.
 *
 * This component NEVER renders chrome (sidebar, header, nav).
 * It only decides WHAT content to show.
 *
 * Skill compliance:
 * - development-best-practices §4 Component Architecture
 * - development-best-practices §10 Service & Data Fetching Layer
 */

import React from 'react';

// Components
import VerticalWorkspace from '../../components/VerticalWorkspace';
import ExecutiveSummary from '../../components/ExecutiveSummary';
import Configuration from '../../components/Configuration';
import UserRoleManagement from '../../components/UserRoleManagement';
import UserManagement from '../../components/UserManagement';

// Vertical Management Pages
import {
  HubManagement, HubFunctionManagement, DailyTasksManagement,
} from '../../verticals/ChargingHubs';
import {
  EmployeeManagement, DepartmentManagement, EmployeeRoleManagement,
} from '../../verticals/Employees';
import {
  ClientManagement, ClientCategoryManagement, ClientBillingModelManagement, ClientServiceManagement,
} from '../../verticals/Clients';

// Contexts
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTaskBoard } from '../contexts/TaskBoardContext';
import { useAuth } from '../contexts/AuthContext';

// Registry
import { resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget } from '../../registry/verticalRegistry';

const ContentRouter = ({
  verticals,
  verticalList,
  permissions,
  rolePermissions,
  setRolePermissions,
}) => {
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen,
    isSubSidebarOpen, setIsSubSidebarOpen,
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  const {
    tasks, setTasks, tasksLoading, fetchTasks,
    activeTasks, activeAddTask, activeUpdateTask,
    activeUpdateTaskStage, activeBulkUpdateTasks, activeDeleteTask,
  } = useTaskBoard();

  const { user } = useAuth();

  // Resolve vertical-specific components
  const { SidebarComponent, TaskFormComponent, TaskTileComponent } =
    resolveVerticalComponents(activeVertical, verticals);
  const { label: workspaceLabel, boardLabel: workspaceBoardLabel } =
    resolveVerticalLabels(activeVertical, verticals);
  const headerClickTarget =
    resolveHeaderClickTarget(activeVertical, verticals, permissions);

  // Helper for BottomNav overlay toggle
  const onShowBottomNav = () => setShowBottomNavOverlay(prev => !prev);

  if (!activeVertical) {
    return (
      <ExecutiveSummary
        tasks={tasks}
        user={user}
        permissions={permissions}
        verticals={verticals}
        verticalList={verticalList}
        loading={tasksLoading}
      />
    );
  }

  if (activeVertical === 'configuration') {
    return (
      <Configuration
        tasks={tasks}
        setTasks={setTasks}
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
        verticals={verticals}
        verticalList={verticalList}
      />
    );
  }

  if (activeVertical === 'role_management') {
    return (
      <UserRoleManagement
        permissions={rolePermissions}
        setPermissions={setRolePermissions}
        onBack={() => setActiveVertical('configuration')}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'user_management') {
    return (
      <UserManagement
        currentUser={user}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'hub_management') {
    return (
      <HubManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'hub_function_management') {
    return (
      <HubFunctionManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'department_management') {
    return (
      <DepartmentManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'employee_role_management') {
    return (
      <EmployeeRoleManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_category_management') {
    return (
      <ClientCategoryManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_service_management') {
    return (
      <ClientServiceManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  if (activeVertical === 'client_billing_model_management') {
    return (
      <ClientBillingModelManagement
        user={user}
        permissions={permissions}
        setActiveVertical={setActiveVertical}
        onShowBottomNav={onShowBottomNav}
      />
    );
  }

  // Default: VerticalWorkspace (task board view)
  return (
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
      onShowBottomNav={onShowBottomNav}
      SidebarComponent={SidebarComponent}
      TaskFormComponent={TaskFormComponent}
      TaskTileComponent={TaskTileComponent}
      onHeaderClick={headerClickTarget ? () => setActiveVertical(headerClickTarget) : null}
      user={user}
      permissions={permissions}
      verticals={verticals}
    >
      {activeVertical === verticals.EMPLOYEES?.id && (
        <EmployeeManagement user={user} permissions={permissions} tasks={tasks.filter(t => t.verticalId === verticals.EMPLOYEES?.id)} />
      )}
      {activeVertical === verticals.CLIENTS?.id && (
        <ClientManagement user={user} permissions={permissions} tasks={tasks.filter(t => t.verticalId === verticals.CLIENTS?.id)} />
      )}
      {activeVertical === 'daily_task_templates' && (
        <DailyTasksManagement permissions={permissions} refreshTasks={fetchTasks} currentUser={user} />
      )}
    </VerticalWorkspace>
  );
};

export default ContentRouter;
```

---

## Step 3: Refactor `AppShell` in App.jsx

The `AppShell` function in `App.jsx` now becomes slim:

1. Consumes contexts (auth, navigation, task board)
2. Manages role permissions
3. Runs RBAC validation
4. Renders `LayoutShell` with `ContentRouter` as children

### Targeted Changes to `src/App.jsx`:

#### 3A. Add imports at the top:

```jsx
import LayoutShell from './app/shells/LayoutShell';
import ContentRouter from './app/shells/ContentRouter';
```

#### 3B. Remove imports that move to ContentRouter/shells:

```diff
-import Sidebar from './components/Sidebar';
-import BottomNav from './components/BottomNav';
-import VerticalWorkspace from './components/VerticalWorkspace';
-import ExecutiveSummary from './components/ExecutiveSummary';
-import Configuration from './components/Configuration';
-import UserProfile from './components/UserProfile';
-import UserRoleManagement from './components/UserRoleManagement';
-import UserManagement from './components/UserManagement';
-import CustomSelect from './components/CustomSelect';
-import {
-  HubManagement, HubFunctionManagement, DailyTasksManagement,
-} from './verticals/ChargingHubs';
-import {
-  EmployeeManagement, DepartmentManagement, EmployeeRoleManagement,
-} from './verticals/Employees';
-import {
-  ClientManagement, ClientCategoryManagement, ClientBillingModelManagement, ClientServiceManagement,
-} from './verticals/Clients';
```

Also remove the unused imports:
```diff
-import { resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget } from './registry/verticalRegistry';
```

Keep: `useTheme`, `useAuth`, `useAppNavigation`, `useTaskBoard`, `useRBAC`, `useOTAUpdate`,
`DEFAULT_ROLE_PERMISSIONS`, `VERTICALS`, `VERTICAL_LIST`, `updateStaticVerticals`, `powerLogo`.

#### 3C. Rewrite the AppShell return JSX:

```jsx
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
```

#### 3D. The `App` function and the bottom `export default App` remain UNCHANGED.

---

## Step 4: Update Shell Barrel Export

Add `ContentRouter` to `src/app/shells/index.js`:

```js
export { default as ContentRouter } from './ContentRouter';
```

---

## Verification Checklist

```powershell
# 1. Build check — CRITICAL
npm run build

# 2. Check diff size
git diff --stat
# Expected: App.jsx significantly smaller, ContentRouter.jsx new

# 3. Desktop test (> 768px):
#   - Sidebar appears inline on left
#   - Top header shows impersonation controls
#   - Dashboard renders with ExecutiveSummary
#   - Click into a vertical — VerticalWorkspace renders
#   - Management pages render (Hub Management, etc.)
#   - NO BottomNav visible

# 4. Mobile test (≤ 768px):
#   - Sidebar is a drawer (slides from left)
#   - BottomNav appears at bottom
#   - Logo and brand title hidden when in a vertical
#   - Mobile action tray appears in verticals
#   - Management pages render correctly

# 5. RBAC test:
#   - Non-admin users cannot access admin views
#   - Vertical access restrictions still work
```

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-05: AppShell switchover — LayoutShell orchestration, ContentRouter extraction"
```

---

## Files Created / Modified

| File | Action | Lines | Purpose |
|---|---|---|---|
| `src/app/shells/ContentRouter.jsx` | NEW | ~200 | Content routing (extracted from AppShell) |
| `src/App.jsx` | MODIFIED | ~-100 lines | Slim AppShell using LayoutShell |
| `src/app/shells/index.js` | MODIFIED | +1 line | ContentRouter export |

---

## Rollback Procedure

If the build fails or regressions are found:

```powershell
# Restore App.jsx from backup
Copy-Item "src\App.jsx.bak" "src\App.jsx" -Force

# Remove ContentRouter (it's new, safe to delete)
Remove-Item "src\app\shells\ContentRouter.jsx" -Force

# Verify rollback
npm run build
```
