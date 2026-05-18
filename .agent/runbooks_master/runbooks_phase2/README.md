# Phase 2 — Adaptive Shell Architecture Runbooks

## Mission Statement
Introduce `DesktopLayout` / `MobileLayout` shell components that wrap `VerticalWorkspace` and `MasterPageHeader` — swapping the **chrome** (sidebar, header, navigation) while passing the **same task board, form, and data modules** into both.

**Core Principle**: Shared data + service modules → swapped shells. We never duplicate task logic — we only duplicate the frame around it.

---

## Runbook Inventory

| ID | Runbook | Description | Dependencies | Est. Lines Changed |
|---|---|---|---|---|
| **RB2-01** | [Foundation: Shell Infrastructure](./RB2-01_shell_infrastructure.md) | Create `DesktopLayout.jsx`, `MobileLayout.jsx`, `LayoutShell.jsx` orchestrator, and the `useLayoutShell` hook. | None | ~350 new |
| **RB2-02** | [Header Shells](./RB2-02_header_shells.md) | Split `MasterPageHeader.jsx` into `DesktopHeader.jsx` (inline row) and `MobileHeader.jsx` (sticky + tray). Shared `useHeaderState` hook. | RB2-01 | ~300 new, ~50 modified |
| **RB2-03** | [Navigation Shells](./RB2-03_navigation_shells.md) | Refactor `Sidebar.jsx` → desktop inline, and `BottomNav.jsx` → mobile-only, with shell-aware mounting. | RB2-01 | ~200 new, ~100 modified |
| **RB2-04** | [Workspace Shell Integration](./RB2-04_workspace_shell_integration.md) | Refactor `VerticalWorkspace.jsx` to become a pure content container, letting shells handle chrome. | RB2-01, RB2-02, RB2-03 | ~150 modified |
| **RB2-05** | [AppShell Switchover](./RB2-05_appshell_switchover.md) | Rewire `App.jsx`'s `AppShell` to use the new `LayoutShell` orchestrator. Kill all inline `useIsMobile` guards in favor of shell-level separation. | RB2-01–04 | ~100 modified |
| **RB2-06** | [CSS Architecture Split](./RB2-06_css_architecture.md) | Create `DesktopLayout.css`, `MobileLayout.css`. Migrate all `@media` blocks from existing files into shell-scoped CSS. | RB2-01–05 | ~400 CSS new/moved |
| **RB2-07** | [Smoke Test & Verification](./RB2-07_verification.md) | Build verification, responsive testing protocol, visual regression checklist. | RB2-01–06 | 0 (testing only) |

---

## Execution Rules

1. **Sequential execution only**. Each runbook must be completed and verified before starting the next.
2. **Git checkpoint** after every runbook: `git add -A && git commit -m "RB2-0X: <title>"`.
3. **Build check** after every runbook: `npm run build` must succeed with zero errors.
4. **Zero desktop regression**: At no point should the desktop layout change visually or functionally.
5. **Zero logic duplication**: Data hooks, service layers, task CRUD, and filter logic are NEVER duplicated. Only layout chrome is swapped.

---

## Architecture Diagram

```
main.jsx
  └── AuthProvider
       └── App
            ├── AppNavigationProvider
            │    └── TaskBoardProvider
            │         └── LayoutShell (NEW — orchestrates shell selection)
            │              ├── [Desktop] → DesktopLayout
            │              │    ├── Sidebar (inline panel)
            │              │    ├── DesktopHeader (inline row)
            │              │    └── <content> (VerticalWorkspace / Management / Dashboard)
            │              │
            │              └── [Mobile] → MobileLayout
            │                   ├── MobileHeader (sticky + tray)
            │                   ├── <content> (VerticalWorkspace / Management / Dashboard)
            │                   └── BottomNav (fixed bottom)
```

---

## Phase 3 Forward Compatibility

Every design decision in Phase 2 is made with Phase 3 in mind:

- `DesktopLayout` accepts a `managementShell` prop (default: null). Phase 3 will introduce `DesktopManagementShell` as a wrapper.
- `MobileLayout` accepts a `managementShell` prop. Phase 3 will introduce `MobileManagementShell` (card stacks).
- The `LayoutShell` orchestrator checks `isManagementView` — Phase 3 adds the management-specific wrapper.
- Management pages (`HubManagement`, `EmployeeManagement`, etc.) will be refactored into pure data components that receive their chrome from the shell.

---

## File Locations (Planned)

```
src/
  app/
    shells/                     ← NEW directory (Phase 2 core)
      DesktopLayout.jsx
      DesktopLayout.css
      MobileLayout.jsx
      MobileLayout.css
      LayoutShell.jsx
      DesktopHeader.jsx
      MobileHeader.jsx
      useLayoutShell.js
      useHeaderState.js
```
