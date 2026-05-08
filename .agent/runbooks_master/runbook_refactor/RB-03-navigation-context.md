# RB-03 — Extract `AppNavigationContext`

**Risk Level**: 🟠 Medium | **Depends On**: RB-02 complete | **Est. Time**: 2 hours

> ⛔ **BACKEND SAFETY**: This runbook moves navigation STATE into a React Context.
> It does NOT touch any file in `src/services/` or the Supabase schema.
> If you find yourself editing any service file — STOP.

> ⚠️ **CRITICAL PLACEMENT RULE**: `AppNavigationProvider` goes INSIDE `App()`, wrapping
> the main render return. It does NOT go in `main.jsx`. See Step 3b for the exact location.

---

## Problem

`src/App.jsx` owns UI navigation state: `activeVertical`, `isSidebarOpen`,
`isSubSidebarOpen`, `showBottomNavOverlay` — plus their persistence useEffects.
`setActiveVertical` is prop-drilled 4 levels deep into:
`App → VerticalWorkspace → TaskController → MasterPageHeader`.

---

## Objective

Extract navigation state to `src/app/contexts/AppNavigationContext.jsx`.
Components at any depth can call `useAppNavigation()` to get/set these values
without receiving them as props.

---

## Pre-Flight Checks

Confirm RB-02 is complete:
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useAuth"
# Must return a result (RB-02 was completed)
```

Confirm `src/app/contexts/` directory exists from RB-02.

---

## Step 1 — Create `src/app/contexts/AppNavigationContext.jsx`

```jsx
/**
 * AppNavigationContext.jsx
 * Provides global navigation state: activeVertical, sidebar visibility,
 * bottom nav overlay, and localStorage persistence for all nav preferences.
 *
 * IMPORTANT: The activeVertical persistence whitelist must stay in sync with
 * the persistent views defined in App.jsx. Only primary board views are persisted;
 * admin sub-views like 'hub_management' are intentionally transient.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const AppNavigationContext = createContext(null);

/** Views that should be remembered across page refresh */
const PERSISTENT_VERTICALS = [
  'home',
  'hub_tasks',
  'daily_hub_tasks',
  'daily_task_templates',
  'escalation_tasks',
  'employee_tasks',
  'client_tasks',
  'leads_funnel',
];

export function AppNavigationProvider({ verticals = {}, children }) {
  // ── Active Vertical ───────────────────────────────────────────────────────
  const [activeVertical, setActiveVerticalRaw] = useState(() => {
    const saved = localStorage.getItem('power_project_active_vertical');
    return (saved === 'home' || !saved) ? null : saved;
  });

  // ── Sidebar Visibility ────────────────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => localStorage.getItem('sidebar_state') === 'true'
  );

  const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sub_sidebar_state');
    return saved !== null ? saved === 'true' : true;
  });

  // ── Mobile Bottom Nav Overlay ─────────────────────────────────────────────
  const [showBottomNavOverlay, setShowBottomNavOverlay] = useState(false);

  // ── Smart setActiveVertical ───────────────────────────────────────────────
  /**
   * setActiveVertical wraps the raw setter with localStorage persistence.
   * Only primary board views are saved; admin sub-views are transient so
   * a page refresh doesn't land the user in an admin-only management screen.
   *
   * Also dynamically includes the DB-driven vertical IDs (e.g. 'CHARGING_HUBS')
   * from the verticals prop passed to the provider.
   */
  const setActiveVertical = (id) => {
    setActiveVerticalRaw(id);

    const dynamicIds = Object.values(verticals).map(v => v?.id).filter(Boolean);
    const allPersistent = [...PERSISTENT_VERTICALS, ...dynamicIds];

    if (id && allPersistent.includes(id)) {
      localStorage.setItem('power_project_active_vertical', id);
    } else if (!id) {
      localStorage.setItem('power_project_active_vertical', 'home');
    }
    // Admin sub-views ('hub_management', 'configuration', etc.) are NOT persisted
  };

  // ── Persist sidebar preferences ───────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('sidebar_state', String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('sub_sidebar_state', String(isSubSidebarOpen));
  }, [isSubSidebarOpen]);

  // ── Context Value ─────────────────────────────────────────────────────────
  const value = {
    activeVertical,
    setActiveVertical,
    isSidebarOpen,
    setIsSidebarOpen,
    isSubSidebarOpen,
    setIsSubSidebarOpen,
    showBottomNavOverlay,
    setShowBottomNavOverlay,
  };

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  );
}

