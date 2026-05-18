# RB2-03: Navigation Shells — Sidebar & BottomNav Shell-Awareness

## Objective
Make `Sidebar.jsx` and `BottomNav.jsx` shell-aware so that:
- **Desktop**: Sidebar is an inline flex panel (always in the DOM flow). BottomNav is unmounted.
- **Mobile**: Sidebar is a fixed off-canvas drawer. BottomNav is a fixed bottom bar.

This runbook does NOT change any visual styling. It only ensures the correct mounting/unmounting
based on the active shell, and removes redundant viewport checks that are now handled at the shell level.

---

## Pre-Flight Checks

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"

# 1. Confirm RB2-02 commit exists
git log --oneline -2
# Expected: RB2-02 and RB2-01 commits

# 2. Build passes
npm run build

# 3. Confirm no pending changes
git status
```

---

## Step 1: Create `DesktopSidebar.jsx` Wrapper

**File**: `src/app/shells/DesktopSidebar.jsx`

This is a thin wrapper around the existing `Sidebar.jsx` that enforces desktop-specific behavior:
- Always renders as an inline flex panel
- No backdrop overlay
- Width transitions via CSS (already handled in Sidebar.css for desktop)

```jsx
/**
 * DesktopSidebar.jsx
 *
 * Desktop shell wrapper for the Sidebar component.
 * Ensures the sidebar renders as an inline flex panel on desktop.
 *
 * KEY DIFFERENCE FROM MOBILE:
 * - No fixed positioning
 * - No backdrop overlay
 * - No safe-area insets
 * - Collapsible via width animation, not translateX
 *
 * PHASE 3 NOTE: Management pages may want to hide the sidebar entirely
 * to give full-width to tables. The managementShell prop controls this.
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Desktop Layout (fixed or collapsible left navigation)
 */

import React from 'react';
import Sidebar from '../../components/Sidebar';

const DesktopSidebar = ({
  isOpen,
  onClose,
  activeVertical,
  setActiveVertical,
  user,
  permissions,
  verticalList,
}) => {
  // On desktop, the sidebar is always in the DOM flow.
  // The `isOpen` state controls its width (280px vs 0px via CSS).
  return (
    <Sidebar
      isOpen={isOpen}
      onClose={onClose}
      activeVertical={activeVertical}
      setActiveVertical={setActiveVertical}
      user={user}
      permissions={permissions}
      verticalList={verticalList}
    />
  );
};

export default DesktopSidebar;
```

---

## Step 2: Create `MobileSidebar.jsx` Wrapper

**File**: `src/app/shells/MobileSidebar.jsx`

This wrapper adds the mobile-specific overlay and backdrop behavior.

```jsx
/**
 * MobileSidebar.jsx
 *
 * Mobile shell wrapper for the Sidebar component.
 * Renders the sidebar as a fixed off-canvas drawer with a backdrop overlay.
 *
 * KEY DIFFERENCES FROM DESKTOP:
 * - Fixed positioning (translateX slide-in/out)
 * - Dark backdrop overlay (blocks interaction with content behind)
 * - Safe-area aware (iOS notch)
 * - Touch-optimized close (tap backdrop to dismiss)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout (top-down menu trigger)
 */

import React from 'react';
import Sidebar from '../../components/Sidebar';

const MobileSidebar = ({
  isOpen,
  onClose,
  activeVertical,
  setActiveVertical,
  user,
  permissions,
  verticalList,
}) => {
  return (
    <>
      <Sidebar
        isOpen={isOpen}
        onClose={onClose}
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        user={user}
        permissions={permissions}
        verticalList={verticalList}
      />
      {/* Backdrop overlay — mobile only. Tapping dismisses the drawer. */}
      {isOpen && (
        <div
          className="sidebar-overlay active"
          onClick={onClose}
        />
      )}
    </>
  );
};

export default MobileSidebar;
```

---

## Step 3: Create `MobileBottomNav.jsx` Wrapper

**File**: `src/app/shells/MobileBottomNav.jsx`

Thin wrapper that ensures BottomNav only mounts in the mobile shell.
No code changes to BottomNav itself — it already handles its own scroll-aware visibility.

```jsx
/**
 * MobileBottomNav.jsx
 *
 * Mobile shell wrapper for BottomNav.
 * This component only exists in the mobile shell — on desktop, BottomNav is never rendered.
 *
 * The BottomNav itself handles:
 * - Scroll-aware show/hide
 * - Overlay mode for vertical switching
 * - Active vertical highlighting
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout (persistent bottom nav)
 */

import React from 'react';
import BottomNav from '../../components/BottomNav';

