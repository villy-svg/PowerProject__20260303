# RB2-01: Foundation — Shell Infrastructure

## Objective
Create the foundational shell components that will orchestrate adaptive layout rendering.
This runbook produces **4 new files** and **0 modifications** to existing code.

---

## Pre-Flight Checks

```powershell
# 1. Confirm clean working tree
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"
git status

# 2. Confirm build passes
npm run build

# 3. Confirm the target directory does NOT exist yet
if (Test-Path "src\app\shells") { Write-Host "ABORT: shells/ already exists" } else { Write-Host "OK: Ready to proceed" }
```

---

## Step 1: Create the shells directory

```powershell
New-Item -ItemType Directory -Path "src\app\shells" -Force
```

---

## Step 2: Create `useLayoutShell.js`

**File**: `src/app/shells/useLayoutShell.js`

This hook is the single source of truth for determining which shell to render.
It imports `useIsMobile` and adds layout-specific context (is this a management view? a task board?).

```jsx
/**
 * useLayoutShell.js
 * 
 * Central hook that determines which layout shell (Desktop vs Mobile)
 * should be rendered. Also classifies the current view type for
 * Phase 3 management shell compatibility.
 * 
 * PHASE 3 FORWARD COMPAT:
 * - isManagementView will be used to swap in DesktopManagementShell / MobileManagementShell
 * - isDashboard separates the executive summary view from vertical workspaces
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §2 Breakpoint Standards
 * - development-best-practices §2 Isolated hooks
 */

import { useIsMobile } from '../../hooks/useIsMobile';
import { useAppNavigation } from '../contexts/AppNavigationContext';

/** 
 * Management views are admin pages that show tables/forms, not task boards.
 * This list MUST stay in sync with App.jsx's ternary chain.
 */
const MANAGEMENT_VIEWS = [
  'configuration',
  'role_management',
  'user_management',
  'hub_management',
  'hub_function_management',
  'department_management',
  'employee_role_management',
  'client_category_management',
  'client_service_management',
  'client_billing_model_management',
];

export function useLayoutShell() {
  const { isPhone, isTablet, isMobile, isDesktop, viewportWidth } = useIsMobile();
  const { activeVertical } = useAppNavigation();

  // View classification
  const isDashboard = activeVertical === null;
  const isManagementView = MANAGEMENT_VIEWS.includes(activeVertical);
  const isTaskBoard = !isDashboard && !isManagementView;

  return {
    // Breakpoint flags (pass-through from useIsMobile)
    isPhone,
    isTablet,
    isMobile,
    isDesktop,
    viewportWidth,

    // View classification
    isDashboard,
    isManagementView,
    isTaskBoard,

    // Shell selection (the main decision)
    shellType: isDesktop ? 'desktop' : 'mobile',
  };
}
```

**Create this file verbatim.** Do NOT modify `useIsMobile.js`.

---

## Step 3: Create `LayoutShell.jsx`

**File**: `src/app/shells/LayoutShell.jsx`

The orchestrator component. It reads `useLayoutShell()` and renders either
`DesktopLayout` or `MobileLayout`, passing children through.

```jsx
/**
 * LayoutShell.jsx
 * 
 * Orchestrator that conditionally renders the Desktop or Mobile shell.
 * This component sits between the Context Providers and the actual UI content.
 * 
 * KEY DESIGN DECISIONS:
 * 1. Children are passed through — the LayoutShell never owns content logic.
 * 2. Both shells receive identical data props (user, permissions, verticals, etc.).
 * 3. The shell only controls chrome: sidebar, header, navigation, and layout CSS.
 * 
 * PHASE 3 HOOK: The `managementShell` prop slot is reserved for Phase 3.
 *   When Phase 3 is implemented, LayoutShell will check isManagementView
 *   and wrap content in DesktopManagementShell / MobileManagementShell.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §3A Component Swapping
 * - development-best-practices §4 Component Architecture
 */

import React from 'react';
import { useLayoutShell } from './useLayoutShell';
import DesktopLayout from './DesktopLayout';
import MobileLayout from './MobileLayout';

const LayoutShell = ({
  // Data props (passed through to content and shells)
  user,
  permissions,
  verticals,
  verticalList,

  // Navigation handlers
  onLogout,
  realUser,
  impersonatedUser,
  impersonationUsers,
  onImpersonate,

  // Content (React children — the actual page being viewed)
  children,

  // PHASE 3 SLOT — not used yet, but the interface is ready
  managementShell: ManagementShellOverride,
}) => {
  const layout = useLayoutShell();

  // Common props shared by both shells
  const shellProps = {
    user,
    permissions,
    verticals,
    verticalList,
    onLogout,
    realUser,
    impersonatedUser,
    impersonationUsers,
    onImpersonate,
    layout, // Pass the full layout context down
  };

  if (layout.shellType === 'desktop') {
    return (
      <DesktopLayout {...shellProps}>
        {children}
      </DesktopLayout>
    );
  }

  return (
    <MobileLayout {...shellProps}>
      {children}
    </MobileLayout>
  );
};

export default LayoutShell;
```

---

## Step 4: Create `DesktopLayout.jsx` (Skeleton)

**File**: `src/app/shells/DesktopLayout.jsx`

In this runbook, we create only the **skeleton**. The full wiring happens in RB2-02 through RB2-05.

