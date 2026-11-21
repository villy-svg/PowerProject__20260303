# Runbook: Attendance Board — Redundancies, Dead Code & Bug Cleanup

**Status:** `Executed (Section A + All Audited Cleanups Complete — 2026-11-20)`  
**Date Created:** 2026-11-20  
**Scope:** Pre-existing redundancies, dead code, silent bugs, and Section A cleanup items discovered during the Attendance Board audit.

> **Execution Rule (`production-safeguards`):** Do **not** execute this runbook until Sections B, C, and D are finalized, the PRD/TRD is approved, and explicit execution consent is granted.  
> **Preservation Rule (A.2 / A.4 / A.5):** Wherever complex Schedule Planner / Plan Approval / My Plans UI is stripped, **keep external wiring intact** (hooks, services, DB tables, props) and add explicit `// TODO(future-rebuild): ...` comments marking what was removed and why.

---

## 1. Confirmed Bugs to Fix

### 1.1 `setActivePlanId` Missing from `useScheduleDrafting` Return Object
- **Files:**
  - `src/verticals/Employees/attendance/hooks/useScheduleDrafting.js` (lines 211–229)
  - `src/verticals/Employees/EmployeeAttendanceBoard.jsx` (line 117)
  - `src/verticals/Employees/attendance/components/AttendanceBoardHeader.jsx` (lines 92, 255)
- **Issue:** `EmployeeAttendanceBoard` destructures `setActivePlanId` from `useScheduleDrafting` and passes it to `AttendanceBoardHeader`, which calls `setActivePlanId(null)` on week change. Because `useScheduleDrafting` does not return `setActivePlanId`, changing the week triggers a runtime `TypeError`.
- **Fix:** Either return `setActivePlanId` from `useScheduleDrafting` or remove the call if the week picker is stripped/replaced during the A.2 simplification.

### 1.2 `maker_note` & `suggested_leave_type` Missing from `fetchPendingRequests`
- **Files:**
  - `src/services/employees/editRequestService.js` (lines 79–113)
  - `src/verticals/Employees/attendance/AttendanceApprovalDrawer.jsx` (lines 84–88, 145–150)
- **Issue:** `AttendanceSuggestEditModal` saves `maker_note` on leave requests, and `AttendanceApprovalDrawer` attempts to render `request.maker_note` and `request.suggested_leave_type`, but `fetchPendingRequests()` never selects those columns from `attendance_edit_requests`.
- **Fix:** Verify column names in `db_types.ts` and add `maker_note` (and `suggested_leave_type` if present in schema; otherwise remove dead UI check) to the `.select(...)` query in `fetchPendingRequests()`.

### 1.3 `AttendanceCell` `React.memo` Comparator Misses `shift_type`
- **File:** `src/verticals/Employees/attendance/AttendanceGrid.jsx` (lines 127–133)
- **Issue:** Custom memo comparator checks `attendance_status`, `hub_id`, `has_pending_edit`, and `is_draft`, but omits `shift_type`. Switching a cell between `Present (Day)` and `Present (Night)` will not re-render the cell icon.
- **Fix:** Add `prev.record?.shift_type === next.record?.shift_type` to the comparator.

### 1.4 Casing Mismatch on `employee_Schedule_plan_entries`
- **Files:**
  - `src/verticals/Employees/attendance/SchedulePlanApprovalDrawer.jsx` (lines 50, 54, 57, 214)
  - `src/verticals/Employees/attendance/ScheduleMyPlansDrawer.jsx` (lines 58, 60)
  - `src/verticals/Employees/attendance/hooks/useScheduleDrafting.js` (line 194 — uses lowercase `employee_schedule_plan_entries`)
- **Issue:** Capital `S` (`employee_Schedule_plan_entries`) does not match the Supabase relation name (`employee_schedule_plan_entries`), causing employee counts/entries in those drawers to read as empty.
- **Fix:** Normalize to `employee_schedule_plan_entries` (or document inside the `// TODO(future-rebuild)` note if these drawers are stripped/parked per A.4 & A.5).