const MobileBottomNav = ({
  activeVertical,
  setActiveVertical,
  onMenuClick,
  verticals,
  showOverlay,
  onCloseOverlay,
}) => {
  return (
    <BottomNav
      activeVertical={activeVertical}
      setActiveVertical={setActiveVertical}
      onMenuClick={onMenuClick}
      verticals={verticals}
      showOverlay={showOverlay}
      onCloseOverlay={onCloseOverlay}
    />
  );
};

export default MobileBottomNav;
```

---

## Step 4: Wire Navigation into Desktop/Mobile Layout Shells

### 4A: Update `DesktopLayout.jsx`

Open `src/app/shells/DesktopLayout.jsx` and replace the skeleton content:

```jsx
/**
 * DesktopLayout.jsx
 *
 * Desktop-optimized shell. Renders:
 * - Logo button (toggles sidebar)
 * - Sidebar (inline panel, left)
 * - Brand title
 * - Top header bar with impersonation controls
 * - Main content area (children)
 *
 * NO backdrop overlays, NO bottom nav, NO blur effects.
 * Those are mobile-exclusive behaviors.
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Desktop Layout
 */

import React from 'react';
import DesktopSidebar from './DesktopSidebar';
import UserProfile from '../../components/UserProfile';
import CustomSelect from '../../components/CustomSelect';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import powerLogo from '../../assets/logo.svg';
import './DesktopLayout.css';

