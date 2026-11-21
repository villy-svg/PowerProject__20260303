# Phase 3 Runbook — Unmarked Attendance Manager Tasks (1–2 Hub Pilot)

**Goal:** Catch **remaining true unmarked gaps** (employees who did not log in today, tapped "No" on the Phase 2 Week-Off prompt, or have multi-day absences) and route them through the Maker-Checker Task Board flow for **1–2 Pilot Hubs** via manual trigger.
**Estimated Effort:** ~1 day (reuses Phase 2 Maker-Checker RPCs and UI panel)
**Risk Level:** Low (scoped to pilot `p_hub_ids`; daily cron schedule stays OFF)

---

## 1. What Ships in Phase 3

1. **Migration 3 (`20261121192500_unmarked_attendance_generator.sql` — Generator RPC + Auto-Close Safeguard):**
   - Reuses `idx_tasks_attendance_closure_unique` (created in Phase 2) so an employee never gets both an escalation task and an unmarked task for the same day.
   - `rpc_generate_unmarked_attendance_tasks(p_target_date date DEFAULT NULL, p_hub_ids uuid[] DEFAULT NULL, p_dry_run boolean DEFAULT false)`:
     - Defaults `p_target_date` to **`logical_today - 2`** (full-cycle shift-agnostic cutoff: e.g., Wednesday 05:30 AM IST sweeps Monday, 30 min after Tuesday's 05:00 AM night-shift rollback closes, so Day, Evening, and Night shifts all get a full 24h window to answer the Phase 2 Week-Off prompt first).
     - Finds active employees (`doj <= target_date`) in `p_hub_ids` with **no** `daily_attendances` row and no existing task for `target_date`.
     - Assigns to direct reporting manager (`employees.manager_id`), or 1st active `master_admin` with `⚠️ ORPHAN EMPLOYEE` at the top of `tasks.description`.
   - `AFTER INSERT ON daily_attendances` auto-close trigger (`trg_auto_close_attendance_closure_tasks`): if attendance gets marked via Attendance Board (e.g., an approved `Present` edit request) or late self-Week-Off, automatically moves any open unmarked/escalation task for `(employee_id, shift_date)` to `COMPLETED` (`auto_resolved: true`) and rejects any lingering linked `pending` edit request.
2. **Manual-Only GitHub Actions Workflow (`.github/workflows/unmarked-attendance-cron.yml`, `workflow_dispatch` only):**
   - Accepts `environment` (`staging` / `production`), optional `target_date`, optional comma-separated `hub_ids`, and `dry_run` (default `true`).
   - Triggered manually after **05:30 AM IST** (30 min after the 05:00 AM night-shift cutoff closes for `T - 2`).

---

## 2. Pilot Execution Plan (3–5 Days)

1. Pick **1–2 Pilot Hubs** (10–25 active employees) with an active Reporting Manager and Editor+ Checker.
2. First run with `dry_run: true` to inspect eligible employees and orphan count; then trigger `workflow_dispatch` with `dry_run: false` each morning after **05:30 AM IST** for the Pilot Hub(s).
3. Validate the full Maker-Checker lifecycle:
   - Maker selects from the **5 non-present options** (`Week-Off`, `Leave`, `Absent`, `No Show`, `No Call No Show`).
   - Task moves to `REVIEW`, reassigned to **1st active Editor+** in the Maker's upward hierarchy (or `master_admin` with `⚠️ ORPHAN MANAGER` at top of description).
   - Checker **Approves** (writes `daily_attendances` with `marked_by` + `approved_by` + `marked_source = 'unmarked_task'`, moves to `COMPLETED`) or **Rejects** (returns to `BACKLOG` assigned to Maker with rejection note).

---

## 3. Exit Criteria (Before Starting Phase 4)
- [ ] 3–5 consecutive pilot days with zero duplicate tasks and zero RBAC/permission bugs.
- [ ] At least 1 Approval, 1 Rejection → Re-submission, and 1 Auto-Close (via Attendance Board) observed cleanly.
- [ ] Pilot Reporting Managers and Editor+ Checkers confirm low noise (because Phase 2 already cleared normal Week-Offs) and smooth Desktop + Mobile UX.
