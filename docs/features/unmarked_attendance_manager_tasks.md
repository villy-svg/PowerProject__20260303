# Unmarked Attendance Manager Tasks (Maker-Checker) — PRD & TRD

**Status:** `In Review`
**Date Created:** 2026-11-20
**Last Updated:** 2026-11-20
**Author / AI Session:** Antigravity session, Nov 2026

---

## Changelog

| Date | Status Change | Summary of Change |
|---|---|---|
| 2026-11-20 | Draft | Initial PRD/TRD created with open options for direct save vs. maker-checker, SM1+ routing, and UI styles. |
| 2026-11-20 | In Review | Incorporated all user decisions: Maker-Checker workflow (Reporting Manager → 1st Editor+ in manager's hierarchy), exclude `Present`, mirror Deactivate Employee task UX, and Master Admin fallback with top-of-description orphan notice. |

---

## 0. Context & Objectives

### 0a. Core Objective
When an active employee has no attendance record (`NULL` / "Not Marked") for the previous day, those gaps currently go unnoticed until manual audits. We want to automatically create an actionable **Maker-Checker** task on the **reporting manager's Task Board** the next morning so they can select the appropriate non-present attendance status, which then routes for approval to the **1st Editor-or-above in that manager's reporting hierarchy** — with full backend attribution of both Maker and Checker.

### 0b. Success Metrics
- **Metric 1 (Zero silent gaps):** 100% of active employees with no `daily_attendances` row for `yesterday` (IST) by the morning cutoff generate exactly one idempotent task assigned to their direct reporting manager (or Master Admin with an orphan warning if no manager exists).
- **Metric 2 (Enforced Maker-Checker):** Every attendance mark submitted via this task goes through a two-step workflow (Reporting Manager selects status → 1st Editor+ in their upward hierarchy approves/rejects) using the exact same Review modal/history UX as the existing **Deactivate Employee** task.
- **Metric 3 (Complete audit trail):** 100% of resolved records persist `marked_by` (Maker), `approved_by` (Checker), and `marked_source = 'unmarked_task'` directly on `daily_attendances` (plus linked `attendance_edit_requests` and `tasks_history`).

### 0c. Out of Scope
- ❌ Marking `Present` from this task (explicitly excluded; `Present` without GPS/timestamps must go through standard Attendance Board edit requests).
- ❌ Employee self-service Week-Off buttons or prompts.
- ❌ Automatic leave-wallet balance deduction on `leave` marking (handled separately if/when integrated).
- ❌ Backfilling historical unmarked attendance older than `yesterday` (only `CURRENT_DATE - 1` IST runs daily).
- ❌ Push/WhatsApp notifications (can be layered on later via `send-push`).

---

## 1. Current State & Dependencies

### 1a. Technical Dependencies

| Type | Name | Path |
|---|---|---|
| Component | `TaskCard` | `src/components/tasks/TaskCard.jsx` |
| Component | `ListViewRow` | `src/components/tasks/ListViewRow.jsx` |
| Component | `TaskTreeView` | `src/components/tasks/TaskTreeView.jsx` |
| Component | `CentralisedTaskBoard` | `src/components/tasks/CentralisedTaskBoard.jsx` |
| Component | `SubmissionHistory` | `src/components/tasks/SubmissionHistory.jsx` |
| Component | `WorkspaceModals` | `src/components/modals/WorkspaceModals.jsx` |
| Service | `employeeRequestService` | `src/services/employees/employeeRequestService.js` *(reference pattern for `EMPLOYEE_DEACTIVATION`)* |
| Service | `attendanceService` | `src/services/employees/attendanceService.js` |
| Service | `editRequestService` | `src/services/employees/editRequestService.js` |
| Utility | `attendanceStatusMeta` | `src/verticals/Employees/attendance/utils/attendanceStatusMeta.js` |
| Workflow | Daily cron pattern | `.github/workflows/task-backup-cron.yml` |
| Migration | Attendance schema & RLS | `supabase/migrations/20260611000000_attendance_tables.sql`, `20260611000001_attendance_rls.sql`, `20260810000000_attendance_v2.sql` |

**Conflict Detection:** Scanned `docs/features/README.md` — all 8 existing features are `Implemented`; no `Draft`, `In Review`, or `Approved` conflicts exist.

### 1b. Product Dependencies (Current User Flow)
- Today, unmarked attendance stays `NULL` on the Attendance Board with no proactive task or alert.
- PowerProject already has a proven task-based approval pattern for `EMPLOYEE_DEACTIVATION` (`employeeRequestService.js` + `TaskCard.jsx` + `ListViewRow.jsx` + `TaskTreeView.jsx` + `CentralisedTaskBoard.jsx` + `WorkspaceModals.jsx` + `SubmissionHistory.jsx`), where:
  - Cards show a clean human-readable summary (never raw JSON).
  - Reviewers see a **"Review Request"** button that opens the task modal/history drawer with **Approve** and **Reject** actions backed by `SECURITY DEFINER` RPCs.

### 1c. Logical Dependencies (Confirmed Business Rules)
1. **Trigger Condition:** Runs daily at **08:30 AM IST** (`0 3 * * *` UTC) — safely after the **05:00 AM IST** night-shift rollback boundary in `rpc_employee_checkin`. Evaluates all `employees` where `status = 'Active'` and `(doj IS NULL OR doj <= yesterday_ist)` who have **no row** in `daily_attendances` for `yesterday_ist`.
2. **Step 1 Assignee (Maker):** The employee's **direct reporting manager** (`employees.manager_id`, provided that manager is active).
   - **Orphan Employee Fallback:** If `manager_id IS NULL` or the manager is inactive/missing, assign to the **1st `master_admin`** (or any active `master_admin` with a linked `employee_id`), and prepend at the very top of the task description:
     `⚠️ ORPHAN EMPLOYEE: This employee has no active reporting manager assigned in the system.`
3. **Allowed Status Options (Excluding `Present`):**
   - `week-off` (Week-Off)
   - `leave` (Leave)
   - `absent` (Absent)
   - `no-show` (No Show)
   - `no-call-no-show` (No Call No Show)
   *(Optional maker note field supported.)*
4. **Step 2 Assignee (Checker — 1st Editor+ Upward):** When the Maker submits a status, walk **up** `employees.manager_id` starting from the **submitting manager** (cycle-safe `WITH RECURSIVE` CTE, max depth 10) and select the **1st active ancestor** whose linked `user_profiles` has `EMPLOYEES` permission level `'editor'` or `'admin'` (including `master_editor` / `master_admin`).
   - **Orphan Manager Fallback:** If no Editor+ exists in the submitting manager's upward hierarchy, assign to the **1st `master_admin`** (or any active `master_admin`), and prepend at the very top of the task description:
     `⚠️ ORPHAN MANAGER: Submitting manager [Name] has no Editor or above in their reporting hierarchy.`
   - *(Note: If the Maker was already a `master_admin` via the orphan-employee fallback, route to another `master_admin` if one exists, or self-reviewable by `master_admin` so the task never deadlocks.)*
5. **Checker Decision:**
   - **Approve:** Atomically writes `daily_attendances` (guarding against overwriting an existing `present` record), sets `marked_by` (Maker), `approved_by` (Checker), `marked_source = 'unmarked_task'`, marks the linked `attendance_edit_requests` row `'approved'`, and moves the task to `COMPLETED`.
   - **Reject:** Marks `attendance_edit_requests` as `'rejected'` with optional review note, leaves `daily_attendances` untouched, and moves the task back to `BACKLOG` reassigned to the Reporting Manager (with the rejection reason shown) so they can re-select the correct status — or `DEPRIORITIZED` if permanently dismissed.

### 1d. Data & State Dependencies

| Table | Columns Used / Added | Purpose |
|---|---|---|
| `daily_attendances` | *(NEW)* `marked_by uuid REFERENCES user_profiles(id)`, *(NEW)* `approved_by uuid REFERENCES user_profiles(id)`, *(NEW)* `marked_source text` | Permanent backend attribution of who marked and who approved every attendance row. |
| `attendance_edit_requests` | Existing `requested_by`, `reviewed_by`, `suggested_status`, `maker_note`, `review_note`, `request_status` | Stays synced with Attendance Board's Maker-Checker audit trail. |
| `tasks` | `id`, `text`, `description`, `vertical_id = 'EMPLOYEES'`, `task_board = '["Employees"]'`, `stage_id`, `assigned_to`, `hub_id`, `metadata`, `last_updated_by` | Holds the actionable task lifecycle (`BACKLOG` → `REVIEW` → `COMPLETED`). |
| `employees` | `id`, `full_name`, `emp_code`, `status`, `manager_id`, `hub_id`, `doj` | Source of active employees and upward `manager_id` hierarchy. |
| `user_profiles` | `id`, `employee_id`, `role_id`, `is_active` + vertical permissions via `get_user_permission_level` | Resolves who is `editor`/`admin` on `EMPLOYEES` and who is `master_admin`. |

**Structured `tasks.metadata` Payload:**
```json
{
  "type": "UNMARKED_ATTENDANCE",
  "employee_id": "<uuid>",
  "employee_name": "Ravi Kumar",
  "emp_code": "PP-042",
  "hub_name": "Whitefield Hub",
  "shift_date": "2026-11-19",
  "is_orphan_employee": false,
  "is_orphan_manager": false,
  "maker_employee_id": "<uuid>",
  "maker_user_id": "<uuid|null>",
  "maker_name": "<string|null>",
  "suggested_status": null,
  "maker_note": null,
  "submitted_at": null,
  "edit_request_id": "<uuid|null>",
  "checker_employee_id": "<uuid|null>",
  "checker_user_id": "<uuid|null>",
  "reviewed_at": null,
  "review_note": null
}
```
*(Unlike `EMPLOYEE_DEACTIVATION` which stored JSON inside `tasks.description`, we keep `tasks.description` as **clean human-readable prose** — with the `⚠️ ORPHAN ...` warning right at the top when applicable — and store the structured machine payload cleanly in `tasks.metadata` JSONB.)*

### 1e. Security & Access (RBAC)
- **Cron Generation (`rpc_generate_unmarked_attendance_tasks`):** Executed only by `service_role` (GitHub Actions workflow).
- **Maker Submission (`rpc_submit_unmarked_attendance_choice`):** `SECURITY DEFINER`. Verifies `auth.uid()` maps to the task's current `assigned_to` (or is `master_admin` / `EMPLOYEES` `admin`). Allows reporting managers who are `viewer`/`contributor` on `EMPLOYEES` to submit their reportee's status safely without needing global `EMPLOYEES` edit rights.
- **Checker Review (`rpc_approve_unmarked_attendance_task` & `rpc_reject_unmarked_attendance_task`):** `SECURITY DEFINER`. Verifies `auth.uid()` is the assigned Checker (`assigned_to`) OR an `EMPLOYEES` `editor`/`admin` (`master_admin` / `master_editor`), and prevents self-approval unless the Maker is a `master_admin` handling an orphan fallback.
- **Task Board Visibility:** Because `tasks.assigned_to` is set to the active owner's `employees.id` at each stage (Maker in `BACKLOG`, Checker in `REVIEW`), both see the task automatically in **Centralised Task Board ("My Tasks")** and **Employees Task Board** without violating Sphere of Influence.

---

## 2. Final Approved Architecture & UX Plan

### 2a. Backend Components (1 Migration + 1 Cron Workflow)
1. **Migration (`YYYYMMDDHHMMSS_unmarked_attendance_tasks.sql`):**
   - **Audit columns on `daily_attendances`:** `ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`, `approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`, `marked_source text`.
   - **Idempotency index on `tasks`:** Partial unique index on `((metadata->>'employee_id'), (metadata->>'shift_date')) WHERE metadata->>'type' = 'UNMARKED_ATTENDANCE'`.
   - **Helper SQL function `fn_find_first_editor_in_hierarchy(p_start_employee_id uuid)`:** Cycle-safe recursive CTE walking up `employees.manager_id`, returning the first active ancestor whose `user_profiles` has `EMPLOYEES` level `'editor'` or `'admin'` (or `master_editor`/`master_admin`), plus a flag `is_orphan_manager boolean` if it fell back to `master_admin`.
   - **Helper SQL function `fn_get_fallback_master_admin_employee()`:** Returns the first active `master_admin` with a linked `employee_id` (ordered deterministically).
   - **RPC 1 — `rpc_generate_unmarked_attendance_tasks(p_target_date date DEFAULT ...)`:** Finds unmarked active employees for `yesterday` (IST), resolves reporting manager (or Master Admin + orphan banner), inserts idempotent tasks in `BACKLOG`.
   - **RPC 2 — `rpc_submit_unmarked_attendance_choice(p_task_id uuid, p_status attendance_status_enum, p_note text DEFAULT NULL)`:** Rejects `'present'`, creates linked `attendance_edit_requests` row (`requested_by = auth.uid()`), resolves Checker via `fn_find_first_editor_in_hierarchy`, prepends orphan-manager banner to `description` if fallback triggered, reassigns `assigned_to` to Checker, moves `stage_id` to `'REVIEW'`, updates `metadata`.
   - **RPC 3 — `rpc_approve_unmarked_attendance_task(p_task_id uuid, p_review_note text DEFAULT NULL)`:** Guards against overwriting an existing `present` row, inserts `daily_attendances` with `marked_by = maker_user_id`, `approved_by = auth.uid()`, `marked_source = 'unmarked_task'`, approves linked `attendance_edit_requests`, moves task to `'COMPLETED'`.
   - **RPC 4 — `rpc_reject_unmarked_attendance_task(p_task_id uuid, p_review_note text DEFAULT NULL)`:** Marks `attendance_edit_requests` `'rejected'`, appends rejection reason to description/metadata, moves task back to `'BACKLOG'` reassigned to the Reporting Manager for re-submission.
   - **Auto-close trigger on `daily_attendances` (`AFTER INSERT`):** If attendance for `(employee_id, shift_date)` gets marked directly on the Attendance Board while an `UNMARKED_ATTENDANCE` task is still open (`BACKLOG`/`REVIEW`), auto-moves the task to `'COMPLETED'` with `metadata.auto_resolved = true`.
   - **Audit backfill hook:** Update `rpc_employee_checkin` (`marked_by = auth.uid()`, `marked_source = 'self_checkin'`) and `approve_attendance_edit_request` (`marked_by = requested_by`, `approved_by = auth.uid()`, `marked_source = 'edit_request'`) so all new attendance writes share the same audit columns.
2. **GitHub Actions Cron (`.github/workflows/unmarked-attendance-cron.yml`):**
   - Runs daily at `0 3 * * *` UTC (**08:30 AM IST**) + `workflow_dispatch` for manual testing, targeting both Staging and Production (mirroring `task-backup-cron.yml`).

### 2b. Frontend Components (Mirroring Deactivate Employee UX)
1. **New Service (`src/services/employees/unmarkedAttendanceTaskService.js`):**
   - `isUnmarkedAttendanceTask(task)`
   - `canMarkUnmarkedAttendance(task, user)` (assigned Maker in `BACKLOG`, or admin)
   - `canReviewUnmarkedAttendance(task, user)` (assigned Checker in `REVIEW`, or `EMPLOYEES` editor/admin)
   - `UNMARKED_ATTENDANCE_OPTIONS` (the 5 statuses excluding `present`)
   - Wrappers for `submitUnmarkedAttendanceChoice`, `approveUnmarkedAttendanceTask`, `rejectUnmarkedAttendanceTask`.
2. **Task Board Entry Points (`TaskCard.jsx`, `ListViewRow.jsx`, `TaskTreeView.jsx`, `CentralisedTaskBoard.jsx`, `WorkspaceModals.jsx`):**
   - In `BACKLOG` (for Maker): Shows a **"Mark Attendance"** button on the card/row (same placement/styling as `"Review Request"` on Deactivate Employee tasks).
   - In `REVIEW` (for Checker): Shows a **"Review Attendance"** button (exact same placement/styling as `"Review Request"` on Deactivate Employee tasks).
   - Clicking opens the task modal (`SubmissionHistory.jsx` / dedicated `UnmarkedAttendanceActionPanel.jsx` rendered inside the task detail/history view — modularized per `development-best-practices §4`).
3. **Interactive Panel (`UnmarkedAttendanceActionPanel.jsx`):**
   - **Orphan Banner (if `is_orphan_employee` or `is_orphan_manager`):** Highlighted warning alert at the top matching the description notice.
   - **Maker View (`stage_id === 'BACKLOG'`):** Shows employee name, code, hub, unmarked date, a `CustomSelect` (5 options, no `Present`), optional note input, and **"Submit for Approval"** button.
   - **Checker View (`stage_id === 'REVIEW'`):** Shows employee details, Maker's name & chosen status, optional review note, and **"Approve"** + **"Reject"** buttons (identical styling & double-tap `inFlightRef` guard as `approveDeactivationRequest` / `rejectEmployeeRequest`).
   - **Completed View (`stage_id === 'COMPLETED'`):** Read-only summary showing final status, Maker name, Checker name, and timestamp.
   - **Mobile (<1024px) & Desktop (≥1024px):** Touch targets ≥ 44px, zero inline styles, vanilla CSS tokens per `ui-design-system`.

### 2c. Rollout & Backward Compatibility
- **Staging first:** Deploy migration to Staging, trigger `.github/workflows/unmarked-attendance-cron.yml` manually via `workflow_dispatch`, verify Maker + Checker + Orphan flows before Production.
- **Capacitor OTA safe:** Older mobile bundles render `tasks.description` cleanly as readable text (including the orphan warning) without crashing; updated bundles unlock the interactive Maker/Checker buttons.

---

## 3. Risks, Mitigation & Verification

### 3a. Technical Risks
- **Hierarchy cycles in `employees.manager_id`:** Prevented via `visited_ids uuid[]` array check + `depth < 10` in the recursive CTE.
- **Duplicate tasks on cron re-run:** Prevented via partial unique index on `tasks ((metadata->>'employee_id'), (metadata->>'shift_date')) WHERE metadata->>'type' = 'UNMARKED_ATTENDANCE'`.
- **Race condition (attendance marked on board before task resolved):** Handled by both the `AFTER INSERT` auto-close trigger on `daily_attendances` and an explicit existence check inside `rpc_approve_unmarked_attendance_task`.

### 3b. Logical & Edge-Case Risks
- **Night-shift check-ins before 05:00 AM IST:** Cron runs at 08:30 AM IST, well after the 05:00 AM rollback cutoff.
- **No `master_admin` with a linked `employee_id`:** `fn_get_fallback_master_admin_employee()` checks `user_profiles WHERE role_id = 'master_admin' AND is_active = true AND employee_id IS NOT NULL`; if none exists, `assigned_to` is left `NULL` while `CentralisedTaskBoard` still surfaces `UNMARKED_ATTENDANCE` orphan tasks to all `master_admin` users (exact same visibility fallback used by `isEmployeeApprovalTask`).
- **Rejection loop:** When a Checker rejects, task returns to `BACKLOG` assigned back to the Maker with the rejection note visible so the missing attendance still gets resolved rather than disappearing silently.

### 3c. Verification Checklist (Pre-Production)
- `[ ]` **TEST 1 — Maker Assignment:** Active employee with unmarked yesterday → task created in `BACKLOG` assigned to direct reporting manager.
- `[ ]` **TEST 2 — Orphan Employee:** Active employee with `manager_id = NULL` → task assigned to 1st `master_admin` with `⚠️ ORPHAN EMPLOYEE` at top of description.
- `[ ]` **TEST 3 — Present Excluded:** Verify `Present` is neither shown in UI options nor accepted by `rpc_submit_unmarked_attendance_choice` (DB-level guard).
- `[ ]` **TEST 4 — Checker Hierarchy Resolution:** Reporting manager (Contributor) submits `Week-Off` → task moves to `REVIEW` and reassigns to 1st upward `Editor`/`Admin` on `EMPLOYEES`.
- `[ ]` **TEST 5 — Orphan Manager:** Reporting manager has no upward `Editor+` → task routes to 1st `master_admin` with `⚠️ ORPHAN MANAGER` prepended at top of description.
- `[ ]` **TEST 6 — Approval & Backend Audit:** Checker approves → `daily_attendances` row inserted with `marked_by = Maker`, `approved_by = Checker`, `marked_source = 'unmarked_task'`; linked `attendance_edit_requests` marked `'approved'`; task moves to `COMPLETED`.
- `[ ]` **TEST 7 — Rejection:** Checker rejects with note → `daily_attendances` untouched, task returns to `BACKLOG` assigned to Reporting Manager with rejection reason shown.
- `[ ]` **TEST 8 — Cron Idempotency & Night Shift:** Re-running cron creates 0 duplicates; night-shift worker checked in at 02:30 AM IST gets 0 tasks.
- `[ ]` **TEST 9 — Responsive & RBAC:** Verified on 1440px Desktop & 375px Mobile; unauthorized users cannot submit or approve via UI or direct RPC call.

### 3d. Rollback & Reversibility
- **Reversible without data loss?** **Yes.** Disable the GitHub Actions cron workflow to stop new tasks; additive columns (`marked_by`, `approved_by`, `marked_source`) and RPCs are non-breaking; frontend commit can be reverted via Capacitor OTA.
