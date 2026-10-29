# Future Implementation — Master Admin Phone Homepage Tray

> Status: PLAN ONLY. No code has been edited. Revisit on or after **2026-10-30**.
> Created: 2026-10-28

## 1. Request

On the **homepage, phone view, Master Admin**, the top switcher tray currently has 4 options:
`Track Requests`, `Request Support`, `Centralised Tasks`, `Executive Summary`.

1. Keep ONLY `Track Requests` and `Request Support`.
2. Remove `Centralised Tasks` and `Executive Summary` **from the tray for now**. Do NOT delete their components or code blocks. Just stop calling them.
3. Add `Live Attendance` as the **3rd** option.

## 2. Complexity Verdict

**Low. About 1–2 hours including testing. Single-file change in practice.**

| Area | Effort | Risk |
|---|---|---|
| Tray buttons (hide 2, add 1) | Small | Low |
| View routing / default view | Small | Low-Med (effects can fight each other) |
| Live Attendance view for master admin | Small | Low (component already exists) |
| Touch-scroll verification on phone | Small | Medium (this exact view had scroll bugs before) |
| Desktop regression check | Small | Low (change is gated to mobile + master admin) |

No DB, RLS, migration, or RBAC changes needed.

## 3. Where The Code Lives (verified)

All in [ExecutiveSummary.jsx](src/components/dashboard/ExecutiveSummary.jsx) (the orchestrator):

- **Mobile tray**: the `<nav className="summary-navigation-tray">` block. Today it renders 5 buttons:
  1. Current Attendance — already hidden for `master_admin`
  2. Track Requests — only if `hasEscalations`
  3. Request Support — opens the escalation modal, no view change
  4. Centralised Tasks — if `showCentralisedTasks`
  5. Executive Summary — if `isSMRole`
- **View state**: `activeView`. Master admin default is `'centralised_task_view'`, everyone else `'attendance_self_service'`.
- **Section rendering**: `escalations`, `centralised_task_view`, `executive_summary` sections render when `!isMobile || activeView === '<view>'`. Attendance renders only when `activeView === 'attendance_self_service'`.
- **Two auto-switch effects** that reference `centralised_task_view` and `escalations`. These must be updated or they will push the master admin back to the hidden view.
- **Scroll-reset effect**: hard-codes `scrollTop` for `escalations` (76) and `centralised_task_view` (54). Needs a branch for the new view (likely 0).
- **Live Attendance component**: [LiveAttendanceTab.jsx](src/verticals/Employees/attendance/LiveAttendanceTab.jsx), default export, takes `{ user }`. Marked `// @prod-critical`.
- **Wrapper today**: `AttendanceSelfServiceContent` in [AttendanceSelfService.jsx](src/verticals/Employees/attendance/AttendanceSelfService.jsx) shows the two-tab bar (Current / Live) for Contributor+.

## 4. Proposed Approach

### 4.1 Gate everything on `isMobile && roleId === 'master_admin'`
Define one flag, e.g. `isMasterAdminMobileHome`. Desktop and all other roles keep today's behavior untouched.

### 4.2 Tray (master admin, phone)
Render exactly: `Track Requests` (if `hasEscalations`) → `Request Support` → **`Live Attendance`**.
- Do not delete the Centralised Tasks / Executive Summary button JSX. Wrap in `!isMasterAdminMobileHome &&` (or equivalent) so the code stays in place.
- Live Attendance button: reuse `summary-nav-item stage-orange` + `IconClock` (already imported), label "Live Attendance". No new CSS expected; the tray uses `flex: 1`, so 3 items space out automatically.

### 4.3 New view `'live_attendance'`
Two options (decide on revisit):
- **Option A (recommended)**: render `<LiveAttendanceTab user={user} />` directly. Master admin usually has no personal check-in need, so the "Current Attendance" tab is noise. No change to `AttendanceSelfService.jsx`.
- **Option B**: add an optional prop (e.g. `defaultTab="live"` / `hideTabs`) to `AttendanceSelfServiceContent`. Only worth it if the master admin also needs their own check-in on the homepage.

### 4.4 Default view and effects
- Master admin phone default → `'live_attendance'` (or `'escalations'` when requests exist — decide on revisit).
- Update the two auto-switch effects so they never fall back to `centralised_task_view` for the master admin phone case.
- Add `'live_attendance'` to the scroll-reset effect (reset to 0).

### 4.5 Keep the code, don't call it
`CentralisedTaskBoard` and `ExecutiveMetricsSection` imports/blocks stay. They simply never become the active view on master admin phone. Leave a short comment explaining why, e.g. "Hidden for master admin on phone per 2026-10-28 request; kept for re-enable".

## 5. Rules / Skills To Follow When Implementing

