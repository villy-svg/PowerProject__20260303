# RB2-02: Header Shells — Desktop & Mobile Header Separation

## Objective
Split the current `MasterPageHeader.jsx` into two shell-aware header components:
- `DesktopHeader.jsx` — Inline row with menu button, view toggles, and action buttons. No sticky behavior, no tray.
- `MobileHeader.jsx` — Sticky scroll-aware header with mobile action tray (bottom pill bar).

A shared `useHeaderState.js` hook owns the common state (menu open, tray visibility, etc.).

**Critical rule**: `MasterPageHeader.jsx` is NOT deleted. It is refactored to be a thin wrapper
that delegates to `DesktopHeader` or `MobileHeader` based on the layout shell. Existing consumers
continue to import `MasterPageHeader` — the API does not change.

---

## Pre-Flight Checks

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"
# 1. Confirm RB2-01 commit exists
git log --oneline -1
# Expected: "RB2-01: Shell infrastructure..."

# 2. Build passes
npm run build

# 3. Confirm MasterPageHeader.jsx exists and is unmodified from baseline
git diff src/components/MasterPageHeader.jsx
# Expected: No changes (clean)
```

---

## Step 1: Create `useHeaderState.js`

**File**: `src/app/shells/useHeaderState.js`

This hook extracts the shared state that both desktop and mobile headers need.
It does NOT contain any viewport logic — that's in `useLayoutShell`.

```jsx
/**
 * useHeaderState.js
 *
 * Shared state for both Desktop and Mobile header implementations.
 * Owns: menu open/close, tray visibility sync, mutual exclusivity logic.
 *
 * IMPORTANT: This hook does NOT determine which header to render.
 * That decision lives in useLayoutShell / LayoutShell.
 *
 * Skill compliance:
 * - development-best-practices §2 State Management
 * - master-header-system §1 Component Structure
 */

import { useState, useEffect, useCallback } from 'react';
import { useScrollDirection } from '../../hooks/useScrollDirection';

export function useHeaderState({
  isSubSidebarOpen = false,
  onSidebarToggle,
  isTaskModalOpen = false,
  isSidebarOpen = false,
  controlledIsMenuOpen,
  controlledSetIsMenuOpen,
} = {}) {
  const isScrollVisible = useScrollDirection(10, 100);

  // ─── Menu State (controlled or internal) ────────────────────────────
  const [internalIsMenuOpen, setInternalIsMenuOpen] = useState(() => {
    const saved = localStorage.getItem('master-header-menu-open');
    return saved === 'true';
  });

  const isMenuOpen = controlledIsMenuOpen !== undefined 
    ? controlledIsMenuOpen 
    : internalIsMenuOpen;
  const setIsMenuOpen = controlledSetIsMenuOpen !== undefined 
    ? controlledSetIsMenuOpen 
    : setInternalIsMenuOpen;

  // ─── Persist menu state ─────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('master-header-menu-open', isMenuOpen);
  }, [isMenuOpen]);

  // ─── Mutual Exclusivity: Task Modal closes overlays ─────────────────
  useEffect(() => {
    if (isTaskModalOpen) {
      setIsMenuOpen(false);
      if (isSubSidebarOpen && onSidebarToggle) onSidebarToggle(false);
    }
  }, [isTaskModalOpen, isSubSidebarOpen, onSidebarToggle, setIsMenuOpen]);

  // ─── Tray Visibility Callback ───────────────────────────────────────
  const [isTrayVisible, setIsTrayVisible] = useState(true);
  
  const handleTrayVisibilityChange = useCallback((visible) => {
    setIsTrayVisible(visible);
  }, []);

  // Sync scroll visibility to tray
  useEffect(() => {
    setIsTrayVisible(isScrollVisible);
  }, [isScrollVisible]);

  return {
    isMenuOpen,
    setIsMenuOpen,
    isScrollVisible,
    isTrayVisible,
    handleTrayVisibilityChange,
  };
}
```

---

## Step 2: Create `DesktopHeader.jsx`

**File**: `src/app/shells/DesktopHeader.jsx`

The desktop header is a simple inline row. No sticky behavior.
No scroll-aware hide/show. No mobile action tray.

```jsx
/**
 * DesktopHeader.jsx
 *
 * Desktop-only header component. Renders as an inline row within the
 * desktop shell. Features:
 * - Title + description
 * - MENU toggle button (when expandedLeft/expandedRight are provided)
 * - Left actions (view toggles, filters)
 * - Right actions (Add Task, CRUD buttons)
 * - Expanded menu row (view mode, import/export, etc.)
 *
 * DOES NOT INCLUDE:
 * - Scroll-aware sticky behavior (desktop has enough screen estate)
 * - Mobile action tray (BottomNav handles this on mobile)
 * - Body scroll lock (no overlays on desktop)
 * - Backdrop blur (desktop menu is inline, not an overlay)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Desktop Interactions
 * - adaptive-ui-strategy §5 Desktop Layout
 * - master-header-system §1-5
 */

