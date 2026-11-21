# Attendance Closure & Week-Off Management — Implementation & Deployment Runbook

**Linked PRD/TRD:** [unmarked_attendance_manager_tasks.md](../features/unmarked_attendance_manager_tasks.md)
**Phased Rollout Folder:** [attendance-closure-phased-rollout/README.md](./attendance-closure-phased-rollout/README.md)
**Status:** Parked for Review (No code or migrations implemented yet)
**Last Updated:** 2026-11-20

---

## 1. Pre-Flight Checklist (Before Writing Code)

1. Confirm PRD/TRD status in `docs/features/unmarked_attendance_manager_tasks.md` is set to `Approved`.
2. Verify Staging & Production GitHub Actions secrets exist:
   - `SUPABASE_STAGING_URL` / `SUPABASE_STAGING_SERVICE_ROLE_KEY`
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
3. Verify at least one active `master_admin` exists in `user_profiles` with a non-null `employee_id` (used for orphan fallback).
4. Review mandatory skills before editing code: `production-safeguards`, `database-migration-policy`, `rbac-security-system`, `ui-design-system`, `development-best-practices`.

---

## 2. Stage-by-Stage Implementation Sequence

### Stage 1: Backend Attribution & Orphan Hygiene (Foundation)
Create Migration 1: `supabase/migrations/YYYYMMDDHHMMSS_attendance_attribution_columns.sql`
1. Add nullable columns to `public.daily_attendances`:
   - `marked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`
   - `approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`
   - `marked_source text` (`'self_checkin' | 'self_weekoff' | 'unmarked_task' | 'attendance_board' | 'edit_request' | 'schedule_plan'`)
2. Update `rpc_employee_checkin` (`marked_by = auth.uid()`, `marked_source = 'self_checkin'`) and `approve_attendance_edit_request` (`marked_by = requested_by`, `approved_by = auth.uid()`, `marked_source = 'edit_request'`).
3. `NOTIFY pgrst, 'reload schema';`
4. Run the read-only **Orphan Employee & Orphan Manager Audit** on Production and share with Ops/HR to fix broken `manager_id` chains.

---

### Stage 2: Self-Service Week-Off + Consecutive Week-Off Escalation
Create Migration 2: `supabase/migrations/YYYYMMDDHHMMSS_self_weekoff_and_escalation.sql`
1. **Shared Hierarchy Helpers:**
   - `fn_get_fallback_master_admin_employee()` — returns first active `master_admin` with linked `employee_id`.
   - `fn_find_first_editor_in_hierarchy(p_start_employee_id uuid)` — cycle-safe `WITH RECURSIVE` upward walk (`depth < 10`, `visited_ids uuid[]`) returning the 1st active `Editor+` on `EMPLOYEES`, or fallback `master_admin` with `is_orphan_manager = true`.
2. **Idempotency Index on `tasks`:**
   - `CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_attendance_closure_unique ON public.tasks ((metadata->>'employee_id'), (metadata->>'shift_date')) WHERE (metadata->>'type' IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE'));`
3. **Self-Service Week-Off RPCs (`SECURITY DEFINER`):**
   - `rpc_get_unmarked_previous_shift_day()` — computes the employee's logical previous shift date (respecting the 05:00 AM IST night-shift boundary), returning `{ target_date, is_unmarked, previous_day_was_weekoff }`.
   - `rpc_claim_yesterday_weekoff(p_target_date date)`:
     - **Non-consecutive (`target_date - 1` is NOT `week-off`):** Inserts `daily_attendances` with `attendance_status = 'week-off'`, `marked_by = auth.uid()`, `marked_source = 'self_weekoff'`. Returns `{ status: 'marked' }`.
     - **Consecutive (`target_date - 1` IS `week-off`):** Blocks auto-save and creates an idempotent Escalation Task (`metadata.type = 'CONSECUTIVE_WEEKOFF_ESCALATION'`) in `BACKLOG` assigned to the direct reporting manager (or `master_admin` with `⚠️ ORPHAN EMPLOYEE` at the top of `tasks.description`). Returns `{ status: 'escalated', task_id }`.
