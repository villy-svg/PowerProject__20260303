# RB2-04: Workspace Shell Integration — VerticalWorkspace as Pure Content Container

## Objective
Refactor `VerticalWorkspace.jsx` to become a **pure content container** that no longer manages
its own chrome (sidebar, backdrop, blur). The layout shells (DesktopLayout/MobileLayout) now
own the sidebar toggle and backdrop rendering.

**What changes**:
- Remove the sub-sidebar `<aside>` rendering from VerticalWorkspace
- Remove the backdrop `<div>` from VerticalWorkspace
- Remove the `useIsMobile` import (no longer needed — shells handle this)
- VerticalWorkspace becomes a clean `<div className="workspace-content">` wrapper

**What does NOT change**:
- Filter logic, RBAC guards, TaskController rendering — all stay intact
- The `SidebarComponent` is still resolved by verticalRegistry and rendered, but the
  sub-sidebar chrome is moved to the layout shell level
- All props remain compatible — no API breaking changes for consumers

---

## Pre-Flight Checks

```powershell
cd "c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject"

# 1. Confirm RB2-03 commit exists
git log --oneline -3

# 2. Build passes
npm run build

# 3. Snapshot the current VerticalWorkspace for rollback
Copy-Item "src\components\VerticalWorkspace.jsx" "src\components\VerticalWorkspace.jsx.bak"
```

---

## Step 1: Understand the Current VerticalWorkspace Architecture

The current `VerticalWorkspace.jsx` (285 lines) handles:

1. **RBAC authorization guards** (lines 137–171) → KEEP as-is
2. **Filter state management** (lines 46–130) → KEEP as-is
3. **Sub-sidebar rendering** (lines 174–219) → MOVE to shells
4. **Backdrop rendering** (lines 222–229) → MOVE to shells
5. **Content rendering** (lines 231–280) → KEEP as-is (this is the pure content)

---

## Step 2: Create `WorkspaceSubSidebar.jsx`

Extract the sub-sidebar into a standalone component that shells can mount independently.

**File**: `src/app/shells/WorkspaceSubSidebar.jsx`

```jsx
/**
 * WorkspaceSubSidebar.jsx
 *
 * The sub-sidebar that appears inside a vertical workspace.
 * Contains the vertical-specific sidebar component (HubSubSidebar, etc.)
 * and the toggle button + header.
 *
 * This component is mounted by the layout shells at the appropriate
 * position — inline on desktop, fixed overlay on mobile.
 *
 * IMPORTANT: This component does NOT handle its own backdrop or blur.
 * Those are shell responsibilities (MobileLayout handles backdrop,
 * DesktopLayout has no backdrop).
 *
 * Skill compliance:
 * - adaptive-ui-strategy §5 Navigation
 * - safe-code-modification §1A (extracted, not deleted)
 */

import React from 'react';
import { IconChevronLeft, IconChevronRight } from '../../components/Icons';

const WorkspaceSubSidebar = ({
  label,
  isOpen,
  onToggle,
  onHeaderClick,
  isTrayVisible,
  SidebarComponent,
  user,
  permissions,
  activeVertical,
  setActiveVertical,
  onFilterChange,
  onReset,
  onBatchFilter,
  filters,
  tasks,
}) => {
  return (
    <aside className={`sub-sidebar ${!isOpen ? 'collapsed' : ''} ${isTrayVisible ? 'tray-visible' : ''}`}>
      <div className="sub-sidebar-header">
        <button
          className="sub-sidebar-toggle"
          onClick={() => onToggle(!isOpen)}
          title={isOpen ? "Collapse Menu" : "Expand Menu"}
        >
          {isOpen ? <IconChevronLeft size={16} /> : <IconChevronRight size={16} />}
        </button>

        <h3
          className={onHeaderClick ? 'navigable-header' : ''}
          onClick={onHeaderClick}
          title={onHeaderClick ? "Click to open Management View" : ""}
        >
          {label}
        </h3>
      </div>

      {/* Render the vertical-specific SidebarComponent or generic placeholder */}
      {SidebarComponent ? (
        <SidebarComponent
          user={user}
          permissions={permissions}
          activeVertical={activeVertical}
          setActiveVertical={setActiveVertical}
          onFilterChange={onFilterChange}
          onReset={onReset}
          onBatchFilter={onBatchFilter}
          filters={filters}
          tasks={tasks}
        />
      ) : (
        <div className="sub-sidebar-body">
          <div className="sub-nav-item">
            <div className="sub-nav-text">
              <p>{label} Workspace</p>
              <small>Session Role: {user?.roleId || 'User'}</small>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default WorkspaceSubSidebar;
```

