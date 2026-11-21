# Phase 5 Runbook — End-State Governance & Usage-Driven Polish

**Goal:** Close the loop with UI attribution visibility and build only the scale/polish features that real usage in Phases 2–4 proves are needed.
**Estimated Effort:** Modular (pick items based on real feedback)
**Risk Level:** Very Low

---

## Candidate End-State Enhancements

1. **Attendance Board Attribution Tooltip (High Value, Low Effort):**
   - Display `Marked by: [Name] · Approved by: [Name] · Source: [Self Week-Off / Unmarked Task / Check-In / Edit Request]` on Attendance Board cells so HR/Ops can audit attribution directly in the UI without running SQL.
2. **Schedule Planner Harmony:**
   - Verify that any pre-planned `week-off` or `leave` approved via `employee_schedule_plans` automatically skips both the Phase 2 Week-Off prompt and Phase 3/4 Unmarked Attendance tasks.
3. **Optional Proactive "Today is my Week-Off" Secondary Button:**
   - Only add if Hub Ops later requests same-day Live Attendance visibility for employees on Week-Off.
4. **Overdue SLA Alerts / Bulk-Mark Helper:**
   - Add an "Overdue (>48h)" badge or `send-push` reminder if tasks age beyond 48 hours.
   - Add a grouped quick-mark view only if high-headcount managers report card fatigue.
5. **Post-Implementation Review:**
   - Log final metrics and lessons learned in `docs/features/unmarked_attendance_manager_tasks.md` 2 weeks after 100% rollout.
