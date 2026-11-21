# Phase 2 Runbook — Self-Service Week-Off & Consecutive Week-Off Escalation

**Goal:** Let employees self-resolve legitimate single Week-Offs in 1 tap when they log back in, while automatically escalating **consecutive Week-Off attempts** to the Task Board (Maker-Checker).
**Estimated Effort:** ~1.5 days
**Risk Level:** Low (non-blocking prompt on Current Attendance; consecutive attempts never auto-approve)

---

## 1. What Ships in Phase 2

1. **Migration 2 (Self-Service Week-Off RPC + Escalation Helpers):**
   - Reusable hierarchy helpers:
     - `fn_get_fallback_master_admin_employee()`
     - `fn_find_first_editor_in_hierarchy(p_start_employee_id uuid)` (cycle-safe recursive CTE, max depth 10)
   - `rpc_get_unmarked_previous_shift_day()` — computes the employee's **previous logical shift date** (respecting the 05:00 AM IST night-shift boundary) and returns whether it is `NULL` (unmarked) and whether `previous_day - 1` was already `week-off`.
   - `rpc_claim_yesterday_weekoff(p_target_date date)`:
     - **Case A — Normal (Non-Consecutive):** `p_target_date - 1` is NOT `week-off` → directly inserts `daily_attendances` (`attendance_status = 'week-off'`, `marked_by = auth.uid()`, `marked_source = 'self_weekoff'`). Returns `{ status: 'marked' }`.
     - **Case B — Consecutive Week-Off Detected:** `p_target_date - 1` IS already `week-off` → **blocks auto-save** and creates an idempotent Escalation Task on `public.tasks` (`metadata.type = 'CONSECUTIVE_WEEKOFF_ESCALATION'`) in `BACKLOG` assigned to the employee's direct reporting manager (or 1st `master_admin` with `⚠️ ORPHAN EMPLOYEE` at the top of description). Returns `{ status: 'escalated', task_id }`.
   - Maker-Checker RPCs (`submit` / `approve` / `reject`) shared with Phase 3 (5 non-present options: `Week-Off`, `Leave`, `Absent`, `No Show`, `No Call No Show` — `Present` excluded).
2. **Frontend — Current Attendance Prompt:**
   - Lightweight, dismissible banner/modal on `AttendanceSelfService.jsx` shown **once per missing day** when `yesterday` is `NULL`:
     > *"No attendance was recorded for [Yesterday, e.g., Thu 19 Nov]. Was that your Week-Off?"*
     > `[Yes, my Week-Off]` · `[No]`
   - Clicking **Yes**:
     - If normal → toast `"Week-Off recorded for [Date]"` and prompt disappears.
     - If consecutive → toast `"Consecutive Week-Off requires manager approval — sent to your manager."`
   - Clicking **No**: Stores dismissal for that date (no repeated nagging) and leaves the day unmarked for Phase 3.
3. **Frontend — Escalation Task UI (Mirroring Deactivate Employee):**
   - Modular `UnmarkedAttendanceActionPanel.jsx` mounted in task modal/history view so Reporting Managers and Editor+ Checkers can immediately resolve any consecutive Week-Off escalations.

---

## 2. Why This Gets Used Immediately
- ~80% of legitimate Week-Off `NULL` cells clear themselves automatically with zero manager involvement.
- Consecutive Week-Off abuse is immediately caught and routed through Maker-Checker on the Task Board.
- The exact same Task Board Maker-Checker UI built here is reused directly in Phase 3.

---

## 3. Exit Criteria (Before Starting Phase 3)
- [ ] Non-consecutive Week-Off auto-saves cleanly with `marked_by = employee` and `marked_source = 'self_weekoff'`.
- [ ] Consecutive Week-Off attempt is blocked from auto-saving and creates an Escalation Task routed to Reporting Manager → 1st upward `Editor+` (or `master_admin` with `⚠️ ORPHAN` top banner).
- [ ] Night-shift employees checking in at 01:00–04:59 AM IST are evaluated against the correct logical previous shift date.
- [ ] Verified on both Desktop (1440px) and Mobile Capacitor (375px).
