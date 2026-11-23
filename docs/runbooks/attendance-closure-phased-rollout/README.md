# Attendance Closure & Week-Off Management — 5-Phase Rollout Runbooks

**Linked PRD/TRD:** [unmarked_attendance_manager_tasks.md](../../features/unmarked_attendance_manager_tasks.md)
**Master Implementation Runbook:** [unmarked_attendance_implementation_runbook.md](../unmarked_attendance_implementation_runbook.md)
**Day-2 Operations Runbook:** [unmarked_attendance_operations_runbook.md](../unmarked_attendance_operations_runbook.md)
**Status:** Implemented (Phases 1–4; Escalations Board routing + Subject-Employee Track Requests warning added 2026-11-22)
**Last Updated:** 2026-11-22

> **Board Placement Rule (Mandatory):** All `UNMARKED_ATTENDANCE` and `CONSECUTIVE_WEEKOFF_ESCALATION` tasks are created on **Charging Hubs → Escalations Task Board** (`vertical_id = 'CHARGING_HUBS'`, `task_board = '["Escalations"]'`) and surfaced in **Home → Track Requests** (including read-only awareness warnings for the subject employee). They MUST NEVER be created in **Employees → Remarks Manager**, which is strictly for personal remarks/mistakes assigned to the employee who committed them.

---

## Core Strategy: Week-Off First, Usage-First, Small Batches

Launching **Self-Service Week-Off + Consecutive Week-Off Escalation** *before* **Unmarked Attendance Manager Tasks** eliminates ~80% of routine legitimate Week-Off noise so managers only ever deal with true exceptions. Every phase ships something immediately usable in production.

```
Phase 1 (Audit & Orphan Hygiene)
  → Phase 2 (Self-Service Week-Off + Consecutive WO Escalation)
    → Phase 3 (Unmarked Attendance Maker-Checker — 1–2 Hub Pilot)
      → Phase 4 (Automated Daily Cron — 3 Hub Waves to 100%)
        → Phase 5 (End-State Governance & Polish)
```

| Phase | Runbook | What Ships | Immediate Production Value | Gate to Next Phase |
|---|---|---|---|---|
| **Phase 1** | [phase-1-audit-and-orphan-hygiene.md](./phase-1-audit-and-orphan-hygiene.md) | `marked_by`, `approved_by`, `marked_source` on `daily_attendances` + Orphan Org Audit | Every attendance write immediately records attribution; Ops fixes broken `manager_id` chains upfront | Audit columns populating in Prod; Pilot Hub reporting lines cleaned |
| **Phase 2** | [phase-2-self-service-weekoff-and-escalation.md](./phase-2-self-service-weekoff-and-escalation.md) | Retroactive *"Was yesterday your Week-Off?"* prompt on next login; auto-saves single WO; escalates **consecutive** WO to Task Board (Maker-Checker) | ~80% of routine legitimate Week-Offs self-resolve in 1 tap; consecutive WO abuse gets escalated on Day 1 | Stable employee adoption; consecutive WO escalation verified end-to-end |
| **Phase 3** | [phase-3-unmarked-attendance-pilot.md](./phase-3-unmarked-attendance-pilot.md) | Unmarked Attendance Maker-Checker tasks (5 options, no `Present`; Reporting Manager → 1st upward `Editor+`; Orphan → `master_admin` with top warning) for **1–2 Pilot Hubs** via manual trigger (~12:00 PM IST) | Pilot managers resolve only **true unresolved gaps** using Deactivate-Employee-style Task Board UX | 3–5 clean pilot days; Approval, Rejection, Auto-Close, and Mobile/Desktop verified |
| **Phase 4** | [phase-4-automated-batch-rollout.md](./phase-4-automated-batch-rollout.md) | Automated daily cron (~12:00 PM IST, after morning logins) rolled out in 3 Hub Waves: 25% → 60% → 100% | Full org-wide daily attendance closure with minimal manager noise and 1-click pause lever | >90% tasks resolved in 24–48h; <5% orphan rate; 5 clean cron runs at 100% |
| **Phase 5** | [phase-5-end-state-governance-and-polish.md](./phase-5-end-state-governance-and-polish.md) | Attendance Board attribution tooltip, Schedule Planner harmony, optional >48h SLA reminders & bulk-mark | Full closed-loop audit visibility without SQL; only builds polish proven necessary by Phases 2–4 | Post-implementation review logged |
