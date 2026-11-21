# Attendance Board — Mobile Redesign, Section A Simplification & Cleanup (PRD/TRD)

**Status:** `Implemented`  
**Date Created:** 2026-11-20  
**Last Updated:** 2026-11-20  
**Author / AI Session:** Antigravity session, Nov 2026  

---

## 0. Context & Objectives

### 0a. Core Objective
Make the Manager Attendance Board genuinely usable on phone screens while cleaning up accumulated bloat, bugs, and over-complex bulk scheduling UI. Managers on mobile need to check daily team attendance at a glance, manage date ranges, suggest edits in 1–2 taps, and approve pending requests without getting trapped or losing controls.

### 0b. Success Metrics
- **Metric 1 (Phone Usability):** All primary actions (date range + presets, By Day / By Employee toggle, Multi-Day Update, Approvals with `← Back`, Refresh) are reachable in ≤ 2 taps on a 360px phone viewport with ≥ 40–44px touch targets.
- **Metric 2 (Data Efficiency):** Eliminate 1 redundant full-table `employees` query per mount/date change and trim heavy unused JSONB columns (`session_logs_data`, geolocations) from `fetchAttendanceForDateRange`.
- **Metric 3 (Zero Desktop Regression):** Desktop retains full Employee × Date grid, gains Hub filtering, Today column highlight, check-in/out hover tooltips, 4 date presets, and fixed `shift_type` memoization.

### 0c. Out of Scope
- ❌ Rebuilding the complex multi-employee paintbrush Schedule Planner (external wiring in `useSchedulePlanner` / `schedulePlannerService` is intentionally kept intact with `// TODO(future-rebuild)` comments).
- ❌ Supabase database schema migrations or RLS changes.

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies
- **Components:** `EmployeeAttendanceBoard.jsx`, `AttendanceBoardHeader.jsx`, `AttendanceGrid.jsx`, `AttendanceMobileList.jsx`, `AttendanceApprovalDrawer.jsx`, `AttendanceSuggestEditModal.jsx`, `SingleEmployeeBulkUpdateModal.jsx`
- **Hooks:** `useAttendanceBoard.js`, `useSchedulePlanner.js` (parked), `useScheduleDrafting.js` (parked), `useHubs.js`
- **Services:** `attendanceService.js`, `editRequestService.js`, `schedulePlannerService.js` (parked)
- **Utilities:** `attendanceDateUtils.js`, `attendanceStatusMeta.js`
- **Prior Doc Conflict Check:** [employee_attendance_board_optimization.md](./employee_attendance_board_optimization.md) (Aug 2026) was marked `Implemented` as its memoization/extraction work was already shipped.

### 1b. Security & Access (RBAC)
- Unchanged: `canAccessEmployeeAttendanceBoard`, `canCreate` / `canSuggestEdit`, `canUpdate` / `canApprove`, and Sphere of Influence scoping (`MANAGER_SENIORITY_THRESHOLD`) remain enforced identically across Desktop and Mobile.

---

## 2. Approved Plan (Sections A, B, C, D)

- **Section A (Completed):**
  - A.1: Desktop audit fixes (`shift_type` memo, `useMemo` maps, Android-8 IST dates, trimmed query, single employee fetch) + Phone inline control strip + 4 date presets.
  - A.2 / A.4 / A.5: Stripped complex bulk paintbrush planner / plan approval / My Plans UI (keeping external wiring + `// TODO(future-rebuild)` comments); replaced with `SingleEmployeeBulkUpdateModal` (1 person, multiple days).
  - A.3: Fixed `maker_note` / `suggested_leave_type` fetch, added missing status labels, live pending count badge, mobile `← Back` bar, stacked mobile cards, and partial-failure handling.
- **Section B (Data & Display):**
  - B.1: Phone Dual-Mode view — **By Day (Roll-Call)** default for managers (horizontal day strip + tappable status filter chips + employee cards with 1-tap edit or timeline drilldown) + **By Employee (Timeline)** toggle (default for restricted Viewers or after SearchBar selection).
  - B.2: Desktop Grid Today-column highlight + check-in/out hover tooltips.
  - B.3: Hide `AttendanceLegend` on Phone (keep on Desktop).
- **Section C (Navigation, Filters & Controls):**
  - C.1: Client-side **Hub Filter** on **Desktop only** (in expanded Menu).
  - C.2: Remove 50-employee pagination wall on Phone (use full `allEmployees` list); keep 50/page pagination on Desktop.
  - C.3: Add the 4 date presets (`This Week`, `Last 14 Days`, `Current Month`, `Last Month`) to **Desktop** as well as Phone.
- **Section D (Actions & Workflows):**
  - D.1: Upgrade `AttendanceSuggestEditModal` on Phone (`≤ 768px`) to a **bottom-anchored sheet** with **1-tap status chips** (Day, Night, Week-Off, Leave, Absent, No Show, NCNS).
  - D.2: Ensure `SingleEmployeeBulkUpdateModal` anchors cleanly as a bottom sheet on Phone.

---

## 3. Verification & Rollback
- Verify `npm run build` passes with zero errors.
- Verify Desktop (`> 1024px`), Medium (`769px–1024px`), and Phone (`360px–480px`) layouts.
- **Rollback:** Frontend-only change — fully reversible via `git revert` + Capacitor OTA push with zero data loss.
