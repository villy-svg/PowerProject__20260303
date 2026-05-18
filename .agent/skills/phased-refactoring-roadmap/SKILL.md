---
name: Phased Refactoring Roadmap
description: Tracks the 3-phase adaptive UI refactoring plan. Phase 1 (guards), Phase 2 (shell architecture), Phase 3 (management shells). Ensures continuity across conversations and provides context for any AI model implementing any phase.
---

# Phased Refactoring Roadmap

## Overview

PowerProject uses a **3-phase adaptive refactoring plan** to separate Desktop and Mobile experiences without duplicating business logic.

**Core Principle**: Shared data + service modules → swapped shells. We never duplicate task logic — we only duplicate the frame around it.

---

## Phase 1 — Guard-Level Fixes ✅ COMPLETE

**Status**: Done
**What was done**: Fixed immediate bugs at the logical guard level using `useIsMobile`. Added JS-level guards to prevent desktop-only behaviors from executing on mobile and vice versa.

### Changes Made:
- `useIsMobile` hook created at `src/hooks/useIsMobile.js`
- `VerticalWorkspace.jsx` — added `isDesktop` guard on backdrop rendering
- `TaskController.jsx` — added `isDesktop` guard on menu backdrop and blur
- These guards are additive and non-breaking

### Artifacts:
- `useIsMobile.js` — reactive viewport detection hook with debounced resize
- Breakpoints: Phone ≤480px, Tablet/Mobile ≤768px, Desktop >768px

---

## Phase 2 — Shell Architecture 🔄 IN PROGRESS

**Status**: Runbooks created, ready for implementation
**Runbooks**: `runbooks_phase2/RB2-01` through `RB2-07`

### Goal:
Introduce `DesktopLayout` / `MobileLayout` shell components that wrap content — swapping the chrome (sidebar, header, navigation) while passing the same task board, form, and data modules into both.

### Key Components:
| Component | Purpose |
|---|---|
| `LayoutShell` | Orchestrator — picks Desktop or Mobile shell |
| `DesktopLayout` | Desktop shell with inline sidebar, header bar |
| `MobileLayout` | Mobile shell with drawer, tray, BottomNav |
| `ContentRouter` | Pure content routing, zero chrome awareness |
| `useLayoutShell` | Central hook for shell type + view classification |
| `useHeaderState` | Shared header state for both shells |

### Execution Order:
1. RB2-01: Shell infrastructure (skeletons)
2. RB2-02: Header shells (DesktopHeader, MobileHeader)
3. RB2-03: Navigation shells (sidebar, BottomNav wrappers)
4. RB2-04: Workspace integration (remove useIsMobile guards)
5. RB2-05: AppShell switchover (LayoutShell integration)
6. RB2-06: CSS architecture split
7. RB2-07: Smoke test & verification

### Phase 3 Hooks Built In:
- `LayoutShell` accepts `managementShell` prop
- `useLayoutShell` returns `isManagementView`
- `WorkspaceFilterContext` created for full sidebar extraction
- `ContentRouter` cleanly separates management from task views

---

## Phase 3 — Management Shells 📋 PLANNED

**Status**: Not started (future)
**Prerequisites**: Phase 2 fully complete and verified

### Goal:
Introduce dedicated `DesktopManagementShell` and `MobileManagementShell` wrappers so management views get:
- **Desktop**: Full-width tables, admin-oriented chrome, no task sidebar
- **Mobile**: Card stacks instead of tables, bottom sheets for forms

### Planned Components:
| Component | Purpose |
|---|---|
| `DesktopManagementShell` | Wraps management pages on desktop with full-width tables |
| `MobileManagementShell` | Wraps management pages on mobile with card stacks |
| `WorkspaceFilterContext` | Full integration — sub-sidebar uses context instead of props |
| Management page refactors | Extract table/card presentation from data logic |

### Key Changes:
1. `LayoutShell` checks `isManagementView` and wraps content in the appropriate management shell
2. Management pages (HubManagement, EmployeeManagement, etc.) split into:
   - Data component (hooks, CRUD, state)
   - Desktop presentation (table, full-width)
   - Mobile presentation (cards, stacked)
3. `WorkspaceFilterContext` replaces prop-drilling for filter state
4. Sub-sidebar fully extracted from VerticalWorkspace into shell layouts

### Design Constraints:
- Management data logic is NEVER duplicated
- Only the presentation layer is swapped
- The same hooks (`useManagementUI`, service layers) power both presentations
- CSS is in `DesktopManagementShell.css` and `MobileManagementShell.css`

---

## Architecture Evolution

### Before Phase 1:
```
App.jsx (monolithic)
  ├── Sidebar, Header, BottomNav (all in one render)
  ├── CSS media queries handle everything
  └── No distinction between desktop/mobile behavior
```

### After Phase 1:
```
App.jsx (monolithic + guards)
  ├── useIsMobile guards on backdrop/blur
  ├── CSS media queries + JS guards
  └── Better but still interleaved
```

### After Phase 2:
```
App.jsx → LayoutShell → Desktop/Mobile Layout
  ├── Desktop: inline sidebar, header bar, no overlays
  ├── Mobile: drawer sidebar, sticky header, tray, BottomNav
  ├── ContentRouter: pure content routing
  └── CSS split into shell-scoped files
```

### After Phase 3:
```
LayoutShell → Shell Selection → Content/Management Routing
  ├── Desktop + Task: inline sidebar, header, task board
  ├── Desktop + Management: full-width table, admin chrome
  ├── Mobile + Task: drawer, tray, task board
  ├── Mobile + Management: card stacks, bottom sheets
  └── Data components completely decoupled from presentation
```

---

## References

- **Adaptive UI Strategy skill**: `.agent/skills/adaptive-ui-strategy/SKILL.md`
- **Shell Architecture skill**: `.agent/skills/shell-architecture-system/SKILL.md`
- **Phase 2 runbooks**: `runbooks_phase2/`
- **Phase 1 hook**: `src/hooks/useIsMobile.js`
- **Shell system**: `src/app/shells/`
