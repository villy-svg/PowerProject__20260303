# Attendance Closure & Week-Off Management — Day-2 Operations & Troubleshooting Runbook

**Linked PRD/TRD:** [unmarked_attendance_manager_tasks.md](../features/unmarked_attendance_manager_tasks.md)
**Phased Rollout Folder:** [attendance-closure-phased-rollout/README.md](./attendance-closure-phased-rollout/README.md)
**Audience:** Ops Leads, Master Admins, On-Call Developers
**Last Updated:** 2026-11-20

---

## 1. Daily Operational Timeline (End State)

| Time (IST) | Event | Owner |
|---|---|---|
| **05:00 AM** | Night-shift rollback cutoff closes for the previous logical shift day (`T - 1`) | `rpc_employee_checkin` |
| **06:00 AM – 04:59 AM (+1d)** | Returning Day, Evening, and Night shift employees open Current Attendance → see *"Was yesterday (`T - 1`) your Week-Off?"* prompt. Non-consecutive WO auto-saves (`self_weekoff`); **consecutive WO** escalates to Task Board | Employees (Self-Service) |
| **09:00 AM** | Automated cron runs `rpc_generate_unmarked_attendance_tasks` for **`T - 2`** (e.g., Wednesday 09:00 AM sweeps Monday, after all Tuesday Day/Evening/Night shifts closed at 05:00 AM). Sends at most **1 consolidated summary push** per manager | GitHub Actions (`unmarked-attendance-cron.yml`) |
| **09:05 AM+** | Reporting Managers open a clean morning `BACKLOG` (Unmarked Attendance for `T - 2` + any Consecutive WO Escalations) and pick from 5 non-present options | Reporting Managers (Maker) |
| **Same Day** | Submitted choices move to `REVIEW` for 1st upward `Editor+` Manager | Editor+ Managers (Checker) |
| **On Approval** | `daily_attendances` written with `marked_by` + `approved_by` + `marked_source`, task moves to `COMPLETED` | System (Atomic RPC) |

---

## 2. Common Operational Playbooks

### Scenario A: Employee Accidentally Tapped "No" on the Week-Off Prompt
- **What happens:** The prompt won't nag them again for that date, and the day stays `NULL`.
- **Resolution:** At 12:00 PM IST, the unmarked attendance task is created for their Reporting Manager, who selects `Week-Off` and sends it to their Editor+ for approval — no manual intervention needed.

### Scenario B: Employee Marked Consecutive Days as Week-Off
- **What happens:** `rpc_claim_yesterday_weekoff` detects `yesterday - 1` is already `week-off`, **blocks** auto-save, and creates a `CONSECUTIVE_WEEKOFF_ESCALATION` task on the Reporting Manager's Task Board.
- **Resolution:** Reporting Manager verifies whether it's a legitimate swap/rest day or an absence, picks one of the 5 non-present options, and submits to their 1st upward `Editor+` for approval.

### Scenario C: Cron Failed or Missed a Run
1. Open **GitHub → Actions → Unmarked Attendance Cron**.
2. Inspect the error log and click **Run workflow** (`workflow_dispatch`), optionally passing `target_date` (e.g., `2026-11-19`) and `hub_ids`.
3. Safe to re-run — the partial unique index prevents duplicate tasks.

### Scenario D: Master Admin Receives `⚠️ ORPHAN EMPLOYEE` or `⚠️ ORPHAN MANAGER` Tasks
- **What it means:**
  - `⚠️ ORPHAN EMPLOYEE`: Employee has `manager_id = NULL` or points to an inactive employee.
  - `⚠️ ORPHAN MANAGER`: Submitting manager has no active `Editor` or `Admin` anywhere above them in `employees.manager_id`.
- **Action:**
  1. Resolve the attendance task so payroll isn't blocked.
  2. Assign a valid active `manager_id` in **Employee Management** so future runs route cleanly.

### Scenario E: Manager Claims "Employee Was Actually Present"
- `Present` is intentionally excluded from all unmarked/escalation task options.
- **Action:** Submit a standard **Attendance Edit Request** on the **Attendance Board** with shift type and login/logout times. Once approved, the `AFTER INSERT` auto-close trigger automatically moves the open task to `COMPLETED`.

### Scenario F: Checker Rejected a Manager's Submission
- **What happens:** `daily_attendances` stays untouched, the linked edit request is marked `'rejected'`, and the task returns to `BACKLOG` reassigned to the Reporting Manager with the rejection note so they can re-submit.

---

## 3. Useful Backend Audit Queries (Read-Only SQL)

### Audit Who Marked & Approved Attendance (Including Self Week-Offs)
```sql
SELECT
  da.shift_date,
  e.emp_code,
  e.full_name AS employee_name,
  da.attendance_status,
  da.marked_source,
  maker.name   AS marked_by_name,
  checker.name AS approved_by_name,
  da.updated_at
FROM public.daily_attendances da
JOIN public.employees e ON e.id = da.employee_id
LEFT JOIN public.user_profiles maker   ON maker.id = da.marked_by
LEFT JOIN public.user_profiles checker ON checker.id = da.approved_by
WHERE da.shift_date = '2026-11-19'
ORDER BY da.marked_source, e.full_name;
```

### Find All Open Unmarked Attendance & Consecutive Week-Off Escalation Tasks
```sql
SELECT
  t.id,
  t.metadata->>'type'               AS task_type,
  t.stage_id,
  t.metadata->>'employee_name'      AS employee_name,
  t.metadata->>'shift_date'         AS shift_date,
  t.metadata->>'suggested_status'   AS suggested_status,
  t.metadata->>'is_orphan_employee' AS orphan_emp,
  t.metadata->>'is_orphan_manager'  AS orphan_mgr,
  assignee.full_name                AS currently_assigned_to,
  t.created_at
FROM public.tasks t
LEFT JOIN public.employees assignee ON assignee.id = t.assigned_to
WHERE t.metadata->>'type' IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
  AND t.stage_id IN ('BACKLOG', 'REVIEW')
ORDER BY t.created_at DESC;
```

### Find All Orphan Employees (Proactive Hierarchy Cleanup)
```sql
SELECT e.id, e.emp_code, e.full_name, e.manager_id
FROM public.employees e
LEFT JOIN public.employees m ON m.id = e.manager_id AND m.status = 'Active'
WHERE e.status = 'Active'
  AND m.id IS NULL
ORDER BY e.full_name;
```

---

## 4. Troubleshooting Quick Reference

| Symptom | Likely Cause | Fix |
|---|---|---|
| Employee didn't see Week-Off prompt | Yesterday already has a row (e.g., Schedule Planner or Check-In), or they already dismissed it today, or night shift hasn't crossed 05:00 AM IST | Check `daily_attendances` for the employee's logical previous shift date |
| Employee's Week-Off didn't auto-save | `yesterday - 1` was already `week-off` (consecutive WO guardrail) | Expected — check the generated `CONSECUTIVE_WEEKOFF_ESCALATION` task on their manager's board |
| Manager cannot click "Submit for Approval" | Manager's `user_profiles.employee_id` is not linked to `tasks.assigned_to` | Verify `user_profiles.employee_id` linkage in User Management |
| Checker gets "Attendance already marked" on Approve | Attendance was marked on the Attendance Board before approval | Expected safeguard — existing attendance is preserved and task auto-closes |
