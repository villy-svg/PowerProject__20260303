# Verticals & Task Boards Architecture Policy

**MANDATORY REFERENCE**: Read this rule before creating, routing, or auditing any task, alert, escalation, or board view in PowerProject.

## 1. Canonical Vertical & Board Map

| Vertical | UI Board Name | `activeVertical` Key | DB `vertical_id` | DB `task_board` Tag | Purpose & Ownership Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Home** | **Track Requests** | `escalations` (`HomeEscalationsBoard`) | `CHARGING_HUBS` | `["Escalations"]` | User-scoped Home view of escalations & support requests (assigned, created, employee approvals, upward manager alerts, and **read-only subject-employee attendance closure warnings**). |
| **Home** | **Centralised Task View** | `centralised_task_view` | Any (non-escalation) | Any (non-escalation) | Unified workspace for all non-escalation tasks assigned to or created by the user across verticals. |
| **Charging Hubs** | **Hubs Task Board** | `CHARGING_HUBS` | `CHARGING_HUBS` | `["Hubs"]` | Standard hub operations tasks. |
| **Charging Hubs** | **Escalations Task Board** | `escalation_tasks` | `CHARGING_HUBS` | `["Escalations"]` | **Canonical home for ALL operational & attendance escalations** (`overtime_alert`, `forced_checkout`, `UNMARKED_ATTENDANCE`, `CONSECUTIVE_WEEKOFF_ESCALATION`, support escalations). |
| **Charging Hubs** | **Daily Task Board** *(locked)* | `daily_hub_tasks` | `CHARGING_HUBS` | `["Hubs Daily"]` | Recurring daily hub checklists (currently locked). |
| **Employees** | **Remarks Manager** | `employee_tasks` | `EMPLOYEES` | `["Employees"]` | **Strictly for personal remarks/mistakes assigned to the employee who made the mistake** (grouped by employee, columns = remark grade). Example: `force_end_remark` ("Logout Not Done"). |
| **Employees** | **Attendance Board** | `employee_attendance_board` | N/A (`daily_attendances`) | N/A | Daily attendance grid, check-in/out sessions, Force Checkout, and `attendance_edit_requests`. |
| **Employees** | **My Attendance** | `attendance_self_service` | N/A (`daily_attendances`) | N/A | Employee self check-in/check-out and previous-day self-service Week-Off. |
| **Employees** | **Employees List** | `EMPLOYEES` | N/A (`employees`) | N/A | Employee directory, profiles, hierarchy, bank details, deactivation requests. |

---

## 2. Hard Ownership Boundaries (NEVER VIOLATE)

1. **Remarks Manager (`EMPLOYEES` / `["Employees"]`) is NEVER for Manager-Assigned Escalations:**
   - Every card in Remarks Manager represents a personal remark or mistake attributed directly to the **employee assigned to it** (and increments that employee's remark count on the Employees List).
   - Even if missed-attendance remarks were ever added in the future, they would be assigned to the employee who missed attendance — **never** to their manager. **Currently, missed attendance does NOT create remarks in Remarks Manager at all.**
2. **All Automated Attendance Escalations Live on Charging Hubs → Escalations (`CHARGING_HUBS` / `["Escalations"]`):**
   - `overtime_alert` (pg_cron `check_overtime_alerts`, >11h open session)
   - `forced_checkout` (`rpc_auto_checkout_stale_sessions`, >3d unclosed session)
   - `UNMARKED_ATTENDANCE` (GitHub Actions 09:00 AM IST T-2 sweep `rpc_generate_unmarked_attendance_tasks`)
   - `CONSECUTIVE_WEEKOFF_ESCALATION` (`rpc_claim_yesterday_weekoff` when T-2 was already Week-Off)
3. **Subject Employee Awareness (`UNMARKED_ATTENDANCE` & `CONSECUTIVE_WEEKOFF_ESCALATION`):**
   - The subject employee sees their own open attendance closure task **read-only** in **Home → Track Requests** with a warning banner (*"Alert sent to your manager..."*).
   - Enforced at **both** DB (`Permit SELECT` Level 2b + `trg_tasks_protect_attendance_closure` + self-subject check in Maker-Checker RPCs) and UI layers (`isSubjectEmployeeOfAttendanceTask`).
4. **Never Bypass Maker-Checker on Attendance Closure Tasks:**
   - `UNMARKED_ATTENDANCE` and `CONSECUTIVE_WEEKOFF_ESCALATION` tasks MUST ONLY transition via `rpc_submit_attendance_task_choice`, `rpc_approve_attendance_task`, `rpc_reject_attendance_task`, or `func_daily_attendances_auto_close_closure_tasks` (enforced by `trg_tasks_protect_attendance_closure`).