---

## Step 3: Refactor `VerticalWorkspace.jsx`

The refactored VerticalWorkspace removes chrome rendering and becomes a pure content container.

### Changes Summary:
1. **REMOVE**: `useIsMobile` import and usage
2. **REMOVE**: The `<aside className="sub-sidebar">` block (lines 175–220)
3. **REMOVE**: The backdrop `<div>` (lines 224–229)
4. **REMOVE**: `isTrayVisible` state and handler (moved to shells)
5. **KEEP**: All filter logic, RBAC guards, and content rendering
6. **ADD**: Export filter state/handlers so shells can pass them to WorkspaceSubSidebar

### Detailed Changes to `src/components/VerticalWorkspace.jsx`:

#### 3A. Remove imports that are no longer needed:

```diff
-import { useIsMobile } from '../hooks/useIsMobile';
```

#### 3B. Remove from the component body:

```diff
-  // Viewport detection: sidebar-backdrop is only needed on mobile/tablet (≤ 1024px)
-  // where the sub-sidebar becomes a fixed overlay. On desktop it is an inline panel.
-  const { isDesktop } = useIsMobile();
```

```diff
-  const [isTrayVisible, setIsTrayVisible] = React.useState(true);
-
-  // Sync state upward from MasterPageHeader (via TaskController)
-  const handleTrayVisibilityChange = (visible) => {
-    setIsTrayVisible(visible);
-  };
```

#### 3C. Simplify the return JSX:

The workspace container no longer renders the sub-sidebar or backdrop.
It only renders the content area.

Replace the entire return block (from `return (` to the closing `);`) with:

```jsx
  return (
    <div className={`workspace-container ${!isSubSidebarOpen ? 'sub-sidebar-collapsed' : ''}`}>
      {/* Sub-sidebar rendering moved to layout shells (RB2-04) */}
      
      <main className="workspace-content">
        {React.Children.toArray(children).some(child => !!child) ? (
          React.Children.map(children, child =>
            React.isValidElement(child)
              ? React.cloneElement(child, {
                  filters,
                  onFilterChange: handleFilterChange,
                  setActiveVertical,
                  onShowBottomNav,
                  isSubSidebarOpen,
                  setIsSubSidebarOpen,
                  isMainSidebarOpen,
                  // Removed: onTrayVisibilityChange — shells handle this now
                })
              : child
          )
        ) : (
          <TaskController
            activeVertical={activeVertical}
            rootVerticalId={rootVerticalId}
            tasks={tasks}
            filters={filters}
            setTasks={setTasks}
            actualSetTasks={actualSetTasks}
            refreshTasks={refreshTasks}
            updateTask={updateTask}
            addTask={addTask}
            bulkUpdateTasks={bulkUpdateTasks}
            deleteTask={deleteTask}
            updateTaskStage={updateTaskStage}
            handleFilterChange={handleFilterChange}
            resetFilters={resetFilters}
            label={label}
            TaskFormComponent={TaskFormComponent}
            TaskTileComponent={TaskTileComponent}
            user={user}
            permissions={permissions}
            verticals={verticals}
            boardLabel={boardLabel}
            isSubSidebarOpen={isSubSidebarOpen}
            setIsSubSidebarOpen={setIsSubSidebarOpen}
            isMainSidebarOpen={isMainSidebarOpen}
            onShowBottomNav={onShowBottomNav}
            // Removed: onTrayVisibilityChange — shells handle this now
          />
        )}
      </main>
    </div>
  );
```

#### 3D. Expose filter state for shell consumption

Add these as part of the VerticalWorkspace's "interface" by either:
- Passing them via context (recommended for Phase 3), OR
- Keeping the current prop-drilling pattern (simpler for Phase 2)

For Phase 2, the simpler approach is to keep the current pattern where VerticalWorkspace
receives `SidebarComponent` and the shells wire the `WorkspaceSubSidebar` with filter props.

