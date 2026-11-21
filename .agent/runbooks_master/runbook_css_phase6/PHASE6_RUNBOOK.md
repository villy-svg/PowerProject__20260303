# Phase 6 Runbook — Shell Media-Query Cleanup & `!important` Reduction

> **Goal**: Eliminate legacy duplicated `@media` blocks from shell-migrated files and strip unnecessary `!important` declarations across **active (unlocked) CSS** without any visual regressions on Desktop (`1440px`, `1280px`), Tablet (`1024px`, `768px`), or Mobile (`390px`, `360px`).
>
> **Strict Scope Rule**: Per `.agent/rules/locked-verticals-and-features.md`, **DO NOT** touch locked verticals or features (`Clients`, `DataManager`, `LeaveManagement`, `DailyTasksManagement`).
>
> **Skills to Read First**:
> - `.agent/skills/safe-code-modification/SKILL.md`
> - `.agent/skills/shell-architecture-system/SKILL.md`
> - `.agent/skills/ui-design-system/SKILL.md`
> - `.agent/rules/production-safeguards.md` (get explicit approval before editing prod-critical shell CSS)

---

## Baseline (Active CSS — Start of Phase 6)

| File | `!important` Count | Root Cause |
| :--- | :---: | :--- |
| `src/app/shells/MobileLayout.css` | **100** | Fighting legacy `@media (max-width: 1024px)` / `@media (max-width: 768px)` blocks left in `MasterPageHeader.css` and `VerticalWorkspace.css` |
| `src/components/dashboard/ExecutiveSummary.css` | **71** | Overriding shared card/list/mobile rules via `!important` instead of scoping under `.home-summary-view` |
| `src/styles/ManagementForms.css` | **29** | Legacy overrides against unscoped `.form-group` / `.halo-button` (note: `Login.css` & `SandboxManagerModal.css` `.form-group` were already scoped in Phase 5!) |
| `src/components/tasks/CentralisedTaskBoard.css` | **28** | Overriding Kanban/List primitives via `!important` instead of `.centralised-board ...` |
| `src/components/modals/SandboxManagerModal.css` | **20** | Modal overrides against `ManagementForms.css` |
| `src/styles/DropdownSystem.css` | **14** | iOS 16px zoom guards & soft-keyboard height caps (keep genuine iOS/keyboard guards!) |
| `src/verticals/Employees/attendance/AttendanceSelfService.css` | **14** | Mobile overrides |
| `src/components/modals/SubmissionModal.css` | **10** | Modal layout overrides |
| `src/verticals/Employees/EmployeeAttendanceBoard.css` | **26** | **SKIP**: Third-party `react-datepicker` overrides (required to beat library inline/bundled CSS) |

---

## Sub-Phase 6A — Mobile Shell & Legacy `@media` De-duplication (Highest Impact)

**Files**:
- `src/components/layout/MasterPageHeader.css` (has `/* MIGRATED TO SHELL CSS */` banner; lines ~182–362 contain `@media (max-width: 1024px)`)
- `src/components/workspaces/VerticalWorkspace.css` (has `/* MIGRATED TO SHELL CSS */` banner)
- `src/app/shells/MobileLayout.css` (100 `!important`s)

**Execution Steps**:
1. **Audit tablet boundary (`769px–1024px`) FIRST**:
   - Confirm what `useLayoutShell.js` / `useIsMobile.js` returns between `769px` and `1024px` (`desktop` vs `mobile`).
   - Do **NOT** delete any rule in `MasterPageHeader.css`'s `@media (max-width: 1024px)` that is still needed for `769px–1024px` if `DesktopLayout` renders there — move any still-needed tablet rules to `DesktopLayout.css` or scope legacy mobile-only rules to `.mobile-layout` in `MobileLayout.css`.
2. **Remove duplicated mobile-only rules** from `MasterPageHeader.css` and `VerticalWorkspace.css` that are already canonically owned by `MobileLayout.css`.
3. **Strip redundant `!important`s in `MobileLayout.css`**:
   - Because `.mobile-layout ...` already has higher specificity `(0,2,0)` or `(0,3,0)` than base `.master-header-*` / `.sub-sidebar` rules `(0,1,0)`, remove `!important` wherever `.mobile-layout` naturally wins the cascade.
   - **Keep** `!important` ONLY on:
     - Soft-keyboard viewport height caps (`body[data-keyboard="open"]`) if overriding JS/inline heights.
     - iOS `font-size: 16px` auto-zoom guards if needed.
