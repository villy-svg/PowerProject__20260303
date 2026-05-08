# RB-02 — Extract `AuthContext`

**Risk Level**: 🔴 High | **Depends On**: RB-01 complete | **Est. Time**: 2 hours

> ⛔ **BACKEND SAFETY**: This runbook moves auth STATE into a React Context.
> It does NOT modify `src/services/auth/authService.js`, `profileService.js`,
> or `userService.js`. Those files are READ ONLY in this runbook.
> If you find yourself editing any service file — STOP.

> ⚠️ **HIGH RISK**: A mistake in this runbook will cause a blank screen or broken login.
> Complete every step, run the build, smoke-test login before moving to RB-03.

---

## Problem

`src/App.jsx` owns all authentication state: `session`, `realUser`, `impersonatedUser`,
`impersonationUsers`, `profileError`, `isAppInitializing`, plus `fetchUserProfile`,
`handleImpersonate`, `handleLogout`. This forces App.jsx to be 631 lines and forces
the `user` object to be prop-drilled through 4+ component levels.

---

## Objective

Extract all auth state and logic into `src/app/contexts/AuthContext.jsx`.
Wrap the app in `<AuthProvider>` in `main.jsx`.
Replace all auth state in `App.jsx` with a single `useAuth()` call.

---

## Pre-Flight Checks

Verify these service files exist (they will be imported into the new context):
```
src/services/auth/authService.js      ✓
src/services/auth/profileService.js   ✓
src/services/auth/userService.js      ✓
```

Confirm `src/main.jsx` currently looks like:
```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
```

---

## Step 1 — Create directory `src/app/contexts/`

```powershell
mkdir src/app
mkdir src/app/contexts
```

---

## Step 2 — Create `src/app/contexts/AuthContext.jsx`

```jsx
/**
 * AuthContext.jsx
 * Provides authentication state and identity management to the entire app.
 * Extracts: session, realUser, impersonatedUser, impersonationUsers, profileError,
 *           isAppInitializing, fetchUserProfile, handleImpersonate, handleLogout.
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * 1. The hasBootstrapped ref prevents double profile fetch on startup.
 *    initAppData() fetches the profile on boot; the auth state listener fires
 *    immediately with the current session which would trigger a second concurrent
 *    fetch without this guard.
 * 2. fetchUserProfile is exposed so App.jsx can call it from initAppData().
 */
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authService } from '../../services/auth/authService';
import { profileService } from '../../services/auth/profileService';
import { userService } from '../../services/auth/userService';

// Create context with null default — consumers must be inside AuthProvider
const AuthContext = createContext(null);

/**
 * AuthProvider
 * Wraps the application and provides auth state to all descendants.
 * Must be placed above any component that calls useAuth().
 */
export function AuthProvider({ children }) {
  // ── Initialization State ──────────────────────────────────────────────────
  const [isAppInitializing, setIsAppInitializing] = useState(true);

  // ── Session & Identity ────────────────────────────────────────────────────
  const [session, setSession] = useState(null);
  const [realUser, setRealUser] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [impersonationUsers, setImpersonationUsers] = useState([]);
  const [profileError, setProfileError] = useState(null);

  // ── Bootstrap Guard ───────────────────────────────────────────────────────
  // The auth state listener fires once immediately with the current session.
  // We skip that first fire because initAppData (in App.jsx) already handles it.
  const hasBootstrapped = useRef(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  // The effective user is the impersonated user if active, else the real user.
  const user = impersonatedUser || realUser;

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * fetchUserProfile — Load profile from Supabase by userId.
   * Called by: initAppData() in App.jsx, and the auth state listener below.
   * EXPOSED in context so App.jsx can call it during app initialization.
   */
  const fetchUserProfile = async (userId) => {
    try {
      const userData = await profileService.fetchUserProfile(userId);
      setRealUser(userData);
      setProfileError(null);
      return userData;
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      setProfileError(error.message);
      return null;
    }
  };

  /**
   * handleImpersonate — Switch the effective user identity.
   * Passing null stops impersonation and restores the real user.
   */
  const handleImpersonate = async (targetUserId) => {
    if (!targetUserId) {
      setImpersonatedUser(null);
      return;
    }
    try {
      const targetProfile = await profileService.fetchUserProfile(targetUserId);
      setImpersonatedUser(targetProfile);
    } catch (error) {
      console.error('[AuthContext] Impersonation failed:', error);
    }
  };

  /**
   * handleLogout — Sign out and clear profile error state.
   */
  const handleLogout = async () => {
    await authService.signOut();
    setProfileError(null);
  };

  // ── Auth State Listener ───────────────────────────────────────────────────
  // Listens for login / logout events AFTER the initial bootstrap.
  // The hasBootstrapped ref prevents double-fetch on startup.
  useEffect(() => {
    const subscription = authService.onAuthStateChange((_event, newSession) => {
      // Skip the first fire — initAppData in App.jsx handles the initial load
      if (!hasBootstrapped.current) {
        hasBootstrapped.current = true;
        return;
      }
      setSession(newSession);
      if (newSession) {
        fetchUserProfile(newSession.user.id);
      } else {
        setRealUser(null);
        setImpersonatedUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Impersonation User List ───────────────────────────────────────────────
  // Only loaded for master_admin users. Provides the dropdown options.
  useEffect(() => {
    if (realUser?.roleId === 'master_admin') {
      userService.fetchUsers()
        .then(data => setImpersonationUsers(data))
        .catch(err => console.error('[AuthContext] Impersonation users failed to load:', err));
    }
  }, [realUser?.roleId]);

  // ── localStorage Persistence ──────────────────────────────────────────────
  useEffect(() => {
    if (realUser) {
      localStorage.setItem('power_project_user', JSON.stringify(realUser));
    }
  }, [realUser]);

  // ── Context Value ─────────────────────────────────────────────────────────
  const value = {
    // State
    isAppInitializing,
    setIsAppInitializing,
    session,
    setSession,
    user,
    realUser,
    impersonatedUser,
    impersonationUsers,
    profileError,
    // Actions
    fetchUserProfile,
    handleImpersonate,
    handleLogout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth — Custom hook to consume AuthContext.
 * Throws if called outside AuthProvider (catches missing provider early).
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('[useAuth] Must be used inside <AuthProvider>. Check main.jsx wrapping.');
  }
  return ctx;
}
```