**The key insight**: VerticalWorkspace still owns filter state internally, but the sub-sidebar
that uses those filters is now rendered by the shell outside of VerticalWorkspace.
To bridge this, we need to lift the filter state.

### OPTION A (Recommended): Lift filter state into a context

Create `src/app/contexts/WorkspaceFilterContext.jsx`:

```jsx
/**
 * WorkspaceFilterContext.jsx
 *
 * Provides filter state for the active vertical workspace.
 * Used by both the WorkspaceSubSidebar (in the shell) and
 * the TaskController (in the content area).
 *
 * This context eliminates prop-drilling between the sidebar
 * and the content area, which are now in different DOM subtrees
 * due to the shell architecture.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { taskUtils } from '../../utils/taskUtils';

const WorkspaceFilterContext = createContext(null);

export function WorkspaceFilterProvider({ tasks = [], user = {}, children }) {
  const [filters, setFilters] = useState({
    city: [],
    hub: [],
    priority: [],
    role: [],
    function: [],
    assignee: [],
    duplicatesOnly: false,
  });
  const [isInitialized, setIsInitialized] = useState(false);

  // Auto-populate filters on first load (Select All by default).
  // ADDITIVE MERGE on subsequent updates.
  useEffect(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const newCities     = [...new Set(tasks.map(t => t.city).filter(Boolean))];
    const newHubs       = [...new Set(tasks.map(t => t.hub_id).filter(Boolean))];
    const newPriorities = [...new Set(tasks.map(t => t.priority).filter(Boolean))];
    const newFunctions  = [...new Set(tasks.map(t => t.function).filter(Boolean))];
    const newAssignees  = [...new Set(tasks.map(t =>
      taskUtils.formatAssigneeForList(t.assigned_to, t.assigneeName, user)
    ).filter(Boolean))];

    if (!isInitialized) {
      setFilters(prev => ({
        ...prev,
        city:     newCities,
        hub:      newHubs,
        priority: newPriorities,
        function: newFunctions,
        assignee: newAssignees,
      }));
      setIsInitialized(true);
    } else {
      setFilters(prev => ({
        ...prev,
        city:     [...new Set([...(prev.city     || []), ...newCities])],
        hub:      [...new Set([...(prev.hub      || []), ...newHubs])],
        priority: [...new Set([...(prev.priority || []), ...newPriorities])],
        function: [...new Set([...(prev.function || []), ...newFunctions])],
        assignee: [...new Set([...(prev.assignee || []), ...newAssignees])],
      }));
    }
  }, [tasks, user, isInitialized]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const current = prev[key];
      if (typeof current === 'boolean') {
        return { ...prev, [key]: !current };
      }
      const updated = (current || []).includes(value)
        ? current.filter(v => v !== value)
        : [...(current || []), value];
      return { ...prev, [key]: updated };
    });
  };

  const resetFilters = (newFilters) => {
    if (newFilters) {
      setFilters(newFilters);
    } else {
      setIsInitialized(false);
    }
  };

  const batchFilter = (key, values) => {
    setFilters(prev => ({ ...prev, [key]: values }));
  };

  const value = {
    filters,
    handleFilterChange,
    resetFilters,
    batchFilter,
  };

  return (
    <WorkspaceFilterContext.Provider value={value}>
      {children}
    </WorkspaceFilterContext.Provider>
  );
}

export function useWorkspaceFilters() {
  const ctx = useContext(WorkspaceFilterContext);
  if (!ctx) {
    throw new Error('[useWorkspaceFilters] Must be used inside <WorkspaceFilterProvider>.');
  }
  return ctx;
}
```

---

## Step 4: Update VerticalWorkspace to Use Filter Context

Once `WorkspaceFilterContext` exists, VerticalWorkspace can:
1. Remove all internal filter state (`filters`, `handleFilterChange`, `resetFilters`)
2. Import `useWorkspaceFilters()` instead
3. The WorkspaceSubSidebar (in the shell) also imports `useWorkspaceFilters()`

**However**, for Phase 2, we take a **conservative approach**:
- VerticalWorkspace keeps its filter state internally
- BUT also renders `WorkspaceSubSidebar` inline (same as before)
- The key change is removing `useIsMobile` and the backdrop/blur logic