const DesktopLayout = ({
  user,
  permissions,
  verticals,
  verticalList,
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
  layout,
  children,
}) => {
  const { darkMode } = useTheme();
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen, setIsSidebarOpen,
  } = useAppNavigation();

  return (
    <div className="desktop-layout" data-shell="desktop" data-theme={darkMode ? 'dark' : 'light'}>
      {/* Logo Button */}
      <button
        className="logo-button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <img src={powerLogo} alt="Logo" className="logo-svg" />
      </button>

      {/* Sidebar — inline panel on desktop */}
      <DesktopSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        user={user}
        permissions={permissions}
        verticalList={verticalList}
      />

      {/* Brand Title */}
      <h1 className="brand-title-centered">PowerProject</h1>

      {/* Main Content Area */}
      <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
        {/* Desktop Header Bar */}
        <header className="app-header">
          <div className="header-left"></div>
          <div className="header-center"></div>
          <div className="header-right">
            {realUser?.roleId === 'master_admin' && (
              <div className="impersonation-header-wrapper">
                {impersonatedUser ? (
                  <div className="impersonation-active-container">
                    <span className="impersonation-active-label">
                      View: <strong>{impersonatedUser.name}</strong>
                      <span className="neutral-badge impersonation-role-badge">
                        {impersonatedUser.roleId}
                      </span>
                    </span>
                    <button className="halo-button impersonation-stop-btn" onClick={() => onImpersonate(null)}>
                      Stop
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="impersonation-select"
                    placeholder="Simulate User..."
                    options={impersonationUsers.map(u => ({
                      value: u.id,
                      label: `${u.name} (${u.role_id})`
                    }))}
                    onChange={(val) => onImpersonate(val)}
                  />
                )}
              </div>
            )}
            <UserProfile user={user} onConfigClick={() => setActiveVertical('configuration')} onLogout={onLogout} />
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DesktopLayout;
```

### 4B: Update `MobileLayout.jsx`

Open `src/app/shells/MobileLayout.jsx` and replace the skeleton:

```jsx
/**
 * MobileLayout.jsx
 *
 * Mobile-optimized shell. Renders:
 * - Sidebar (off-canvas drawer with backdrop)
 * - Content area (children)
 * - BottomNav (fixed bottom bar)
 *
 * Logo and brand title are hidden on mobile when in a vertical.
 * The mobile header is handled by MasterPageHeader's delegation (RB2-02).
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout
 */

import React from 'react';
import MobileSidebar from './MobileSidebar';
import MobileBottomNav from './MobileBottomNav';
import { useAppNavigation } from '../contexts/AppNavigationContext';
import { useTheme } from '../../theme/useTheme';
import powerLogo from '../../assets/logo.svg';
import './MobileLayout.css';

const MobileLayout = ({
  user,
  permissions,
  verticals,
  verticalList,
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,
  layout,
  children,
}) => {
  const { darkMode } = useTheme();
  const {
    activeVertical, setActiveVertical,
    isSidebarOpen, setIsSidebarOpen,
    showBottomNavOverlay, setShowBottomNavOverlay,
  } = useAppNavigation();

  return (
    <div className="mobile-layout" data-shell="mobile" data-theme={darkMode ? 'dark' : 'light'}>
      {/* Logo — hidden when in a vertical */}
      <button
        className={`logo-button ${activeVertical ? 'mobile-hidden' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <img src={powerLogo} alt="Logo" className="logo-svg" />
      </button>

      {/* Brand Title — hidden when in a vertical */}
      <h1 className={`brand-title-centered ${activeVertical ? 'mobile-hidden' : ''}`}>PowerProject</h1>

      {/* Sidebar Drawer */}
      <MobileSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        user={user}
        permissions={permissions}
        verticalList={verticalList}
      />

      {/* Main Content Area */}
      <div className={`app-main-area ${activeVertical ? 'no-padding' : ''}`} data-view-state={activeVertical ? 'vertical' : 'home'}>
        {/* Mobile header bar — only shown on dashboard (no vertical active) */}
        <header className={`app-header ${activeVertical ? 'mobile-hidden' : ''}`}>
          <div className="header-left"></div>
          <div className="header-center"></div>
          <div className="header-right">
            {/* Impersonation controls are desktop-only — too complex for mobile header */}
          </div>
        </header>

        {/* Content */}
        <main className="app-content">
          {children}
        </main>
      </div>

      {/* Bottom Nav — mobile only */}
      <MobileBottomNav
        activeVertical={activeVertical}
        setActiveVertical={setActiveVertical}
        onMenuClick={() => setIsSidebarOpen(true)}
        verticals={verticals}
        showOverlay={showBottomNavOverlay}
        onCloseOverlay={() => setShowBottomNavOverlay(false)}
      />
    </div>
  );
};

export default MobileLayout;
```

---

## Step 5: Update Shell Barrel Export

**File**: `src/app/shells/index.js` — add new exports:

```js
/**
 * Shell system barrel export.
 */
export { default as LayoutShell } from './LayoutShell';
export { default as DesktopLayout } from './DesktopLayout';
export { default as MobileLayout } from './MobileLayout';
export { default as DesktopHeader } from './DesktopHeader';
export { default as MobileHeader } from './MobileHeader';
export { default as DesktopSidebar } from './DesktopSidebar';
export { default as MobileSidebar } from './MobileSidebar';
export { default as MobileBottomNav } from './MobileBottomNav';
export { useLayoutShell } from './useLayoutShell';
export { useHeaderState } from './useHeaderState';
```

---

## Step 6: Verify No Existing Components Were Broken

This runbook creates 3 new wrapper files and updates 2 layout shells.
The original `Sidebar.jsx` and `BottomNav.jsx` are **untouched**.

```powershell
# Verify original files are unmodified
git diff src/components/Sidebar.jsx
git diff src/components/BottomNav.jsx
# Both should show NO changes

# Build check
npm run build
```

---

## Verification Checklist

```powershell
# 1. All new files exist
$newFiles = @(
  "src\app\shells\DesktopSidebar.jsx",
  "src\app\shells\MobileSidebar.jsx",
  "src\app\shells\MobileBottomNav.jsx"
)
foreach ($f in $newFiles) {
  if (Test-Path $f) { Write-Host "OK: $f" } else { Write-Host "MISSING: $f" }
}

# 2. Build passes
npm run build

# 3. Verify modifications are limited to shell files
git diff --name-only
# Expected:
#   src/app/shells/DesktopLayout.jsx (modified from skeleton)
#   src/app/shells/MobileLayout.jsx (modified from skeleton)
#   src/app/shells/index.js (modified — new exports)
#   src/app/shells/DesktopSidebar.jsx (new)
#   src/app/shells/MobileSidebar.jsx (new)
#   src/app/shells/MobileBottomNav.jsx (new)
```

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-03: Navigation shells — DesktopSidebar, MobileSidebar, MobileBottomNav + shell wiring"
```

---

## Files Created / Modified

| File | Action | Lines | Purpose |
|---|---|---|---|
| `src/app/shells/DesktopSidebar.jsx` | NEW | ~50 | Desktop sidebar wrapper |
| `src/app/shells/MobileSidebar.jsx` | NEW | ~55 | Mobile sidebar + backdrop wrapper |
| `src/app/shells/MobileBottomNav.jsx` | NEW | ~40 | Mobile bottom nav wrapper |
| `src/app/shells/DesktopLayout.jsx` | MODIFIED | ~120 | Full desktop shell with sidebar/header |
| `src/app/shells/MobileLayout.jsx` | MODIFIED | ~100 | Full mobile shell with drawer/bottomnav |
| `src/app/shells/index.js` | MODIFIED | +3 lines | Updated barrel exports |