- **safe-code-modification**: no logic deletion, preserve all comments, CSS only in `.css` files (no inline styles).
- **development-best-practices**: reuse existing components, strict modularity.
- **production-safeguards**: read first. `LiveAttendanceTab.jsx` is `@prod-critical`; do not modify it, only mount it.
- **adaptive-ui-strategy / shell-architecture-system**: phone-only behavior stays in the mobile path; desktop untouched.
- **ui-design-system**: reuse existing tray item classes and tokens; no hardcoded hex.
- **feature-planning-workflow**: check whether a PRD/TRD in `docs/features/` is required before building (this file may be enough for a change this small — confirm).
- **tutorial-synchronization-workflow**: the home tray changes visibly; decide whether tutorial slides need an update.
- **RBAC rule (user-stated)**: `vertical_access` ALWAYS overrides `feature_access`. This change does not touch `useRBAC`, and must not.
- Do NOT push to git unless explicitly told. Do NOT edit the production Supabase DB.

## 6. Things To Watch (known gotchas)

1. **Touch scroll on the homepage.** The home Live Attendance view had a real bug where finger-swipe didn't scroll. Fixed with CSS in the working tree (App.css, DesktopLayout.css, MobileLayout.css, ExecutiveSummary.css) — **confirm those fixes are committed/deployed first**, then re-test the new view with a real touch drag.
2. **Polling side effect.** `fetchLiveAttendance()` calls `rpc_auto_checkout_stale_sessions` on every 60s poll. Making Live Attendance the *default* master-admin view means that RPC fires more often. Acceptable, but worth knowing.
3. **Track Requests is conditional** (`hasEscalations`). With no open requests the tray has only 2 items (Request Support + Live Attendance). Confirm that's fine visually.
4. **Master admin impersonation.** `user.roleId` follows the impersonated user. Test both real master admin and impersonating a non-admin.
5. **Order matters.** User asked for Live Attendance as the **3rd** option. Because Track Requests can disappear, "3rd" may visually be 2nd. Fixed order in code: Track Requests, Request Support, Live Attendance.

## 7. Open Questions For Revisit

1. Master admin **only**, or also other C+ roles (they currently get Centralised Tasks via seniority)? Plan assumes master admin only.
2. Default landing view for master admin phone: Live Attendance, or Track Requests when there are open requests?
3. Option A (Live tab only) or Option B (keep Current + Live tabs)?
4. Show a live count badge on the tray button? Would require polling at `ExecutiveSummary` level even when the tab isn't open — not recommended for v1.
5. Is the hide temporary ("for now")? If so, keep the single flag so re-enabling is a one-line change.

## 8. Test Plan

Using headless Chrome with real touch-drag (Puppeteer `touchscreen`), plus a manual phone check:

- Phone 390×844 and ≤360px: master admin sees only Track Requests (if any), Request Support, Live Attendance.
- Tapping Live Attendance shows hub cards; **finger swipe scrolls the page** with 10+ cards.
- Request Support still opens the modal; Track Requests still switches view.
- Desktop (1280×800): unchanged (all sections present).
- Non-master-admin on phone: unchanged tray.
- Impersonation: master admin → non-admin → back.
- `npm run build` passes.

## 9. Rough Task List

1. Add `isMasterAdminMobileHome` flag in `ExecutiveSummary.jsx`.
2. Gate Centralised Tasks and Executive Summary tray buttons behind `!flag` (keep JSX).
3. Add Live Attendance tray button (3rd).
4. Add `'live_attendance'` view + render `LiveAttendanceTab`.
5. Update default `activeView`, the two auto-switch effects, and the scroll-reset effect.
6. Verify touch scroll + desktop + non-admin regression.
7. Build, report, **do not push**.


---

# Future Implementation — Remarks Manager List Mode Grouped by Employee (Subtask-Style Hierarchy)

> Status: PLAN ONLY. No code has been edited.
> Created: 2026-10-29

## 1. Request Summary

In the **Remarks Manager (`employee_tasks` / `EMPLOYEES`) list view**, replace the default stage-based grouping with an **Employee hierarchy grouping** structured similarly to how tasks display nested subtasks in the list view:

1. **Top-Level (Parent Rows)**: Grouped by **Employee**.
2. **Order of Employee Rows**: Ranked by the **Highest Level Remark** assigned to that employee (highest severity first).
   - *Example*:
     - Villy has 1 × Level 2 and 1 × Level 0.
     - Lokesh has 1 × Level 1.
     - Display order: **Villy**, then **Lokesh** (since Level 2 > Level 1).
3. **Employee Row Summary Badges / Breakdown**:
   - In each employee's parent row / summary, display count indicators for:
     - `#special condition remarks` in **Red**
     - `#level 2` in **Orange**
     - `#level 1` in **Blue**
     - `#level 0` in **Green**
4. **Nested Child Rows**:
   - Under each employee's parent row, expand/collapse to reveal their respective remarks formatted like the existing list rows (`ListViewRow`).
   - Grouping/nesting uses the same expander arrow, indentation, and collapsible behavior as subtasks (`hierarchyUtils` & `tree-expander`).

---

## 2. Technical Architecture & Component Mapping

### Key Files & Touchpoints