This is because fully extracting the sub-sidebar out of VerticalWorkspace requires
the shell layout to "reach inside" the workspace to access filter state — which
introduces coupling. The `WorkspaceFilterContext` solves this cleanly but is more
invasive.

### Conservative Phase 2 Approach:

1. Keep `VerticalWorkspace.jsx` largely intact
2. Remove ONLY the `useIsMobile` guard on the backdrop
3. Let the shell CSS handle desktop vs mobile presentation
4. Phase 3 will introduce `WorkspaceFilterContext` for full separation

### Minimal Changes to VerticalWorkspace.jsx:

```diff
 // At the top — REMOVE:
-import { useIsMobile } from '../hooks/useIsMobile';

 // In the component body — REMOVE:
-  const { isDesktop } = useIsMobile();

 // In the JSX — Replace the backdrop conditional:
-      {!isDesktop && isSubSidebarOpen && (
+      {isSubSidebarOpen && (
         <div
           className="sidebar-backdrop"
           onClick={() => setIsSubSidebarOpen(false)}
         />
       )}
```

The CSS for `.sidebar-backdrop` already has `@media (max-width: 1024px)` — so on desktop
the backdrop is already hidden via CSS. Removing the JS guard just means the DOM element
exists but is invisible on desktop (display: none via CSS).

Similarly, in TaskController.jsx:

```diff
-  const { isDesktop } = useIsMobile();

 // Replace the backdrop conditional:
-      {!isDesktop && isHeaderMenuOpen && (
+      {isHeaderMenuOpen && (

 // Replace the blur conditional:
-      <div className={`workspace-main-view ${(!isDesktop && (isHeaderMenuOpen || isSubSidebarOpen)) ? 'is-blurred' : ''}`}>
+      <div className={`workspace-main-view ${(isHeaderMenuOpen || isSubSidebarOpen) ? 'is-blurred' : ''}`}>
```

The CSS already gates these effects to `@media (max-width: 1024px)`, so removing the JS
guard is safe. The CSS media query is the single source of truth.

---

## Step 5: Create WorkspaceFilterContext (Forward-Compatible)

Even though we don't fully use it in Phase 2, creating the context now establishes
the interface for Phase 3. Create `src/app/contexts/WorkspaceFilterContext.jsx` with
the code from Step 3 above.

---

## Verification Checklist

```powershell
# 1. Build check
npm run build

# 2. Verify modifications are minimal
git diff --stat
# Expected:
#   src/components/VerticalWorkspace.jsx — small diff (removed useIsMobile)
#   src/components/TaskController.jsx — small diff (removed useIsMobile)
#   src/app/shells/WorkspaceSubSidebar.jsx — new
#   src/app/contexts/WorkspaceFilterContext.jsx — new

# 3. Desktop test:
#   - Open localhost at > 768px width
#   - Sub-sidebar should render inline (no backdrop visible)
#   - Toggle sub-sidebar — no blur on content
#   - All filters should work as before

# 4. Mobile test:
#   - Resize to ≤ 768px
#   - Sub-sidebar should slide in with backdrop
#   - Blur should appear on content when sidebar is open
#   - All filters should work as before
```

---

## Git Checkpoint

```powershell
git add -A
git commit -m "RB2-04: Workspace shell integration — removed useIsMobile guards, CSS-only gating, WorkspaceFilterContext stub"
```

---

## Files Created / Modified

| File | Action | Lines | Purpose |
|---|---|---|---|
| `src/app/shells/WorkspaceSubSidebar.jsx` | NEW | ~95 | Extracted sub-sidebar component |
| `src/app/contexts/WorkspaceFilterContext.jsx` | NEW | ~110 | Filter state context (Phase 3 ready) |
| `src/components/VerticalWorkspace.jsx` | MODIFIED | -5 lines | Removed useIsMobile guard |
| `src/components/TaskController.jsx` | MODIFIED | -5 lines | Removed useIsMobile guard |

---

## Phase 3 Path

In Phase 3, the full separation will be:
1. Wrap VerticalWorkspace with `<WorkspaceFilterProvider>` in LayoutShell
2. Move WorkspaceSubSidebar into the shell layouts (different position on desktop vs mobile)
3. Both WorkspaceSubSidebar and TaskController consume `useWorkspaceFilters()` from context
4. VerticalWorkspace becomes a truly pure content container with zero chrome
