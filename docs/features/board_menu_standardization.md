# Board Menu Control Standardization & Modularization — PRD & TRD

**Status:** `Implemented`
**Date Created:** 2026-11-18
**Last Updated:** 2026-11-18
**Author / AI Session:** Antigravity session, Nov 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-11-18 | Approved → Implemented | Audited CSS/JSX collisions across board menus, built modular `BoardViewToggle`, `BoardFilterPill`, and `DataOperationsDropdown` components, and standardized menu control tokens. |

---

## 0. Context & Objectives

### 0a. Core Objective
In the Hubs Task Board (`TaskController`) and across management boards, the expandable `MENU` row (`MasterHeaderMenu`) rendered view toggles (`Kanban / List / Tree / By Hub`), filter pills (`Defer / My Tasks / Rework`), and the `Data Operations` dropdown trigger at inconsistent heights (`31px`, `34px`, `41px`, `48px`), conflicting font sizes (`0.75rem` vs `0.8rem`), conflicting font weights (`400`, `600`, `800`), and mixed text casings (`Capitalize` vs `UPPERCASE`). We need a modular component layer that provides a single unified geometry and typography baseline across all boards while allowing board-specific customizations (such as the Hubs Task Board's `| By Hub` grouping toggle and Master Admin repair/archive actions) without global CSS leakage.

### 0b. Success Metrics
- **Metric 1 (Visual & Geometric Parity):** Every control group inside `.expanded-menu-row` on desktop renders at an exact `36px` outer height (`--menu-control-height: 36px`), matching the Row 3 header bar standard, with uniform `0.75rem` (`12px`), `700` weight, `UPPERCASE` typography.
- **Metric 2 (Zero Specificity Wars / Global Leakage):** Un-scoped overrides in `TaskController.css` (`.view-toggle-btn`, `.toggle-depri-btn` hardcoded neon colors) and `.filters-row-toggle` (`var(--bg-elevated)` undefined token, `48px` height override) are eliminated so opening `TaskController` never mutates styles on other boards.
- **Metric 3 (Strict Modularity & Accessibility):** Shared primitives (`BoardViewToggle`, `BoardFilterPill`, `DataOperationsDropdown`) use semantic `<button type="button">` elements with `aria-pressed` / `aria-expanded` attributes and zero inline `style={{}}` props.

### 0c. Out of Scope
- ❌ Modifying database tables, RLS policies, or Supabase Edge Functions.
- ❌ Changing task filtering business logic or Kanban/List/Tree data pipelines.
- ❌ Altering `MasterPageHeader.jsx` prop contracts (keeping 100% backward compatibility with `employee_attendance_board_optimization.md`).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component | `TaskController` | `src/components/tasks/TaskController.jsx` |
| Stylesheet | `TaskController.css` | `src/components/tasks/TaskController.css` |
| Stylesheet | `MasterPageHeader.css` | `src/components/layout/MasterPageHeader.css` |
| Stylesheet | `globalTheme.css` | `src/styles/globalTheme.css` |
| Stylesheet | `VerticalWorkspace.css` | `src/components/workspaces/VerticalWorkspace.css` |
| Stylesheet | `MobileLayout.css` | `src/app/shells/MobileLayout.css` |
| Component | `HubManagement` | `src/verticals/ChargingHubs/HubManagement.jsx` |
| Component | `HubFunctionManagement` | `src/verticals/ChargingHubs/HubFunctionManagement.jsx` |
| Component | `DailyTasksManagement` | `src/verticals/ChargingHubs/DailyTasksManagement.jsx` |

**Conflict Check (`docs/features/README.md`):**
- `Employee Attendance Board Optimization` (`Draft`) lists `MasterPageHeader.jsx`. This feature does **not** modify `MasterPageHeader.jsx` or `EmployeeAttendanceBoard.jsx`, and preserves all legacy CSS class selectors (`.view-mode-toggle`, `.view-toggle-btn`, `.toggle-depri-btn`, `.actions-dropdown-container`, `.filters-row-toggle`, `.actions-dropdown-menu`), ensuring zero conflict.

### 1b. Product Dependencies (Current User Flow)
1. User navigates to **Charging Hubs → Hubs Task Board** (or any vertical management board).
2. User clicks the **MENU** button in Row 3 (or taps **Filters** / **Add** in the mobile bottom tray).
3. The `.expanded-menu-row` opens, displaying:
   - Left: View mode switcher (`Kanban`, `List`, `Tree`, and `| By Hub` on Hub boards) + quick filter pills (`Defer`, `My Tasks`, `Rework`).
   - Right: `Data Operations` dropdown trigger and menu items (`Clear Board`, `Export Tasks`, `Download Template`, `Import Tasks`, `Fix Tasks`, `Archive Old Tasks`).

### 1c. Logical Dependencies (Current Business Rules)
- View mode toggles are hidden on mobile viewports for `TaskController` because mobile locks to Kanban stage navigation.
- The `By Hub` grouping toggle is only rendered when `viewMode !== 'tree'` and the active vertical is a Charging Hubs board.
- `Defer` toggle is hidden on the Remarks Manager board (`isRemarksBoard`).
- `Clear Board`, `Fix Tasks`, and `Archive Old Tasks` inside `Data Operations` are restricted to `master_admin`.

### 1d. Data & State Dependencies
- Purely presentational UI state (`viewMode`, `groupByHubs`, `showDeprioritized`, `showMyTasksOnly`, `showReworkOnly`, `isActionsDropdownOpen`).
- No Supabase tables or schema changes involved.

### 1e. Security & Access (RBAC)
- Preserves existing RBAC guards (`permissions.roleId === 'master_admin'` for `Clear Board`, `FixTasksButton`, `ArchiveTasksButton`; `permissions.canCreate` for CSV imports).

---

## 2. Proposed Options & Strategy

### 2a. Technical Options

**Option A — Two-Layer Modular Menu Primitives + Tokenized CSS (Recommended & Approved)**
- Approach:
  1. Define `--menu-control-height: 36px` (`42px` on mobile), `--menu-control-font-size: 0.75rem`, `--menu-control-font-weight: 700`, and `--menu-control-radius: var(--radius-button)` in `globalTheme.css`.
  2. Create `src/components/ui/board-menu/` containing `BoardViewToggle.jsx`, `BoardFilterPill.jsx`, `DataOperationsDropdown.jsx`, and `BoardMenu.css`.
  3. Preserve existing class names alongside new BEM classes so any non-migrated board or mobile bottom-sheet override (`.expanded-actions-list`) continues working seamlessly.
  4. Remove leaking overrides from `TaskController.css`, `VerticalWorkspace.css`, and `MasterPageHeader.css`.
- Pros: Enforces strict modularity (`development-best-practices` §4), eliminates inline styles (`development-best-practices` §5), supports board-specific customizations via props/scoped modifiers, and guarantees zero regressions across all boards.
- Cons: Requires creating a small component module under `src/components/ui/board-menu/`.
- Complexity: Low–Medium

**Option B — CSS-Only Patch in `TaskController.css`**
- Approach: Override heights and fonts inside `TaskController.css` using higher-specificity selectors.
- Pros: Fewer files touched.
- Cons: Perpetuates CSS specificity wars and leaves duplicated JSX across 10+ boards.

### 2b. Product Options (UI/UX)
- **Desktop (`DesktopLayout`):** All controls in the expanded menu row align along a crisp `36px` horizontal axis with uniform `0.75rem` (`12px`), `700` weight, `UPPERCASE` labels and `0.5px` tracking.
- **Mobile (`MobileLayout`):** Controls scale to `42px–44px` touch targets inside the mobile filter drawer, while `DataOperationsDropdown` automatically flattens into an inline action list inside the mobile Quick Actions sub-tray.

### 2c. Trade-offs (Cost vs. Benefit)

| Dimension | Option A (Modular Primitives + Tokens) | Option B (CSS-Only Patch) |
|---|---|---|
| Modularity | ✅ Reusable across all 10+ boards | ❌ Duplicated JSX remains |
| CSS Specificity | ✅ Single flat source of truth | ⚠️ Adds more specificity overrides |
| Board Customizations | ✅ Clean `addon` / `variant` / `boardScope` props | ⚠️ Fragile class chaining |
| Reversibility | ✅ High (pure frontend) | ✅ High |

### 2d. Rollout & Backward Compatibility
- **Feature Flag:** Not required (visual standardization & bugfix).
- **Database Migration:** None.
- **Mobile App (Capacitor):** 100% backward-compatible; mobile bottom-sheet flattening rules (`.expanded-actions-list`) are preserved.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Mobile Quick Actions tray (`MobileHeader.jsx`) renders `expandedRight` inside `.expanded-actions-list` | If `DataOperationsDropdown` unmounts `.actions-dropdown-menu` when closed, Quick Actions tray wouldn't show the items | Always render `.actions-dropdown-menu` in the DOM and control desktop dropdown visibility via `.is-open` CSS class, allowing `.expanded-actions-list .actions-dropdown-menu` to flatten and display items automatically on mobile |
| Other boards using legacy `.view-mode-toggle` or `.filters-row-toggle` markup | Could look inconsistent if only new classes are styled | Style both the canonical BEM classes and legacy classes (`.view-mode-toggle`, `.view-toggle-btn`, `.toggle-depri-btn`, `.filters-row-toggle`) from the same tokenized ruleset |

### 3b. Testing Plan

```
[x] TEST 1 — Desktop Hubs Task Board Menu Parity
    Persona: Master Admin / Editor on Desktop (1440px & 1280px)
    Action: Open Hubs Task Board → Click MENU
    Expected: View toggle group (Kanban | List | Tree | By Hub), Filter pills (Defer, My Tasks, Rework), and Data Operations trigger all share an exact 36px height, 0.75rem font size, 700 weight, and uppercase styling.

[x] TEST 2 — Board-Specific Customizations
    Persona: Master Admin on Desktop
    Action: Switch from Kanban to Tree view on Hubs Task Board; switch to Remarks Manager; open Data Operations
    Expected: "By Hub" toggle disappears in Tree view; "Defer" pill hides on Remarks Manager; "Clear Board" renders with semantic danger styling inside Data Operations.

[x] TEST 3 — Mobile Filters Drawer & Quick Actions Sub-Tray
    Persona: Mobile user (390px / 360px viewport)
    Action: Tap "Filters" in bottom tray, then tap "Add (+)" to open Quick Actions
    Expected: Filter pills render in a single even row with touch-friendly height; Quick Actions flattens Data Operations items cleanly.
```

### 3c. Rollback & Reversibility
- **Reversible without data loss?** ✅ Yes (frontend-only changes; revert commit).

---

## Implementation Notes

- Created `src/components/ui/board-menu/BoardViewToggle.jsx`, `BoardFilterPill.jsx`, `DataOperationsDropdown.jsx`, `BoardMenu.css`, and `index.js`.
- Added `--menu-control-*` design tokens in `src/styles/globalTheme.css` and imported `BoardMenu.css` as the single canonical source of truth.
- Removed 325+ lines of duplicated/conflicting CSS rules across `globalTheme.css`, `MasterPageHeader.css`, `TaskController.css`, and `TaskKanbanView.css`.
- Migrated all 11 board/management views (`TaskController.jsx`, `HubManagement.jsx`, `HubFunctionManagement.jsx`, `DailyTasksManagement.jsx`, `ClientManagement.jsx`, `ClientBillingModelManagement.jsx`, `ClientCategoryManagement.jsx`, `ClientServiceManagement.jsx`, `EmployeeManagement.jsx`, `DepartmentManagement.jsx`, and `EmployeeRoleManagement.jsx`) to the shared modular components, eliminating inline `style={{}}` props on menu toggles and dropdown chevrons.