### 1.5 Missing Status Labels in `AttendanceApprovalDrawer`
- **File:** `src/verticals/Employees/attendance/AttendanceApprovalDrawer.jsx` (lines 32–37)
- **Issue:** `STATUS_LABELS` only includes `present`, `week-off`, `leave`, `absent`. `no-show` and `no-call-no-show` fall back to raw hyphenated slugs.
- **Fix:** Add `'no-show': 'No Show'` and `'no-call-no-show': 'No Call No Show'` (ideally sourced from a single shared status metadata constant).

### 1.6 Non-IST Date Serialization in `handleRangeChange`
- **File:** `src/verticals/Employees/EmployeeAttendanceBoard.jsx` (lines 198–216)
- **Issue:** Uses manual `getTimezoneOffset()` + `toISOString().split('T')[0]` instead of IST-aware `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` (which `useAttendanceBoard.js` explicitly enforces).
- **Fix:** Extract `toISTDateString` into `attendanceDateUtils.js` and reuse it in both `useAttendanceBoard.js` and `EmployeeAttendanceBoard.jsx`.

### 1.7 `liveMap` & `scheduleMap` Rebuilt Every Render
- **File:** `src/hooks/useAttendanceBoard.js` (lines 195–209, 216–248)
- **Issue:** `liveMap` and `scheduleMap` are recreated as new objects on every render, invalidating `getCellData`'s `useCallback` dependencies on every render.
- **Fix:** Wrap `liveMap` and `scheduleMap` construction in `useMemo([attendanceRecords])` and `useMemo([scheduledRecords])`.

---

## 2. Redundancies & Dead Code to Remove

### 2.1 Duplicate Week Picker in Planner Mode
- **File:** `src/verticals/Employees/attendance/components/AttendanceBoardHeader.jsx`
  - Instance 1: `leftActions` (lines 81–103, React `DatePicker` with `showWeekPicker`)
  - Instance 2: `expandedLeft` (lines 247–260, native `<input type="week">`)
- **Cleanup:** Remove the duplicate week picker (and keep only what the simplified A.2 single-employee multi-day updater needs).

### 2.2 Unused `dateFilterControl` Prop in `AttendanceMobileList`
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceMobileList.jsx` (lines 27, 62–66, 115–119)
  - `src/verticals/Employees/attendance/AttendanceMobileList.css` (lines 138–145)
- **Cleanup:** Remove dead prop and unused `.attendance-mobile-list__date-filters` class once replaced by the new mobile Attendance Board layout.

### 2.3 Unused `IconX` Imports
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceGrid.jsx` (line 21)
  - `src/verticals/Employees/attendance/AttendanceMobileList.jsx` (line 2)
- **Cleanup:** Remove unused `IconX` import in both files.

### 2.4 Unused `STATUS_META.label` Strings
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceGrid.jsx` (lines 28–36)
  - `src/verticals/Employees/attendance/AttendanceMobileList.jsx` (lines 6–14)
- **Cleanup:** Consolidate status metadata (label, short code, CSS class) into a single shared constants module under `src/verticals/Employees/attendance/utils/` so Grid, Mobile, Legend, Edit Modal, and Approval Drawer all stay in sync.

### 2.5 Unused `onClose` Prop in `AttendanceApprovalDrawer` & `SchedulePlanApprovalDrawer`
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceApprovalDrawer.jsx` (passed at `EmployeeAttendanceBoard.jsx:334`, never destructured)
  - `src/verticals/Employees/attendance/SchedulePlanApprovalDrawer.jsx` (passed at `EmployeeAttendanceBoard.jsx:342`, never destructured)
- **Cleanup:** Wire `onClose` to an explicit in-view `← Back to Board` button (required for mobile where `leftActions` is not rendered) or remove if handled by a dedicated mobile bar.