import React from 'react';
import {
  IconChevronRight,
  IconChevronDown,
} from '../../components/Icons';
import MasterHeaderMenu from '../../components/MasterHeaderMenu';

const DesktopHeader = ({
  title,
  description,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isMenuOpen,
  setIsMenuOpen,
  hideMenuClose,
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight);

  return (
    <header className="master-page-header desktop-header-shell">
      {/* Row 1: Title */}
      <div className="header-row-1">
        <h1>{title}</h1>
      </div>

      {/* Row 2: Description */}
      {description && (
        <div className="header-row-2">
          <p>{description}</p>
        </div>
      )}

      {/* Row 3: Actions */}
      <div className="header-actions-area">
        <div className="master-header-actions-row">
          <div className="master-header-left">
            {hasExpandedContent && (
              <button
                className={`halo-button menu-trigger-btn ${isMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                <span className="menu-icon">
                  {isMenuOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                </span>
                MENU
              </button>
            )}
            {leftActions}
          </div>
          <div className="master-header-right">
            {rightActions}
          </div>
        </div>

        {/* Row 4: Expanded Menu (inline on desktop — no overlay) */}
        {hasExpandedContent && isMenuOpen && (
          <MasterHeaderMenu
            expandedLeft={expandedLeft}
            expandedRight={expandedRight}
            onClose={() => setIsMenuOpen(false)}
            hideCloseButton={hideMenuClose}
          />
        )}
      </div>
    </header>
  );
};

export default DesktopHeader;
```

---

## Step 3: Create `MobileHeader.jsx`

**File**: `src/app/shells/MobileHeader.jsx`

The mobile header includes sticky behavior, scroll-aware hide/show, 
body scroll lock, and the mobile action tray.

```jsx
/**
 * MobileHeader.jsx
 *
 * Mobile-only header component. Features:
 * - Sticky scroll-aware show/hide (Chrome-style)
 * - Mobile Action Tray (bottom pill bar with Home, Sidebar, Menu, Add)
 * - Body scroll lock when menu is open
 * - Full-screen overlay menu (slides down from top)
 *
 * DOES NOT INCLUDE:
 * - Inline menu row (that's desktop-only)
 * - Description text (hidden on mobile for space)
 *
 * Skill compliance:
 * - adaptive-ui-strategy §4 Mobile Interactions (Touch)
 * - adaptive-ui-strategy §5 Mobile Layout
 * - master-header-system §1-5
 */

import React, { useEffect, useRef } from 'react';
import {
  IconHome,
  IconMenu,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
} from '../../components/Icons';
import MasterHeaderMenu from '../../components/MasterHeaderMenu';

const MobileHeader = ({
  title,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isMenuOpen,
  setIsMenuOpen,
  isScrollVisible,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  isTaskModalOpen,
  onShowBottomNav,
  hideMenuClose,
  isSidebarOpen,
}) => {
  const hasExpandedContent = !!(expandedLeft || expandedRight);

  // ─── Body scroll lock for mobile menu ─────────────────────────────
  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [isMenuOpen]);

  // ─── Compute header visibility ────────────────────────────────────
  const isHeaderHidden = !isScrollVisible && !isMenuOpen && !isSubSidebarOpen && !isSidebarOpen;

  return (
    <>
      <header className={`master-page-header mobile-header-shell ${isMenuOpen ? 'is-sticky' : ''} ${isHeaderHidden ? 'header-hidden' : ''}`}>
        {/* Row 1: Title (compact on mobile) */}
        <div className="header-row-1">
          <h1>{title}</h1>
        </div>

        {/* Row 2: Description — HIDDEN on mobile (adaptive-ui-strategy §6) */}

        {/* Expanded Menu Overlay (slides down from top on mobile) */}
        <div className="header-actions-area">
          {hasExpandedContent && isMenuOpen && (
            <MasterHeaderMenu
              expandedLeft={expandedLeft}
              expandedRight={expandedRight}
              onClose={() => setIsMenuOpen(false)}
              hideCloseButton={hideMenuClose}
            />
          )}
        </div>
      </header>

      {/* MOBILE ACTION TRAY (bottom pill bar) */}
      <div className={`mobile-action-tray ${(isScrollVisible || isMenuOpen || isSubSidebarOpen || isSidebarOpen) ? '' : 'tray-hidden'}`}>
        <div className="mobile-action-tray-container">
          {/* Home / Switch Vertical */}
          <button
            className="halo-button mobile-tray-btn"
            title="Switch Vertical"
            onClick={() => { if (onShowBottomNav) onShowBottomNav(); }}
          >
            <IconHome size={22} />
          </button>

          {/* Sidebar Toggle */}
          {onSidebarToggle && (
            <button
              className={`halo-button mobile-tray-btn ${isSubSidebarOpen ? 'active' : ''}`}
              onClick={() => {
                const nextSidebarState = !isSubSidebarOpen;
                if (nextSidebarState) setIsMenuOpen(false);
                onSidebarToggle(nextSidebarState);
              }}
              title="Toggle Sidebar"
            >
              {isSubSidebarOpen ? <IconChevronLeft size={20} /> : <IconChevronRight size={20} />}
            </button>
          )}

          {/* Menu Toggle */}
          {hasExpandedContent && (
            <button
              className={`halo-button mobile-tray-btn ${isMenuOpen ? 'active' : ''}`}
              onClick={() => {
                const nextMenuState = !isMenuOpen;
                setIsMenuOpen(nextMenuState);
                if (nextMenuState && onSidebarToggle) onSidebarToggle(false);
              }}
              title="Toggle Menu"
            >
              <IconMenu size={20} />
            </button>
          )}

          {/* Add Button */}
          {canAdd && (
            <button
              className={`halo-button mobile-tray-btn mobile-add-btn ${isTaskModalOpen ? 'active' : ''}`}
              onClick={onAddClick}
              title="Add New"
            >
              <IconPlus size={24} />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default MobileHeader;
```

---

## Step 4: Update the Shell Barrel Export

**File**: `src/app/shells/index.js` — ADD new exports (do NOT remove existing ones)

```js
/**
 * Shell system barrel export.
 * All shell components and hooks are imported from this file.
 */
export { default as LayoutShell } from './LayoutShell';
export { default as DesktopLayout } from './DesktopLayout';
export { default as MobileLayout } from './MobileLayout';
export { default as DesktopHeader } from './DesktopHeader';
export { default as MobileHeader } from './MobileHeader';
export { useLayoutShell } from './useLayoutShell';
export { useHeaderState } from './useHeaderState';
```

---

## Step 5: Refactor `MasterPageHeader.jsx` to Delegate

**THIS IS THE ONLY EXISTING FILE MODIFICATION IN THIS RUNBOOK.**

Modify `src/components/MasterPageHeader.jsx` to import and use `useLayoutShell` for
rendering the correct header. The public API (props) stays identical.

### Targeted Changes

1. **Add import** at the top:
```jsx
import { useLayoutShell } from '../app/shells/useLayoutShell';
import DesktopHeader from '../app/shells/DesktopHeader';
import MobileHeader from '../app/shells/MobileHeader';
import { useHeaderState } from '../app/shells/useHeaderState';
```

2. **Replace the component body** with a delegation pattern:

The `MasterPageHeader` component should now:
- Call `useLayoutShell()` to determine shell type
- Call `useHeaderState()` to manage shared state
- Render `DesktopHeader` or `MobileHeader` based on shell type
- Pass all props through to the selected sub-component

```jsx
const MasterPageHeader = ({
  title,
  description,
  leftActions,
  rightActions,
  expandedLeft,
  expandedRight,
  isSubSidebarOpen,
  onSidebarToggle,
  canAdd,
  onAddClick,
  isTaskModalOpen,
  onShowBottomNav,
  onTrayVisibilityChange,
  isMenuOpen: controlledIsMenuOpen,
  setIsMenuOpen: controlledSetIsMenuOpen,
  hideMenuClose,
  isSidebarOpen,
}) => {
  const { shellType } = useLayoutShell();
  
  const headerState = useHeaderState({
    isSubSidebarOpen,
    onSidebarToggle,
    isTaskModalOpen,
    isSidebarOpen,
    controlledIsMenuOpen,
    controlledSetIsMenuOpen,
  });

  // Sync tray visibility upstream (for BulkActionBar, etc.)
  React.useEffect(() => {
    if (onTrayVisibilityChange) onTrayVisibilityChange(headerState.isTrayVisible);
  }, [headerState.isTrayVisible, onTrayVisibilityChange]);

  if (shellType === 'desktop') {
    return (
      <DesktopHeader
        title={title}
        description={description}
        leftActions={leftActions}
        rightActions={rightActions}
        expandedLeft={expandedLeft}
        expandedRight={expandedRight}
        isMenuOpen={headerState.isMenuOpen}
        setIsMenuOpen={headerState.setIsMenuOpen}
        hideMenuClose={hideMenuClose}
      />
    );
  }

  return (
    <MobileHeader
      title={title}
      leftActions={leftActions}
      rightActions={rightActions}
      expandedLeft={expandedLeft}
      expandedRight={expandedRight}
      isMenuOpen={headerState.isMenuOpen}
      setIsMenuOpen={headerState.setIsMenuOpen}
      isScrollVisible={headerState.isScrollVisible}
      isSubSidebarOpen={isSubSidebarOpen}
      onSidebarToggle={onSidebarToggle}
      canAdd={canAdd}
      onAddClick={onAddClick}
      isTaskModalOpen={isTaskModalOpen}
      onShowBottomNav={onShowBottomNav}
      hideMenuClose={hideMenuClose}
      isSidebarOpen={isSidebarOpen}
    />
  );
};
```

### What to KEEP from the original file:
- ALL existing imports except `useScrollDirection` (moved to `useHeaderState`)
- The `import './MasterPageHeader.css'` (CSS continues to work)
- The `export default MasterPageHeader;`

### What to REMOVE from the original file:
- The `useScrollDirection` import (now in `useHeaderState`)
- The `pressTimer` ref (unused)
- The inline `useState` for `internalIsMenuOpen` (moved to `useHeaderState`)
- The inline `useEffect` blocks for menu persistence and body scroll lock (moved to shells)
- The entire JSX return body (replaced by delegation)

### What to ADD:
- Imports for `useLayoutShell`, `DesktopHeader`, `MobileHeader`, `useHeaderState`
- The delegation body shown above

---

## Verification Checklist

```powershell
# 1. Verify all new files exist
$newFiles = @(
  "src\app\shells\useHeaderState.js",
  "src\app\shells\DesktopHeader.jsx",
  "src\app\shells\MobileHeader.jsx"
)
foreach ($f in $newFiles) {
  if (Test-Path $f) { Write-Host "OK: $f" } else { Write-Host "MISSING: $f" }
}

# 2. Build check
npm run build

# 3. Verify only MasterPageHeader.jsx was modified + new files added
git diff --name-only
# Expected: 
#   src/components/MasterPageHeader.jsx (modified)
#   src/app/shells/useHeaderState.js (new)
#   src/app/shells/DesktopHeader.jsx (new)
#   src/app/shells/MobileHeader.jsx (new)
#   src/app/shells/index.js (modified)

# 4. Desktop visual test — open localhost, resize to > 768px
#    - Header should render identically to before
#    - MENU button, view toggles, action buttons should all work

# 5. Mobile visual test — resize to ≤ 768px
#    - Sticky header should appear
#    - Mobile action tray should show at bottom
#    - Menu should slide down from top
```

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-02: Header shells — DesktopHeader, MobileHeader, useHeaderState + MasterPageHeader delegation"
```

---

## Files Created / Modified

| File | Action | Lines | Purpose |
|---|---|---|---|
| `src/app/shells/useHeaderState.js` | NEW | ~85 | Shared header state hook |
| `src/app/shells/DesktopHeader.jsx` | NEW | ~90 | Desktop inline header |
| `src/app/shells/MobileHeader.jsx` | NEW | ~140 | Mobile sticky header + tray |
| `src/app/shells/index.js` | MODIFIED | +3 lines | Updated barrel exports |
| `src/components/MasterPageHeader.jsx` | MODIFIED | ~80 (rewrite) | Delegation wrapper |