/**
 * useAppNavigation — Consume navigation context from any component.
 * Throws if called outside AppNavigationProvider.
 */
export function useAppNavigation() {
  const ctx = useContext(AppNavigationContext);
  if (!ctx) {
    throw new Error('[useAppNavigation] Must be used inside <AppNavigationProvider>.');
  }
  return ctx;
}
```

---

## Step 2 — `src/main.jsx` — DO NOT MODIFY

The `AppNavigationProvider` needs the `verticals` map, which is loaded asynchronously
from Supabase in App.jsx. Placing the provider in `main.jsx` would cause it to render
before verticals are available.

> ⛔ **DO NOT add `AppNavigationProvider` to `main.jsx`.**
> It is placed INSIDE App.jsx's return statement (see Step 3b).

---

## Step 3 — Update `src/App.jsx`

### 3a. Add import
```js
import { AppNavigationProvider, useAppNavigation } from './app/contexts/AppNavigationContext';
```

### 3b. Create an inner component `AppWithNavigation`

The tricky part: `AppNavigationProvider` needs `verticals` (loaded async), so we can't
put it in `main.jsx`. Instead, split App.jsx into two components:

**PATTERN**: Keep App() as the auth+verticals loader. Once verticals are loaded, render
`<AppNavigationProvider>` and move all nav-consuming JSX into a child.

Here is the refactored structure for App.jsx (condensed — preserve all existing logic):

```jsx
// At top of file, after all imports:
function AppShell() {
  // This component consumes AppNavigationContext
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen, setIsSidebarOpen,
    isSubSidebarOpen, setIsSubSidebarOpen,
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  const { user, realUser, impersonatedUser, impersonationUsers,
          profileError, handleImpersonate, handleLogout } = useAuth();

  // ... ALL the existing App() body code (RBAC, task state, etc.) goes here
  // The ONLY state removed from here is the 4 nav states + their useEffects

  return (
    // ... exact same JSX as the current App() return
  );
}