### 2.6 Unused Service Function `fetchRequestsForAttendance`
- **File:** `src/services/employees/editRequestService.js` (lines 183–207)
- **Verification:** Zero callers across `src/`.
- **Cleanup:** Remove or mark `@deprecated` if not needed for future cell-history inspection.

### 2.7 Inline Styles & Embedded `<style>` Tag (Skill Violations)
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceApprovalDrawer.jsx` (lines 58–62 — inline `style={{ ... }}`)
  - `src/verticals/Employees/attendance/SchedulePlanApprovalDrawer.jsx` (lines 77–81 inline styles + lines 293–319 embedded `<style>` block with unused `.sp-plan-card__expand-btn` / `.sp-plan-card__emp-list` / `.sp-plan-card__emp-chip` classes)
- **Cleanup:** Move active styles into scoped BEM CSS classes (per `safe-code-modification §2`) and delete unused embedded CSS.

---

## 3. Section A Structural Cleanup Summary (Captured Decisions)

| Item | Decision | Implementation Direction |
|---|---|---|
| **A.1 Attendance Board** | Keep & fix for phone; audit desktop | Desktop fixes: `shift_type` memo bug, `Approvals` count badge, `useMemo` maps, IST date helper. Phone: full adaptive rebuild (pending B/C/D). |
| **A.2 Schedule Planner** | Strip complex bulk paintbrush/grid drafting; replace with simple **1 person, multiple days at a time** updater | Keep `useSchedulePlanner` & `schedulePlannerService` external wiring intact. Add `// TODO(future-rebuild)` comments wherever bulk planner UI/state is removed. |
| **A.3 Pending Edit Requests** | Keep & clean up | Fix missing `maker_note` query, add `no-show`/`no-call-no-show` labels, add pending count badge on header button, remove inline styles, fix partial-failure handling in bulk approve/reject, add mobile-friendly card layout + `← Back` control. |
| **A.4 Pending Schedule Plans** | Same treatment as A.2 | Strip complex bulk plan approval UI for now; keep service/hook wiring intact with `// TODO(future-rebuild)` comments. |
| **A.5 My Plans History Drawer** | Same treatment as A.2 | Strip drawer UI for now; keep `myPlans` hook/service wiring intact with `// TODO(future-rebuild)` comments. |

---

## 4. Docs / Registry Hygiene
- Update [docs/features/employee_attendance_board_optimization.md](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/docs/features/employee_attendance_board_optimization.md) (currently stuck in `Draft` since 2026-08-22 even though its `React.memo` + `useScheduleDrafting` + `AttendanceBoardHeader` refactor is already in code) — mark as `Superseded` or `Implemented` in [docs/features/README.md](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/docs/features/README.md) when the new Attendance Board PRD/TRD is created.


---

## 5. Deep Audit of Sections B, C, D — Bloat, Redundancies & Bugs