```jsx
/**
 * DesktopLayout.jsx
 * 
 * Desktop-optimized shell. Renders:
 * - Sidebar (inline panel, left)
 * - Top header bar with impersonation controls
 * - Main content area (children)
 * 
 * This shell is ONLY rendered on viewports > 768px.
 * The Sidebar and Header are inline — no overlays, no backdrops, no blur.
 * 
 * PHASE 3 HOOK:
 * - Accepts a `managementShell` prop that wraps children in a management-specific
 *   layout (full-width tables, admin-oriented chrome) when isManagementView is true.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §5 Desktop Layout
 * - adaptive-ui-strategy §4 Desktop Interactions
 */

import React from 'react';
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
  // SKELETON — Full wiring happens in RB2-02 through RB2-05.
  // For now, this is a pass-through wrapper that renders children.
  return (
    <div className="desktop-layout" data-shell="desktop">
      {/* 
        RB2-02 will add: <DesktopHeader />
        RB2-03 will add: <Sidebar /> (inline)
        RB2-05 will wire the full content routing 
      */}
      <div className="desktop-content-area">
        {children}
      </div>
    </div>
  );
};

export default DesktopLayout;
```

---

## Step 5: Create `MobileLayout.jsx` (Skeleton)

**File**: `src/app/shells/MobileLayout.jsx`

```jsx
/**
 * MobileLayout.jsx
 * 
 * Mobile-optimized shell. Renders:
 * - Sticky header with scroll-aware show/hide
 * - Mobile Action Tray (bottom pill bar)
 * - Bottom Nav (for primary vertical switching)
 * - Content area (children)
 * 
 * This shell is ONLY rendered on viewports ≤ 768px.
 * Overlays, backdrops, and blur effects are exclusive to this shell.
 * 
 * PHASE 3 HOOK:
 * - Accepts a `managementShell` prop that wraps children in a mobile management
 *   layout (card stacks, bottom sheets) when isManagementView is true.
 * 
 * Skill compliance:
 * - adaptive-ui-strategy §5 Mobile Layout
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 */

import React from 'react';
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
  // SKELETON — Full wiring happens in RB2-02 through RB2-05.
  return (
    <div className="mobile-layout" data-shell="mobile">
      {/* 
        RB2-02 will add: <MobileHeader />
        RB2-03 will add: <BottomNav /> (fixed bottom)
        RB2-05 will wire the full content routing 
      */}
      <div className="mobile-content-area">
        {children}
      </div>
    </div>
  );
};

export default MobileLayout;
```

---

## Step 6: Create Placeholder CSS Files

### `src/app/shells/DesktopLayout.css`

```css
/* ==========================================================================
   DESKTOP LAYOUT SHELL — Phase 2 Adaptive UI
   Only loaded when shellType === 'desktop' (> 768px viewport).
   
   RULE: No @media (max-width: 768px) blocks allowed in this file.
   Mobile-specific styles belong EXCLUSIVELY in MobileLayout.css.
   ========================================================================== */

.desktop-layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.desktop-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0; /* Flexbox safety — prevents content blowout */
}
```

### `src/app/shells/MobileLayout.css`

```css
/* ==========================================================================
   MOBILE LAYOUT SHELL — Phase 2 Adaptive UI
   Only loaded when shellType === 'mobile' (≤ 768px viewport).
   
   RULE: No min-width desktop styles in this file.
   Desktop-specific styles belong EXCLUSIVELY in DesktopLayout.css.
   ========================================================================== */

.mobile-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.mobile-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
```

---

## Step 7: Create Barrel Export

**File**: `src/app/shells/index.js`

```js
/**
 * Shell system barrel export.
 * All shell components and hooks are imported from this file.
 */
export { default as LayoutShell } from './LayoutShell';
export { default as DesktopLayout } from './DesktopLayout';
export { default as MobileLayout } from './MobileLayout';
export { useLayoutShell } from './useLayoutShell';
```

---

## Verification Checklist

```powershell
# 1. Verify all files exist
$files = @(
  "src\app\shells\useLayoutShell.js",
  "src\app\shells\LayoutShell.jsx",
  "src\app\shells\DesktopLayout.jsx",
  "src\app\shells\DesktopLayout.css",
  "src\app\shells\MobileLayout.jsx",
  "src\app\shells\MobileLayout.css",
  "src\app\shells\index.js"
)
foreach ($f in $files) {
  if (Test-Path $f) { Write-Host "OK: $f" } else { Write-Host "MISSING: $f" }
}

# 2. Build check — must pass with zero errors
npm run build

# 3. Verify no existing files were modified
git diff --name-only
# Expected: Only new files in src/app/shells/
```

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-01: Shell infrastructure — LayoutShell, DesktopLayout, MobileLayout skeletons"
```

---

## What This Runbook Does NOT Do

- Does NOT modify `App.jsx` — that happens in RB2-05.
- Does NOT modify `VerticalWorkspace.jsx` — that happens in RB2-04.
- Does NOT modify `MasterPageHeader.jsx` — that happens in RB2-02.
- Does NOT modify `Sidebar.jsx` or `BottomNav.jsx` — that happens in RB2-03.
- The shells are currently **inert skeletons** — they just pass children through.

---

## Files Created

| File | Lines | Purpose |
|---|---|---|
| `src/app/shells/useLayoutShell.js` | ~65 | Central layout decision hook |
| `src/app/shells/LayoutShell.jsx` | ~75 | Desktop/Mobile orchestrator |
| `src/app/shells/DesktopLayout.jsx` | ~50 | Desktop shell skeleton |
| `src/app/shells/DesktopLayout.css` | ~20 | Desktop shell base styles |
| `src/app/shells/MobileLayout.jsx` | ~50 | Mobile shell skeleton |
| `src/app/shells/MobileLayout.css` | ~20 | Mobile shell base styles |
| `src/app/shells/index.js` | ~10 | Barrel export |