4. **Shared Maker-Checker RPCs (`SECURITY DEFINER`):**
   - `rpc_submit_attendance_task_choice(p_task_id, p_status, p_note)` — hard-blocks `'present'`; creates linked `attendance_edit_requests` row; routes to 1st upward `Editor+` (or `master_admin` with `⚠️ ORPHAN MANAGER` at top of description); moves task to `REVIEW`.
   - `rpc_approve_attendance_task(p_task_id, p_review_note)` — guards against overwriting an existing `present` row; writes `daily_attendances` (`marked_by = Maker`, `approved_by = Checker`, `marked_source = 'unmarked_task'`); moves task to `COMPLETED`.
   - `rpc_reject_attendance_task(p_task_id, p_review_note)` — marks edit request `'rejected'`; returns task to `BACKLOG` assigned to Maker with rejection note.
5. **Frontend — Current Attendance Week-Off Prompt:**
   - Add service calls in `src/services/employees/attendanceService.js` (`getUnmarkedPreviousShiftDay`, `claimYesterdayWeekOff`).
   - Add dismissible prompt card in `src/verticals/Employees/attendance/AttendanceSelfService.jsx` (and `useAttendanceSelfService.js`) shown once per unmarked previous shift day: *"No attendance recorded for [Yesterday]. Was that your Week-Off?"* (`[Yes, my Week-Off]` / `[No]`).
6. **Frontend — Shared Maker-Checker Task UI (Mirroring Deactivate Employee):**
   - `src/services/employees/unmarkedAttendanceTaskService.js`
   - `src/components/tasks/UnmarkedAttendanceActionPanel.jsx` + `.css` (zero inline styles, ≥44px touch targets, `inFlightRef` double-tap guard)
   - Wire `"Mark Attendance"` (Maker) and `"Review Attendance"` (Checker) buttons into `TaskCard.jsx`, `ListViewRow.jsx`, `TaskTreeView.jsx`, `CentralisedTaskBoard.jsx`, `WorkspaceModals.jsx`, and `SubmissionHistory.jsx`.

---

### Stage 3: Unmarked Attendance Manager Tasks (Pilot Hub — Manual Trigger)
Create Migration 3: `supabase/migrations/YYYYMMDDHHMMSS_unmarked_attendance_generator.sql`
1. `rpc_generate_unmarked_attendance_tasks(p_target_date date DEFAULT ..., p_hub_ids uuid[] DEFAULT NULL)` — finds active employees (`doj <= target_date`) in `p_hub_ids` with no `daily_attendances` row and no existing `CONSECUTIVE_WEEKOFF_ESCALATION` / `UNMARKED_ATTENDANCE` task for `yesterday`, and creates `UNMARKED_ATTENDANCE` tasks in `BACKLOG` assigned to direct reporting manager (or `master_admin` with `⚠️ ORPHAN EMPLOYEE` at top of description).
2. `AFTER INSERT ON public.daily_attendances` auto-close trigger — if attendance is marked via Attendance Board (e.g., approved `Present` edit request) or late self-Week-Off, automatically moves any open task for `(employee_id, shift_date)` to `COMPLETED` (`auto_resolved: true`).
3. Create `.github/workflows/unmarked-attendance-cron.yml` in **manual-only (`workflow_dispatch`) mode** with `target_date` and `hub_ids` inputs. Run manually at ~12:00 PM IST for **1–2 Pilot Hubs** for 3–5 days.

---

### Stage 4: Automated Daily Cron (3-Wave Org Rollout)
1. Enable `schedule:` (`cron: '30 6 * * *'` UTC = **12:00 PM IST**, safely after morning day-shift logins & Stage 2 Week-Off prompts) in `.github/workflows/unmarked-attendance-cron.yml`.
2. Expand `p_hub_ids` in 3 waves: **Wave 1 (~25% hubs)** → **Wave 2 (~60% hubs)** → **Wave 3 (100% org, `p_hub_ids = null`)**.

---

### Stage 5: End-State Governance & Usage-Driven Polish
1. Display `Marked by / Approved by / Source` tooltip on Attendance Board cells.
2. Verify Schedule Planner (`employee_schedule_plans`) pre-planned Week-Offs/Leaves cleanly bypass both Stage 2 prompts and Stage 3/4 tasks.
3. Optional: >48h overdue badge / `send-push` reminder or manager bulk-mark view (only if Stage 4 usage shows need).

---

## 3. Rollback & Reversibility
- **Stop Unmarked Tasks:** Disable `.github/workflows/unmarked-attendance-cron.yml` in GitHub Actions (1 click).
- **Disable Week-Off Prompt / Task UI:** Revert frontend commit + push Capacitor OTA (all existing tasks remain safely readable).
- **Database:** All migrations are additive and repair-safe — zero data loss on rollback.