### 5.1 Three Conflicting IST Date Serializers (Android 8 Bug)
- **Files:**
  - `src/services/employees/attendanceService.js` (lines 30–34) — fixed `+5.5h` offset (Android 8 WebView safe)
  - `src/hooks/useAttendanceBoard.js` (lines 40–42) — uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` (**breaks on Android 8 Chrome 64 WebView**, as explicitly warned in `attendanceService.js`!)
  - `src/verticals/Employees/EmployeeAttendanceBoard.jsx` (lines 201–215) — manual `getTimezoneOffset()` + `toISOString().split('T')[0]`
- **Cleanup:** Export a single Android-8-safe `toISTDateString(date)` from `attendanceDateUtils.js` and use it everywhere.

### 5.2 Duplicate ISO Week Calculations (3 Copies)
- **Files:**
  - `src/verticals/Employees/attendance/utils/attendanceDateUtils.js` (`getWeekStringFromDate`)
  - `src/verticals/Employees/attendance/components/AttendanceBoardHeader.jsx` (lines 86–90 — inline copy)
  - `src/verticals/Employees/attendance/hooks/useScheduleDrafting.js` (lines 186–191 — inline copy)
- **Cleanup:** Delete inline copies; call `getWeekStringFromDate` (or remove along with stripped bulk planner).

### 5.3 Heavy Over-Fetching in `fetchAttendanceForDateRange`
- **File:** `src/services/employees/attendanceService.js` (lines 46–75)
- **Issue:** Selects unused heavy columns (`login_geolocation`, `logout_geolocation`, `session_logs_data` JSONB) and joins `employees ( ..., hubs (...) )` on every attendance record even though the board already fetches employees separately and never renders geolocation or session logs.
- **Cleanup:** Trim `.select(...)` to only the columns the Attendance Board actually uses (`id, employee_id, shift_date, attendance_status, shift_type, first_login_time, logout_time, updated_at, attendance_edit_requests ( id, request_status )`).

### 5.4 Redundant Double Employee Query on Mount
- **Files:**
  - `src/hooks/useAttendanceBoard.js` (lines 129, 175)
  - `src/services/employees/attendanceService.js` (`fetchEmployeesForAttendance` vs `fetchAllEmployeesForAttendanceSearch`)
- **Issue:** Both queries fetch the **exact same columns** from `employees` on mount — one paginated (50 rows) and one unpaginated (all active rows). Because all active employees are already fetched for search, the separate paginated DB round-trip is redundant.
- **Cleanup:** Fetch active employees once (`fetchAllEmployeesForAttendanceSearch`) and slice client-side if pagination is kept, eliminating 1 DB query per page/date change.

### 5.5 Raw Supabase Query in `useHubs.js` (Architecture Violation)
- **File:** `src/verticals/Employees/attendance/hooks/useHubs.js` (lines 12–25)
- **Issue:** Calls `supabase.from('hubs')` directly inside a hook, violating `development-best-practices §10` (all queries must live in `src/services/`).
- **Cleanup:** Move to an existing hubs service (or `attendanceService.js`) — or remove if hub dropdown is not needed after B/C/D decisions.

### 5.6 Three Conflicting Status Color Systems
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceGrid.css` (uses `--brand-green`, `--status-danger`, `--brand-blue`, `--status-warning`; `no-show`/`no-call-no-show` = warning yellow)
  - `src/verticals/Employees/attendance/AttendanceLegend.css` (uses `--status-success`, `--status-info`, `--status-danger`; `no-show`/`no-call-no-show` = danger red)
  - `src/verticals/Employees/attendance/AttendanceMobileList.css` (uses `--attendance-present`, `--attendance-week-off`, `--attendance-leave`, `--attendance-absent-text`)
- **Cleanup:** Unify onto one canonical set of design-system tokens across Grid, Mobile, Legend, and Modals.

### 5.7 Dead CSS Classes
- **Files:**
  - `src/verticals/Employees/attendance/AttendanceMobileList.css` (`.attendance-list-item__shift` — never rendered; `.attendance-mobile-list__date-filters` — unused prop)
  - `src/verticals/Employees/attendance/SchedulePlanApprovalDrawer.jsx` (embedded `<style>` block with `.sp-plan-card__expand-btn`, `.sp-plan-card__emp-list`, `.sp-plan-card__emp-chip` — none match the JSX class names!)

### 5.8 `AttendanceSuggestEditModal` Gaps (Section D.16)
- **File:** `src/verticals/Employees/attendance/AttendanceSuggestEditModal.jsx`
- **Issues:**
  - Allows submitting `Present` with `shiftType = ''` (`— None —`), leaving login/logout times null.
  - Hardcoded shift timestamps (`${date}T10:00`) lack explicit `+05:30` IST timezone offset.
  - Contributors can submit duplicate pending edit requests on a cell that already has `has_pending_edit === true`.
  - Centered desktop modal with dropdowns instead of a mobile bottom sheet with 1-tap chips.