---

## Step 3 — Update `src/main.jsx`

Open `src/main.jsx`. It currently renders `<App />` inside `<React.StrictMode>`.

### Add the import:
```js
import { AuthProvider } from './app/contexts/AuthContext';
```

### Wrap the render:
```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

---

## Step 4 — Update `src/App.jsx`

### 4a. Add import
```js
import { useAuth } from './app/contexts/AuthContext';
```

### 4b. Remove these imports from App.jsx (no longer needed here)
```js
import { profileService } from './services/auth/profileService';
import { userService } from './services/auth/userService';
```
> ⚠️ **DO NOT remove `authService`**. It is still needed in App.jsx for
> `authService.getSession()` inside `initAppData`. Removing it will break app boot.

Verify BOTH removals are safe:
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "profileService"
# Expected: 0 results (safe to remove)
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "userService"
# Expected: 0 results (safe to remove)
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "authService"
# Expected: still has results (MUST NOT be removed)
```

### 4c. Remove these state declarations from inside the App() function
Find and DELETE:
```js
const [isAppInitializing, setIsAppInitializing] = useState(true);
const [session, setSession] = useState(null);
const [realUser, setRealUser] = useState(null);
const [impersonatedUser, setImpersonatedUser] = useState(null);
const [impersonationUsers, setImpersonationUsers] = useState([]);
const [profileError, setProfileError] = useState(null);
```

### 4d. Remove these functions from App()
Find and DELETE:
```js
const fetchUserProfile = async (userId) => { ... };
const handleImpersonate = async (targetUserId) => { ... };
const handleLogout = async () => { ... };
```

### 4e. Remove these useEffects from App()
Find and DELETE:
1. The auth state listener useEffect (the one with `authService.onAuthStateChange`)
2. The `useEffect(() => { if (realUser?.roleId === 'master_admin') { userService.fetchUsers()...` block
3. The `useEffect(() => { if (realUser) localStorage.setItem('power_project_user'...` block