1. **`src/components/tasks/TaskListView.jsx`**
   - Currently groups tasks strictly by `stageList.map(stage => ...)` or optionally by `groupByHubs`.
   - Uses `hierarchyUtils.sortByHierarchy(rawStageTasks, 'id', 'parentTask')` to calculate row nesting depth (`depth * 24px`) and tracks expanded nodes in `expandedIds` Set.
   - Requires support for an alternate group mode (e.g., `groupMode = 'employee'` or vertical-specific tree builder).

2. **`src/components/tasks/ListViewRow.jsx`**
   - Renders individual task rows with expander arrow (`.tree-expander`), badges (`AssigneeBadge`, priority badges, custom vertical tiles), and stage transition buttons.
   - For remarks, row color badges or borders will reflect the remark grade:
     - Urgent / Special Conditions (`priority-urgent`) → Red
     - High / Level 2 (`priority-high`) → Orange
     - Medium / Level 1 (`priority-medium`) → Blue
     - Low / Level 0 (`priority-low`) → Green

3. **`src/verticals/Employees/remarksMapping.js`**
   - Canonical mapping for grades:
     - `Low` ↔ `Level 0`
     - `Medium` ↔ `Level 1`
     - `High` ↔ `Level 2`
     - `Urgent` ↔ `Special Conditions`
   - Needs helper functions:
     - Rank weights: `Urgent: 4`, `High: 3`, `Medium: 2`, `Low: 1`, `None: 0`.
     - Color tokens matching Design System variables.
     - Function to calculate highest remark grade and breakdown counts per employee.

4. **`src/registry/verticalRegistry.js`**
   - Configure vertical flags or list mode resolver for `employee_tasks` / `EMPLOYEES` to signal employee-first grouping rather than stage-first grouping.

---

## 3. Implementation Steps (Plan Only)

### Step 1: Centralized Helpers in `remarksMapping.js`
- Define rank weights and grade counters:
  ```javascript
  export const REMARK_GRADE_RANK = {
    Urgent: 4, // Special Conditions
    High: 3,   // Level 2
    Medium: 2, // Level 1
    Low: 1,    // Level 0
  };

  export const calculateEmployeeRemarkMetrics = (tasks) => {
    // Computes highest severity rank and counts for Special Conditions, Level 2, Level 1, Level 0
  };
  ```

### Step 2: Virtual Parent Row Generator in `TaskListView.jsx`
- For employee grouping mode:
  1. Scan all remarks and associate them with their assigned employee(s) via `task.assigned_to`.
  2. Synthesize virtual parent rows for each employee:
     `{ id: 'emp:<employeeId>', isEmployeeGroup: true, text: employeeName, depth: 0, metrics: { ... } }`
  3. Sort employee parent rows:
     - Primary: Highest remark level descending (Special Conditions → Level 2 → Level 1 → Level 0).
     - Secondary: Alphabetical employee name.
     - Tertiary: Unassigned group placed at the end.
  4. Attach top-level remarks as children of their employee row (`parentTask = 'emp:<employeeId>'`), with `depth = 1`.
  5. Existing remark subtasks remain nested under their respective parent remark at `depth = 2`.

### Step 3: Expand/Collapse & Subtask Parity
- Leverage existing `expandedIds` set and `toggleExpand` logic:
  - Employee virtual rows toggle `expandedIds` just like subtask parent rows.
  - Default state: expanded so all employees and remarks are immediately visible.
  - The tree expander icon (`hierarchy-arrow`) rotates on toggle.

### Step 4: Row Presentation & Color Coding
- **Employee Header / Parent Row**:
  - Displays employee name and photo / avatar.
  - Summary count badges with tokenized styling:
    - Special Conditions count badge (Red)
    - Level 2 count badge (Orange)
    - Level 1 count badge (Blue)
    - Level 0 count badge (Green)
- **Nested Remark Rows (`ListViewRow`)**:
  - Render existing task controls (assignee, attachments, status/stage chip, quick edit).
  - Apply grade accent border or pill based on `task.priority` using design system CSS classes (`.remark-grade-urgent`, `.remark-grade-high`, `.remark-grade-medium`, `.remark-grade-low`).

### Step 5: Registry & Controller Wiring
- Pass `groupMode = 'employee'` to `CentralisedTaskBoard` / `TaskController` when `activeVertical === 'employee_tasks'`.
- Preserve standard stage grouping for all other verticals (Projects, Finance, etc.).

---

## 4. Open Design Decisions Before Execution

1. **Multi-Assignee Remarks**:
   - If a remark is assigned to multiple employees, should it appear under *each* assigned employee, or only under the *senior-most* employee? (Recommendation: show under each employee for complete employee-centric views).
2. **Stage Context Visibility**:
   - Because stage headers are replaced by employee parent rows, remark rows should prominently display a compact stage chip (e.g., "In Progress", "Completed", "Review") so stage progression remains obvious.
3. **Bulk Actions**:
   - When checking the checkbox on an employee parent row, determine whether it selects all child remarks for that employee.