function App() {
  const { darkMode } = useTheme();
  const { isAppInitializing, setIsAppInitializing, session, setSession,
          fetchUserProfile } = useAuth();
  const [verticals, setVerticals] = useState(STATIC_VERTICALS);
  const [verticalList, setVerticalList] = useState(STATIC_VERTICAL_LIST);

  // initAppData useEffect stays here (it sets verticals before nav is needed)
  useEffect(() => {
    const initAppData = async () => { /* ... exact same as current ... */ };
    initAppData();
  }, [/* deps */]);

  // Loading / Login / ProfileError gates stay here
  if (isAppInitializing) return <div data-theme={darkMode ? 'dark' : 'light'}>...</div>;
  if (!session) return <div data-theme={darkMode ? 'dark' : 'light'}><Login /></div>;

  return (
    <AppNavigationProvider verticals={verticals}>
      <AppShell verticals={verticals} verticalList={verticalList} />
    </AppNavigationProvider>
  );
}
```

### 3c. In AppShell — remove these 4 state declarations and their useEffects

**REMOVE state**:
```js
const [activeVertical, setActiveVertical] = useState(...)
const [isSidebarOpen, setIsSidebarOpen] = useState(...)
const [isSubSidebarOpen, setIsSubSidebarOpen] = useState(...)
const [showBottomNavOverlay, setShowBottomNavOverlay] = useState(false)
```

**REMOVE useEffects**:
```js
useEffect(() => { localStorage.setItem('sidebar_state', isSidebarOpen); }, [isSidebarOpen]);
useEffect(() => { localStorage.setItem('sub_sidebar_state', isSubSidebarOpen); }, [isSubSidebarOpen]);
useEffect(() => { if (activeVertical) { ... localStorage.setItem('power_project_active_vertical'...) } }, [activeVertical, verticals]);
```

These are now handled inside `AppNavigationContext`.

---

## Step 4 — Remove `setActiveVertical` prop from MasterPageHeader call chain

After this runbook, `MasterPageHeader` can call `useAppNavigation()` directly
instead of receiving `setActiveVertical` as a prop.

### 4a. Update `src/components/MasterPageHeader.jsx`

Add import:
```js
import { useAppNavigation } from '../app/contexts/AppNavigationContext';
```

Inside the component, replace `{ setActiveVertical }` from props with:
```js
const { setActiveVertical } = useAppNavigation();
```

Remove `setActiveVertical` from the component's prop destructuring at the top.

### 4b. Remove from caller in TaskController.jsx

In `src/components/TaskController.jsx`, find where `setActiveVertical` is passed to
`<MasterPageHeader setActiveVertical={setActiveVertical} ...>` and remove that prop.

### 4c. Remove from caller in VerticalWorkspace.jsx

In `src/components/VerticalWorkspace.jsx`, find where `setActiveVertical` is passed to
`<TaskController setActiveVertical={setActiveVertical} ...>` and remove that prop.

---

## Step 5 — Verification

### 5a. Grep for prop-drilled setActiveVertical chains
```powershell
Get-ChildItem "src/components" -Filter "VerticalWorkspace.jsx" | Select-String -Pattern "setActiveVertical"
# Should show 0 instances of passing it as a prop (it may still USE it locally via context)
```

### 5b. Build
```powershell
npm run build:staging
```

### 5c. Smoke tests
1. Navigate between Hub → Employees → Clients — active vertical changes correctly
2. Refresh page — returns to previously active vertical (persistence works)
3. Open sidebar, close sidebar — sidebar state persists on refresh
4. Navigate to `configuration` — then refresh — should NOT return to configuration (transient view)

---

## Common Pitfalls

### Pitfall 1: RBAC validation useEffect breaks
**Symptom**: Users can access verticals they shouldn't after refresh.
**Cause**: The RBAC validation `useEffect` in App.jsx depends on both `user` and
`activeVertical`. If `activeVertical` now comes from context while `user` comes from
auth, make sure the useEffect dep array includes both: `[user, activeVertical, currentUserPermissions, verticals]`.

### Pitfall 2: Sub-views not persisted
**Symptom**: Navigating to 'daily_hub_tasks' and refreshing returns to 'CHARGING_HUBS'.
**Cause**: The `PERSISTENT_VERTICALS` list in AppNavigationContext is missing sub-view IDs.
**Fix**: Add all sub-view IDs to `PERSISTENT_VERTICALS` constant.

### Pitfall 3: Provider renders before verticals load
**Symptom**: After refresh, lands on wrong vertical or null.
**Cause**: `AppNavigationProvider` renders before async verticals are fetched.
**Fix**: The `verticals` prop update to `AppNavigationProvider` is reactive — React will
re-render the provider when verticals change. The `setActiveVertical` function reads
`verticals` from the prop closure, so initially dynamic IDs aren't in the persist list
until verticals load. This is acceptable since static sub-view strings cover 99% of cases.

---

## Rollback

```powershell
git checkout src/App.jsx src/components/MasterPageHeader.jsx src/components/VerticalWorkspace.jsx src/components/TaskController.jsx
# Delete: src/app/contexts/AppNavigationContext.jsx
```

## Commit Checkpoint

After the build succeeds AND navigation smoke tests pass:
```powershell
git add -A
git commit -m "refactor: RB-03 extract AppNavigationContext"
```
