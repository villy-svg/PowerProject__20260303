# RB-07 — Slim `App.jsx`

**Risk Level**: 🟡 Low | **Depends On**: RB-01 through RB-04 all complete | **Est. Time**: 1 hour

> ⛔ **BACKEND SAFETY**: This runbook removes dead code from App.jsx and moves inline
> styles to CSS classes. No service files, Supabase schema, or hooks are modified.

---

## Problem

After RB-01 through RB-04, App.jsx still has residual dead code: removed
state declarations may have leftover useEffects, stale imports, and inline JSX styling.
This runbook finalizes the cleanup and verifies App.jsx is under 250 lines.

---

## Pre-Flight Checks

All of RB-01, RB-02, RB-03, RB-04 must be complete:
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useAuth"         # Must exist
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useAppNavigation" # Must exist
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useTaskBoard"     # Must exist (if RB-04 done)
Get-ChildItem "src/registry" -Filter "verticalRegistry.js" | Select-String -Pattern "resolveVerticalComponents" # Must exist
```

---

## Step 1 — Audit remaining App.jsx contents

Open `src/App.jsx` and categorize every line into one of:
- **KEEP** — logic that must remain in App.jsx
- **REMOVE** — already handled by a context (duplicate)
- **MOVE** — should live somewhere else but hasn't been moved yet

### Lines to KEEP (non-negotiable)

```
useTheme() call + ThemeToggle import
useRBAC() call (needs user + activeVertical + verticals)
useOTAUpdate() — MUST stay in App.jsx (Rules of Hooks, cannot be conditional)
masterErrorHandler.testDatabaseConnection() useEffect
verticals + verticalList state (loaded async from DB)
initAppData() useEffect (loads verticals + session)
rolePermissions + setRolePermissions state
rolePermissions persistence useEffect
RBAC security validation useEffect
All rendering gates (isAppInitializing, !session, !user)
The main JSX layout (Sidebar, BottomNav, main content area)
AppNavigationProvider wrapper (from RB-03)
TaskBoardProvider wrapper (from RB-04)
```

### Lines to REMOVE (handled by contexts)

```
const [activeVertical, setActiveVertical] = useState(...)    → AppNavigationContext
const [isSidebarOpen, setIsSidebarOpen] = useState(...)      → AppNavigationContext
const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(...)→ AppNavigationContext
const [showBottomNavOverlay, ...] = useState(false)           → AppNavigationContext
const [session, ...] = useState(null)                         → AuthContext
const [realUser, ...] = useState(null)                        → AuthContext
const [impersonatedUser, ...] = useState(null)                → AuthContext
const [impersonationUsers, ...] = useState([])               → AuthContext
const [profileError, ...] = useState(null)                   → AuthContext
const [isAppInitializing, ...] = useState(true)               → AuthContext
const { tasks, setTasks, ... } = useTasks(user)               → TaskBoardContext
const { tasks: dailyTasks, ... } = useDailyTasks(...)         → TaskBoardContext
const escalationTasks = useMemo(...)                          → TaskBoardContext
const fetchUserProfile = async ...                            → AuthContext
const handleImpersonate = async ...                           → AuthContext
const handleLogout = async ...                                → AuthContext
localStorage sidebar useEffects                               → AppNavigationContext
localStorage activeVertical useEffect                         → AppNavigationContext
auth state listener useEffect                                 → AuthContext
impersonation users useEffect                                 → AuthContext
realUser localStorage persistence useEffect                   → AuthContext
```

---

## Step 2 — Remove duplicate imports

After the context extractions, these imports should no longer be needed in App.jsx:

```js
// REMOVE if no longer referenced in App.jsx body:
import { profileService } from './services/auth/profileService';
import { userService } from './services/auth/userService';
import { useTasks } from './hooks/useTasks';
import { useDailyTasks } from './hooks/useDailyTasks';
```

**KEEP**:
```js
import { authService } from './services/auth/authService'; // still used in initAppData
import { verticalService } from './services/core/verticalService'; // still used
import { masterErrorHandler } from './services/core/masterErrorHandler'; // still used
```

Verify each before removing:
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "profileService"   # Remove if 0 results
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "userService"      # Remove if 0 results
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useTasks\b"       # Remove if 0 results
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useDailyTasks"    # Remove if 0 results
```

---

## Step 3 — Fix inline styles in App.jsx JSX

Open App.jsx and find every `style={{...}}` attribute. Replace each with a CSS class.

### 3a. Loading screen inline styles

FIND:
```jsx
<div className="loading-screen" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
  <img src={powerLogo} className="loading-logo" alt="logo" style={{ width: '80px', marginBottom: '1rem' }} />
```

REPLACE WITH:
```jsx
<div className="loading-screen-layout">
  <img src={powerLogo} className="loading-logo" alt="logo" />
```

Add to `src/App.css`:
```css
.loading-screen-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
.loading-logo {
  width: 80px;
  margin-bottom: 1rem;
}
```

### 3b. Profile error heading (hardcoded `#ff4444`)

FIND:
```jsx
<h2 style={{ color: '#ff4444' }}>Profile Error</h2>
```

REPLACE WITH:
```jsx
<h2 className="error-heading">Profile Error</h2>
```

Add to `src/App.css`:
```css
.error-heading {
  color: var(--status-danger);
}
```

