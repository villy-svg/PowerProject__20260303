# Phase 3 Runbook — Unmarked Attendance Manager Tasks (1–2 Hub Pilot)

**Goal:** Catch **remaining true unmarked gaps** (employees who did not log in today, tapped "No" on the Phase 2 Week-Off prompt, or have multi-day absences) and route them through the Maker-Checker Task Board flow for **1–2 Pilot Hubs** via manual trigger.
**Estimated Effort:** ~1 day (reuses Phase 2 Maker-Checker RPCs and UI panel)
**Risk Level:** Low (scoped to pilot `p_hub_ids`; daily cron schedule stays OFF)

---

## 1. What Ships in Phase 3

1. **Migration 3 (Generator RPC + Auto-Close Safeguard):**
   - Partial unique index on `tasks ((metadata->>'employee_id'), (metadata->>'shift_date')) WHERE metadata->>'type' IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')` so an employee never gets both an escalation task and an unmarked task for the same day.
   - `rpc_generate_unmarked_attendance_tasks(p_target_date date DEFAULT ..., p_hub_ids uuid[] DEFAULT NULL)`:
     - Finds active employees (`doj <= target_date`) in `p_hub_ids` with **no** `daily_attendances` row for `yesterday` (IST) and no existing task for that date.
     - Assigns to direct reporting manager (`employees.manager_id`), or 1st active `master_admin` with `⚠️ ORPHAN EMPLOYEE` at the top of `tasks.description`.
   - `AFTER INSERT ON daily_attendances` auto-close trigger: if attendance gets marked via Attendance Board (e.g., an approved `Present` edit request) or late self-Week-Off, automatically moves any open unmarked task for `(employee_id, shift_date)` to `COMPLETED` (`auto_resolved: true`).
2. **Manual-Only GitHub Actions Workflow (`workflow_dispatch` only):**
   - Accepts `target_date` and `hub_ids` inputs.
   - Triggered manually around **11:30 AM – 12:00 PM IST** (giving returning day-shift employees time to answer the Phase 2 Week-Off prompt first).

---

## 2. Pilot Execution Plan (3–5 Days)

1. Pick **1–2 Pilot Hubs** (10–25 active employees) with an active Reporting Manager and Editor+ Checker.
2. Trigger `workflow_dispatch` each day at ~12:00 PM IST for the Pilot Hub(s).
3. Validate the full Maker-Checker lifecycle:
   - Maker selects from the **5 non-present options** (`Week-Off`, `Leave`, `Absent`, `No Show`, `No Call No Show`).
   - Task moves to `REVIEW`, reassigned to **1st active Editor+** in the Maker's upward hierarchy (or `master_admin` with `⚠️ ORPHAN MANAGER` at top of description).
   - Checker **Approves** (writes `daily_attendances` with `marked_by` + `approved_by` + `marked_source = 'unmarked_task'`, moves to `COMPLETED`) or **Rejects** (returns to `BACKLOG` assigned to Maker with rejection note).

---

## 3. Exit Criteria (Before Starting Phase 4)
- [ ] 3–5 consecutive pilot days with zero duplicate tasks and zero RBAC/permission bugs.
- [ ] At least 1 Approval, 1 Rejection → Re-submission, and 1 Auto-Close (via Attendance Board) observed cleanly.
- [ ] Pilot Reporting Managers and Editor+ Checkers confirm low noise (because Phase 2 already cleared normal Week-Offs) and smooth Desktop + Mobile UX.
