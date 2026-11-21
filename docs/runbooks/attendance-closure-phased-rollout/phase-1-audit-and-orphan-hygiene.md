# Phase 1 Runbook — Backend Attribution & Orphan Org Hygiene

**Goal:** Start tracking **who marked & approved** every attendance record immediately, and clean up broken reporting hierarchies *before* any escalations or automated tasks fire.
**Estimated Effort:** ~0.5 day
**Risk Level:** Very Low (additive columns only; zero UI disruption)

---

## 1. What Ships in Phase 1

1. **Migration 1 (Additive Schema + Existing RPC Audit Wiring):**
   - Add nullable columns to `public.daily_attendances`:
     - `marked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`
     - `approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL`
     - `marked_source text` (`'self_checkin' | 'self_weekoff' | 'unmarked_task' | 'attendance_board' | 'edit_request' | 'schedule_plan'`)
   - Wire `rpc_employee_checkin` → `marked_by = auth.uid()`, `marked_source = 'self_checkin'`.
   - Wire `approve_attendance_edit_request` → `marked_by = requested_by`, `approved_by = auth.uid()`, `marked_source = 'edit_request'`.
   - `NOTIFY pgrst, 'reload schema';`
2. **Read-Only Orphan Audit Report (Run on Production):**
   - List all `Active` employees with `manager_id IS NULL` or an inactive manager.
   - List all reporting managers with no active `Editor` or `Admin` anywhere above them in `employees.manager_id`.

---

## 2. Why This Gets Used Immediately
- From Day 1, every employee check-in and approved edit request persists permanent attribution in `daily_attendances`.
- Ops/HR fixes orphan reporting lines upfront so Master Admin isn't flooded with `⚠️ ORPHAN` tasks in Phases 2–4.

---

## 3. Exit Criteria (Before Starting Phase 2)
- [ ] `marked_by`, `approved_by`, and `marked_source` populate cleanly in Staging and Production.
- [ ] Critical orphan employees and managers have valid `manager_id` assignments in Employee Management.
- [ ] Zero regressions on Current Attendance or Attendance Board.