### 3c. Profile error button

FIND:
```jsx
<button
  onClick={handleLogout}
  style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
>
```

REPLACE WITH:
```jsx
<button onClick={handleLogout} className="halo-button error-logout-btn">
```

Add to `src/App.css`:
```css
.error-logout-btn {
  margin-top: 1rem;
}
```

### 3d. Impersonation active-user display

FIND:
```jsx
<span style={{ fontSize: '0.85rem', color: 'var(--text-color)', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '6px' }}>
```
and:
```jsx
<span className="neutral-badge" style={{ fontSize: '0.75rem', padding: '2px 6px', opacity: 0.8, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
```
and:
```jsx
<button
  className="halo-button"
  style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'var(--border-color)', color: 'var(--brand-green)', cursor: 'pointer' }}
  onClick={() => handleImpersonate(null)}
>
```

REPLACE WITH:
```jsx
<span className="impersonation-active-label">
```
```jsx
<span className="neutral-badge impersonation-role-badge">
```
```jsx
<button className="halo-button impersonation-stop-btn" onClick={() => handleImpersonate(null)}>
```

Add to `src/App.css`:
```css
.impersonation-active-label {
  font-size: 0.85rem;
  color: var(--text-color);
  opacity: 0.9;
  display: flex;
  align-items: center;
  gap: 6px;
}
.impersonation-role-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  opacity: 0.8;
}
.impersonation-stop-btn {
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--brand-green);
}
```

---

## Step 4 — Final App.jsx structure check

After all changes, App.jsx should have this skeleton (in order):

```
1. React + hook imports
2. Theme imports
3. CSS imports
4. Service imports (authService, verticalService, masterErrorHandler)
5. Hook imports (useRBAC, useOTAUpdate, useIsMobile if used)
6. Context imports (useAuth, useAppNavigation, useTaskBoard)
7. Constant imports (STATIC_VERTICALS, DEFAULT_ROLE_PERMISSIONS, etc.)
8. Component imports (Sidebar, BottomNav, VerticalWorkspace, ExecutiveSummary,
   Configuration, UserProfile, UserRoleManagement, UserManagement,
   HubManagement, HubFunctionManagement, DepartmentManagement,
   EmployeeRoleManagement, ClientCategoryManagement, ClientServiceManagement,
   ClientBillingModelManagement, DailyTasksManagement, Login)
9. Registry import (resolveVerticalComponents, resolveVerticalLabels, resolveHeaderClickTarget)
10. Asset import (powerLogo)

function App() {
  // Contexts
  const { darkMode } = useTheme();
  const { isAppInitializing, session, user, realUser, ... } = useAuth();
  const { activeVertical, setActiveVertical, ... } = useAppNavigation();
  const { tasks, activeTasks, ... } = useTaskBoard();

  // Local state (only what's NOT in contexts)
  const [verticals, setVerticals] = useState(STATIC_VERTICALS);
  const [verticalList, setVerticalList] = useState(STATIC_VERTICAL_LIST);
  const [rolePermissions, setRolePermissions] = useState(...);

  // Derived + hooks
  const currentUserPermissions = useRBAC(user, activeVertical, verticals);
  useOTAUpdate();

  // useEffects
  useEffect(() => { masterErrorHandler.testDatabaseConnection(); }, []);
  useEffect(() => { initAppData(); ... }, [fetchTasks]);
  useEffect(() => { /* rolePermissions persistence */ }, [rolePermissions]);
  useEffect(() => { /* RBAC security validation */ }, [user, activeVertical, ...]);
  useEffect(() => { /* impersonation users load */ }, [realUser]); // OR in AuthContext

  // Registry resolution
  const { SidebarComponent, ... } = resolveVerticalComponents(activeVertical, verticals);
  const { label, boardLabel } = resolveVerticalLabels(activeVertical, verticals);

  // Gates
  if (isAppInitializing) return ...;
  if (!session) return ...;
  if (!user) return ...;

  // Main render
  return (
    <AppNavigationProvider verticals={verticals}>
      <TaskBoardProvider user={user} verticals={verticals}>
        <div className="app-container" data-theme={...}>
          ...
        </div>
      </TaskBoardProvider>
    </AppNavigationProvider>
  );
}
```

---

## Step 5 — Line count verification

```powershell
(Get-Content "src/App.jsx").Count
# Target: under 300 lines (ideal: under 250)
```

---

## Step 6 — Full build + smoke test

```powershell
npm run build:staging
```

Run ALL smoke tests:
1. App loads from cold start ✓
2. Login → profile loads → dashboard shows ✓
3. Hub Task Board → tasks render in list, kanban, tree ✓
4. Add task → appears on board ✓
5. Employee Management → opens ✓
6. Client Management → opens ✓
7. Configuration → opens (admin only) ✓
8. User Management → opens (master_admin only) ✓
9. Logout → returns to login ✓
10. Refresh → returns to correct vertical ✓
11. Impersonation → works (master_admin only) ✓

---

## Step 7 — Commit checkpoint

After this runbook, commit to git with message:
```
refactor: RB-07 slim App.jsx - contexts extracted, inline styles removed
```

This is a safe checkpoint. All remaining runbooks (RB-08 through RB-12) are lower risk.