### 4f. Add the useAuth() call at the TOP of the App() function body

Replace all removed state/functions with this single line:
```js
const {
  isAppInitializing, setIsAppInitializing,
  session, setSession,
  user, realUser, impersonatedUser, impersonationUsers,
  profileError,
  fetchUserProfile,
  handleImpersonate,
  handleLogout,
} = useAuth();
```

Also add: `const user = impersonatedUser || realUser;` — WAIT, this is now computed
inside the context. Remove any remaining `const user = impersonatedUser || realUser;`
line from App.jsx since `user` is now provided directly by `useAuth()`.

### 4g. Update initAppData useEffect in App.jsx

The `initAppData` function inside App.jsx calls `fetchUserProfile` and `setIsAppInitializing`.
These are now obtained from `useAuth()`. The logic stays in App.jsx — only the source
of the functions changes. Confirm the useEffect still reads:

```js
useEffect(() => {
  const initAppData = async () => {
    try {
      const [vResult, sessionData] = await Promise.all([
        verticalService.getVerticals().catch(err => {
          console.warn('Falling back to static verticals.', err);
          return { list: null, map: null };
        }),
        authService.getSession()  // NOTE: authService is still needed here
      ]);
      if (vResult.list && vResult.list.length > 0) {
        setVerticals(vResult.map);
        setVerticalList(vResult.list);
        updateStaticVerticals(vResult.list);
      }
      setSession(sessionData);
      if (sessionData) {
        await fetchUserProfile(sessionData.user.id);
        fetchTasks();
      }
    } catch (err) {
      console.error('App Initialization Error:', err);
    } finally {
      setIsAppInitializing(false);
    }
  };
  initAppData();
}, [fetchTasks]);
```

**IMPORTANT**: `authService` is still needed in App.jsx for `authService.getSession()`.
Keep this import: `import { authService } from './services/auth/authService';`

---

## Step 5 — Verification

### 5a. Check for duplicate state declarations
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useState\(null\)" | Measure-Object -Line
# Count should be LESS than before (auth states removed)
```

### 5b. Confirm useAuth is called
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useAuth"
# Must return exactly 1 result (the import) + 1 result (the call)
```

### 5c. Build
```powershell
npm run build:staging
```

### 5d. Functional smoke tests
1. **Login flow**: Navigate to app, enter credentials → should log in successfully
2. **Profile loads**: User name/role appears in the header
3. **Logout**: Click logout → returns to Login screen
4. **Impersonation** (master_admin only): Dropdown appears, selecting a user changes the view
5. **Profile error**: Temporarily break a network request — error screen should render

---

## Common Pitfalls

### Pitfall 1: Double profile fetch on login
**Symptom**: After logging in, a brief profile error flicker occurs.
**Cause**: The `hasBootstrapped.current` ref was not preserved correctly.
**Fix**: Ensure the auth state listener useEffect in AuthContext uses `useRef(false)` and
the guard `if (!hasBootstrapped.current) { hasBootstrapped.current = true; return; }`.

### Pitfall 2: Tasks never load on first boot
**Symptom**: Blank task board, no tasks appear, no network request for tasks.
**Cause**: `fetchTasks()` in `initAppData` was accidentally removed.
**Fix**: Ensure `fetchTasks()` is still called inside `initAppData` after profile loads.

### Pitfall 3: `user` is undefined
**Symptom**: Blank screen / crash on `user.roleId` reference.
**Cause**: `const user = impersonatedUser || realUser` was removed from App.jsx but
`useAuth()` was not returning `user` from the context.
**Fix**: Confirm `AuthContext` value object includes `user` (not just `realUser`).

---

## Rollback

```powershell
git diff src/main.jsx src/App.jsx
git checkout src/main.jsx src/App.jsx
# Then delete: src/app/contexts/AuthContext.jsx
```

## Commit Checkpoint

After the build succeeds AND login/logout smoke tests pass:
```powershell
git add -A
git commit -m "refactor: RB-02 extract AuthContext"
```