4. **Build & Verify**: Run `npm run build`.

**Visual Audit Checklist (6A)**:
- [ ] **Desktop (`1440px` & `1280px`)**: Zero visual diff on Task Board, Attendance Board, Employees List, Hubs List, User Management.
- [ ] **Tablet (`1024px` & `800px`)**: Sub-sidebar does not float over content; header Row 3 (`MENU`, actions) and Row 4 expanded menu render cleanly.
- [ ] **Mobile (`390px` & `360px`)**: Sticky mobile header, bottom action tray (`64px` + safe area), board switcher sub-tray, Quick Actions sheet, and off-canvas sub-sidebar drawer open/close with zero overlap or clipping.

---

## Sub-Phase 6B — Executive Summary (`ExecutiveSummary.css`: 71 `!important`s)

**Files**:
- `src/components/dashboard/ExecutiveSummary.css`
- `src/components/dashboard/ExecutiveMetricsSection.css` (8 `!important`s)

**Execution Steps**:
1. Scope overridden rules under `.home-summary-view` (or `.desktop-layout .home-summary-view` / `.mobile-layout .home-summary-view`) to win specificity naturally instead of using `!important`.
2. Check mobile (`≤768px`) switcher tray & padding (`padding-top: 0px`) so the top switcher stays tight to the header.
3. Run `npm run build`.

**Visual Audit Checklist (6B)**:
- [ ] **Home / Dashboard (Desktop `1440px` & `1280px`)**: Metric cards, stage pills, escalation summary, and scroll behavior match pre-change pixel-for-pixel.
- [ ] **Home / Dashboard (Mobile `390px` & `360px`)**: Top switcher tray sits flush under header, cards stack cleanly without horizontal overflow, bottom padding clears bottom nav tray.

---

## Sub-Phase 6C — Forms, Task Board & Modals (`ManagementForms.css`, `CentralisedTaskBoard.css`, `SandboxManagerModal.css`, `SubmissionModal.css`)

**Files**:
- `src/styles/ManagementForms.css` (29 `!important`s)
- `src/components/tasks/CentralisedTaskBoard.css` (28 `!important`s)
- `src/components/modals/SandboxManagerModal.css` (20 `!important`s)
- `src/components/modals/SubmissionModal.css` (10 `!important`s)
- `src/components/tasks/TaskListView.css` (9 `!important`s) & `TaskKanbanView.css` (7 `!important`s)

**Execution Steps**:
1. **`ManagementForms.css`**: Since `Login.css` and `SandboxManagerModal.css` `.form-group` collisions were already scoped in Phase 5, remove redundant `!important` declarations on `.form-group`, `.form-input-container`, and `.modal-footer` rules (verify specificity against `globalTheme.css`).
2. **`CentralisedTaskBoard.css`, `TaskListView.css`, `TaskKanbanView.css`**: Replace `!important` with parent-scoped selectors (e.g., `.centralised-board .task-card-master`, `.list-task-row.is-expanded`).
3. **`SandboxManagerModal.css` & `SubmissionModal.css`**: Scope under `.sandbox-modal` and `.submission-modal` and remove `!important`.
4. **Do NOT touch**: `react-datepicker` `!important` overrides in `EmployeeAttendanceBoard.css` or iOS `16px` input zoom guards in `index.css` / `DropdownSystem.css`.
5. Run `npm run build`.

**Visual Audit Checklist (6C)**:
- [ ] **Hub Task Board (Kanban, List, Tree)**: Card alignment, expanded list rows, stage headers, and selection checkboxes.
- [ ] **Add / Edit Task Modal (`HubTaskForm`) & Employee Form (`EmployeeForm`)**: Block-in-a-Box `.form-group` spacing, `.form-input-container` height (`44px`), and sticky footer buttons.
- [ ] **Proof of Work Modal (`SubmissionModal`) & Sandbox Manager Modal (`SandboxManagerModal`)**: Overlay, scrolling body, upload zone, and footer button alignment on desktop & mobile.

---

## Final Verification Command

After completing 6A, 6B, and 6C, run:
```powershell
npm run build
```
And verify active `!important` count dropped from **362** down to **< 60** (leaving only third-party `react-datepicker` and iOS/soft-keyboard guards).
