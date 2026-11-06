# Remarks Manager Grouping, Collapsible Rows & Grade Tags — PRD & TRD

**Status:** `Implemented`

**Date Created:** 2026-11-06
**Last Updated:** 2026-11-06
**Author / AI Session:** Antigravity session, Nov 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-11-06 | Draft | Initial document created for List View parity & Kanban collapsible employee rows with grade tags |
| 2026-11-06 | Implemented | Approved options implemented: collapsed active-employee rows by default in Kanban with non-zero colored grade tags, and Employee -> Grade Stage grouping in List Mode |

---

## 0. Context & Objectives

### 0a. Core Objective
In the Remarks Manager (`employee_tasks`), the List View currently displays standard workflow stages (`BACKLOG`, `IN_PROGRESS`, `REVIEW`, `COMPLETED`) instead of the remark grade columns (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`) and employee grouping used in Kanban View. Additionally, the Kanban View displays full expanded 4-column boards for every employee simultaneously, causing vertical clutter and hides a quick summary of an employee's remarks breakdown across grades.

### 0b. Success Metrics
- **Metric 1 (List Mode Parity):** Switching to List View in the Remarks Manager groups remarks by Employee (active first, then inactive) and within each employee by Remark Grade (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`), with left/right arrows updating the remark's grade (`priority`).
- **Metric 2 (Kanban Default Compact Rows):** By default in Kanban View on the Remarks Manager, only active employees who have remarks are listed as collapsed/compact summary rows showing their name and colored grade count tags (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`), expanding into the 4-column kanban board on click.
- **Metric 3 (Design System & Zero-Inline CSS Compliance):** All colored grade tags and row headers strictly use external CSS classes and theme variables (`var(--priority-urgent)`, `var(--priority-high)`, `var(--priority-medium)`, `var(--priority-low)`) with zero inline `style={{}}` violations.

### 0c. Out of Scope
- ❌ Modifying database schema or remark storage format (`priority` column continues to store `'Urgent'`, `'High'`, `'Medium'`, `'Low'`).
- ❌ Changing Tree View behavior in Remarks Manager.
- ❌ Altering Hub Task Board or Client Task Board grouping behavior.

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component | `TaskController` | `src/components/tasks/TaskController.jsx` |
| Component | `TaskKanbanView` | `src/components/tasks/TaskKanbanView.jsx` |
| Component | `TaskListView` | `src/components/tasks/TaskListView.jsx` |
| Component | `ListViewRow` | `src/components/tasks/ListViewRow.jsx` |
| Utility / Config | `remarksBoard` | `src/verticals/Employees/remarksBoard.js` |
| Utility / Mapping | `remarksMapping` | `src/verticals/Employees/remarksMapping.js` |
| Hook | `useEmployeeStatusMap` | `src/verticals/Employees/useEmployeeStatusMap.js` |
| Stylesheet | `TaskKanbanView.css` | `src/components/tasks/TaskKanbanView.css` |
| Stylesheet | `TaskListView.css` | `src/components/tasks/TaskListView.css` |

**Conflict Detection Check:**
Checked `docs/features/README.md`. No active `Draft`, `In Review`, or `Approved` feature touches `TaskController.jsx`, `TaskKanbanView.jsx`, `TaskListView.jsx`, or `remarksBoard.js`.

### 1b. Product Dependencies (Current User Flow)
**Current flow:**
1. User navigates to **Employees → Remarks Manager** (`activeVertical === 'employee_tasks'`).
2. In **Kanban Mode**, tasks have their `stageId` mapped to normalized priority (`Urgent`, `High`, `Medium`, `Low`), `stageList` is set to `REMARK_COLUMNS`, and `groupByEmployee` is enabled. Every employee group renders an always-expanded 4-column Kanban board, and inactive employees with remarks are rendered at the bottom.
3. In **List Mode**, `TaskListView` still receives `STAGE_LIST` (`BACKLOG`, `IN_PROGRESS`, etc.), `handleUIMoveTask`, and un-mapped `filteredTasks`, without employee grouping.

**Pain point / gap:**
1. List Mode does not match Kanban Mode's stages (`REMARK_COLUMNS`) or employee grouping (`groupByEmployee`).
2. Kanban Mode shows all employee boards expanded simultaneously (including inactive employees by default), making it hard to scan active employees and see their grade counts at a glance.

### 1c. Logical Dependencies (Current Business Rules)
- **Rule 1:** Remarks store their grade in `task.priority` (`Urgent` → `Special Conditions`, `High` → `Level 2`, `Medium` → `Level 1`, `Low` → `Level 0`).
- **Rule 2:** Moving a remark between columns/stages in Remarks Manager updates `task.priority` via `handleGradeChange` (subject to `taskUtils.canUserMoveTask`).
- **Rule 3:** `groupRemarksByEmployee(tasks, statusMap)` groups tasks by primary assignee (`assigned_to[0]`), sorting active employees A→Z first, unassigned next, and inactive employees A→Z last.

### 1d. Data & State Dependencies

| Table / View | Relevant Columns | Relationships |
|---|---|---|
| `tasks` | `id`, `vertical_id`, `priority`, `stage_id`, `assigned_to` | `assigned_to` contains `employees.id` |
| `employees` | `id`, `full_name`, `status` | Fetched via `useEmployeeStatusMap` |

**Client-side state (React):**
- [x] `useEmployeeStatusMap` in `TaskController.jsx` caches `{ [employeeId]: { name, isActive } }`.
- [x] Local UI state in `TaskKanbanView.jsx` / `TaskListView.jsx` for collapsible employee rows and inactive employee visibility.

### 1e. Security & Access (RBAC)

| Operation | Admin | Editor | Contributor | Viewer |
|---|---|---|---|---|
| READ | ✅ | ✅ | ✅ | ✅ (own/sphere) |
| CREATE | ✅ | ✅ | ✅ | ❌ |
| UPDATE | ✅ | ✅ | Own tasks | ❌ |
| DELETE | ✅ | ❌ | ❌ | ❌ |

**Sphere of Influence applies?** Yes (enforced upstream in `useTaskController` via `hierarchyFilteredTasks` and `filteredTasks`).
**RLS policy function used:** `get_user_permission_level('employees')`
**Vertical(s) affected:** `employee_tasks` (Remarks Manager under `EMPLOYEES`).

---

## 2. Proposed Options & Strategy

### 2a. Technical Options

**Option A — Unified Props & Shared Employee Grouping Helper (Recommended)**
- **Approach:**
  1. In `TaskController.jsx`, pass the same remark-grade props to `TaskListView` when `isRemarksBoard` is true:
     - `tasks={isRemarksBoard ? withGradeStage(filteredTasks) : filteredTasks}`
     - `allTasks={isRemarksBoard ? withGradeStage(hierarchyFilteredTasks) : hierarchyFilteredTasks}`
     - `stageList={isRemarksBoard ? REMARK_COLUMNS : STAGE_LIST.filter(s => showDeprioritized || s.id !== 'DEPRIORITIZED')}`
     - `updateTaskStage={isRemarksBoard ? handleGradeChange : handleUIMoveTask}`
     - `groupByEmployee={isRemarksBoard}` and `employeeStatusMap={employeeStatusMap}`
  2. In `remarksBoard.js`, add a helper `getRemarkGradeCounts(tasks)` that returns counts per grade (`Urgent`, `High`, `Medium`, `Low`) for a group's tasks, and update `REMARK_COLUMNS` to use semantic priority tokens.
  3. In `TaskKanbanView.jsx` (when `groupByEmployee` is true):
     - Filter groups by default to **only active employees (`group.isActive && !group.isUnassigned`) who have remarks (`group.tasks.length > 0`)** (with an optional toggle or header control if inactive/unassigned remarks exist, or strictly active employees with remarks by default).
     - Render each employee row as a compact, clickable header bar showing:
       - Chevron indicator + Employee Name + total count `({group.tasks.length})`
       - Colored grade tags for `Special Conditions`, `Level 2`, `Level 1`, and `Level 0` showing `# remarks` in each grade (using `.card-priority` badge classes `priority-urgent`, `priority-high`, `priority-medium`, `priority-low`).
     - Rows are collapsed by default (showing only the employee row with colored tags); clicking an employee row expands/collapses that employee's 4-column Kanban board below it (with an "Expand All / Collapse All" or per-row toggle).
  4. In `TaskListView.jsx`:
     - Support `groupByEmployee` (matching `groupByHubs` structure or flat grade stages — see Product Options below) and render `REMARK_COLUMNS` stages (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`).
     - In `ListViewRow.jsx`, ensure the right-arrow move button is not artificially disabled when `task.stageId !== 'COMPLETED'` on the Remarks board, and avoid redundant priority badge display if desired or keep it consistent.
- **Pros:** Minimal footprint, 100% reuse of `remarksBoard.js` across Kanban and List views, adheres strictly to modularity and CSS rules.
- **Cons:** None.
- **Complexity:** Low
- **Estimated effort:** < 1 hour

**Option B — Separate `RemarksListView` and `RemarksKanbanView` Components**
- **Approach:** Duplicate `TaskKanbanView` and `TaskListView` into dedicated components inside `src/verticals/Employees/`.
- **Pros:** Isolates Remarks UI completely.
- **Cons:** Violates the **Union Rule for Similar Components** in `development-best-practices` ("Whenever you find that 2 components are similar or share functionality, YOU MUST NOT DUPLICATE CODE").
- **Complexity:** Medium
- **Estimated effort:** 2–3 hours

**Recommended:** Option A — Follows the Union Rule and extends the existing `isRemarksBoard` pattern cleanly.

### 2b. Product Options (UI/UX)

We have two minor UX choices to align on:

1. **Kanban Mode — Employee Row Interaction & Tags:**
   - **Option 1 (Collapsible Accordion Rows — Default Collapsed):** By default, only active employees with remarks are shown as compact rows (`Employee Name (Total)` + colored tags: `Special Conditions: #`, `Level 2: #`, `Level 1: #`, `Level 0: #`). Clicking a row expands/collapses the 4-column Kanban board for that employee. (An optional `"Show Inactive"` button can reveal inactive employees if needed).
   - **Option 2 (Always Expanded Boards with Tags in Header):** Only active employees with remarks are shown, with the colored grade tags added to the employee header bar, and the 4-column Kanban board remains open below each header.

2. **List Mode — Grouping Structure:**
   - **Option 1 (Employee → Grade Stages, matching Kanban 1:1):** List Mode groups by Employee (with the same colored grade summary tags in the employee header) and inside each employee groups tasks by Grade Stage (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`).
   - **Option 2 (Grade Stages Only):** List Mode replaces the workflow stages (`Backlog`, `In Progress`, etc.) with the 4 Remark Grade stages (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`) at the top level.

### 2c. Logical Options (Business Rule Implementation)
- **Option A — Client-side grouping & filtering in `remarksBoard.js` (Recommended):**
  - Filter active employees with `group.isActive && !group.isUnassigned && group.tasks.length > 0` (when `statusMap` has loaded, checking `statusMap[key]?.isActive === true`).
  - Compute counts for `Urgent` (Special Conditions), `High` (Level 2), `Medium` (Level 1), and `Low` (Level 0) via `normalizeRemarkGrade(t.priority)`.

### 2d. Trade-offs (Cost vs. Benefit)

| Dimension | Recommended Approach (Option A) | Alternative Approach (Option B) |
|---|---|---|
| Modularity | ✅ Reuses `TaskKanbanView` & `TaskListView` union components | ❌ Duplicates DnD, selection, and hierarchy logic |
| Speed to ship | ✅ Fast, surgical update | ⚠️ High boilerplate |
| Maintainability | ✅ Single source of truth in `remarksBoard.js` | ❌ Two places to maintain task actions |
| Reversibility | ✅ 100% reversible frontend change | ✅ Reversible |

### 2e. Rollout & Backward Compatibility
- **Feature flag required?** No
- **Database migration required?** No
- **Mobile app (Capacitor) impact:** None (mobile locks to Kanban view and benefits from the cleaner active-only employee rows and colored grade tags).
- **Impact on existing users:** Remarks Manager List View and Kanban View will immediately reflect the unified grade stages and cleaner active-employee rows.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `employeeStatusMap` loads asynchronously after `tasks` | For a brief render before `statusMap` populates, inactive employees might flash if default is `true` | Wait for `Object.keys(employeeStatusMap).length > 0` or default `isActive` check to `Boolean(statusMap[id]?.isActive)` once loaded so inactive/unknown records don't flash |
| Inline styles in `TaskKanbanView.jsx` | Violates Zero Inline Styling Policy | Move all employee row and grade tag styles into `TaskKanbanView.css` and `TaskListView.css` using standard classes |

### 3b. Product Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Users may want to see all 4 grade tags vs. only non-zero grade tags | Visual density vs. completeness | Render all 4 grade tags (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`) with their counts (or dim `0`-count tags via a CSS modifier class `.remark-grade-tag--zero`) |
| Users might occasionally need to view remarks on inactive employees | Hidden by default | Provide a subtle `"Show Inactive"` toggle button in the header or bottom of the board |

### 3c. Logical Risks (Edge Cases)

| Edge Case | What Goes Wrong | How We Handle It |
|---|---|---|
| Remark has no `assigned_to` (`unassigned`) | Not an active employee name | Excluded from the default "active employees with remarks" filter in Kanban mode |
| Moving remark grade in List View via `<` / `>` arrows | `ListViewRow` checks `stageList` index and calls `updateTaskStage(task.id, targetStageId)` | Because `stageList` is `REMARK_COLUMNS` and `updateTaskStage` is `handleGradeChange`, `<` and `>` arrows seamlessly upgrade/downgrade the remark grade |

### 3d. Testing Plan

```
[ ] TEST 1 — List Mode Stages & Grouping Match Kanban Mode
    Persona: Admin / Editor
    Action: Open Employees -> Remarks Manager, switch to List Mode
    Expected: Stages are Special Conditions, Level 2, Level 1, Level 0 (instead of Backlog/In Progress/etc.) and grouped consistently with Kanban Mode; left/right arrows change remark grade.

[ ] TEST 2 — Kanban Default Active Employees Only & Colored Grade Tags
    Persona: Admin / Editor
    Action: Open Employees -> Remarks Manager in Kanban Mode
    Expected: Only active employees who have >= 1 remark are shown by default; each employee row displays colored tags with the count of remarks in Special Conditions, Level 2, Level 1, and Level 0.

[ ] TEST 3 — Empty State
    Persona: Viewer with no remarks
    Action: Navigate to Remarks Manager
    Expected: Clean empty state with no crashes.

[ ] TEST 4 — Mobile Viewport (375px) & Small Laptop (1024px/1280px)
    Action: Resize viewport to 375px and 1280px
    Expected: Grade tags wrap cleanly without horizontal overflow.
```

### 3e. Rollback & Reversibility
**Is this change reversible without data loss?** ✅ Yes (100% frontend presentation & grouping logic).


---

## Implementation Notes

**Status at implementation:** `Implemented`

**Deviations from plan:**
- None. Implemented Option A across all 3 decisions confirmed by the user:
  1. Kanban Mode defaults to collapsed rows showing only active employees with remarks, expanding their 4-column board on click.
  2. Colored grade tags (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`) render only for levels where count > 0.
  3. List Mode groups by Employee first (with the same colored grade count tags) and by Remark Grade Stage (`Special Conditions`, `Level 2`, `Level 1`, `Level 0`) inside each employee, and passes `leftStageId`/`rightStageId` to `tva.handleMove` so arrow buttons in both List and Kanban views change remark grades.


## Amendment: 2026-11-06 — Compact Numeric Tags & 'By Hub' Mode Parity
**Type:** Minor Amendment
**Requested Change:**
1. In Remarks Manager, the colored grade tags on each employee row do not need the text prefix (`Level 1`, etc.) — display only the count with the semantic priority color coding (`title` attribute preserves tooltip label).
2. In Hub Task Manager's `'By Hub'` mode (`groupByHubs`), make each Hub row behave identically: collapsed by default in Kanban View (click to expand/collapse that Hub's board) and displaying the color-coded count tags for Urgent / High / Medium / Low tasks present in that Hub across both Kanban and List views.
3. Position the colored count tags immediately after the employee/hub name and total count (`(n)`) inside the title group rather than pushed to the far right end.
**Phases Affected:** Phase 2a, Phase 2b
**Approved:** Yes (User-requested in session)
