-- =========================================================================
-- POWERPROJECT: Attendance Closure → Escalations Board (Part 2/3: RLS & Tamper Guard)
-- Migration: 20261122101100_attendance_closure_rls_and_tamper_guard.sql
--
-- Purpose:
--   1. Tamper-protection trigger on public.tasks preventing direct stage jumps,
--      reassignment, metadata/board edits, or non-master deletion of attendance
--      closure tasks (forces Maker-Checker RPCs or auto-close trigger).
--   2. Narrow Level 2b SELECT-only RLS clause on public.tasks so the subject
--      employee sees a read-only awareness warning in Home -> Track Requests
--      (and EMPLOYEES Editor/Admin retains oversight).
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped), §5 (NOTIFY pgrst)
--   database-table-naming-convention (trg_tasks_* / func_tasks_*)
--   rbac-security-system §3 (Least-privilege RLS + trigger guard)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Tamper-Protection Trigger on public.tasks
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.func_tasks_protect_attendance_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.metadata->>'type') NOT IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Trusted server / Maker-Checker RPC / auto-close trigger contexts
  IF current_user = 'service_role'
     OR auth.uid() IS NULL
     OR current_setting('app.bypass_task_column_guard', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Attendance closure escalations cannot be deleted. Resolve them via the Attendance Closure review flow.';
    END IF;
    RETURN OLD;
  END IF;

  -- Block direct tampering of workflow/routing columns (forces Maker-Checker RPCs)
  IF NEW.stage_id    IS DISTINCT FROM OLD.stage_id
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.metadata    IS DISTINCT FROM OLD.metadata
     OR NEW.vertical_id IS DISTINCT FROM OLD.vertical_id
     OR NEW.task_board  IS DISTINCT FROM OLD.task_board THEN
    RAISE EXCEPTION 'Attendance closure tasks must be updated via the Mark Attendance / Review Attendance flow (direct stage or assignment edits are blocked).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_protect_attendance_closure ON public.tasks;
CREATE TRIGGER trg_tasks_protect_attendance_closure
  BEFORE UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.func_tasks_protect_attendance_closure();


-- -------------------------------------------------------------------------
-- SECTION 2: SELECT-Only RLS Level 2b (Subject Employee Awareness + HR Oversight)
-- Permit UPDATE and Permit DELETE are intentionally UNCHANGED.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Permit SELECT based on hybrid junction" ON public.tasks;
CREATE POLICY "Permit SELECT based on hybrid junction" ON public.tasks
FOR SELECT USING (
    -- Level 1: Admin/Editor override for the task's vertical
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')

    -- Level 2: Personal Ownership (direct employee_id match or multi-assignee junction)
    OR EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.is_active = true
          AND up.employee_id = tasks.assigned_to
    )
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.entity_type = 'assignee'
          AND tcl.is_active = true
          AND up.is_active = true
          AND up.id = auth.uid()
    )

    -- Level 2b: Subject Employee Read-Only Awareness + EMPLOYEES Editor/Admin Oversight
    -- Short-circuits on metadata->>'type' before touching user_profiles.
    OR (
        (tasks.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (
            EXISTS (
                SELECT 1 FROM public.user_profiles up
                WHERE up.id = auth.uid()
                  AND up.is_active = true
                  AND up.employee_id::text = (tasks.metadata->>'employee_id')
            )
            OR public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
        )
    )

    -- Level 3: The Multi-Hub Junction
    OR public.check_task_junction(id)
);


-- -------------------------------------------------------------------------
-- SECTION 3: Grants, Evolution Ledger & Schema Reload
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.func_tasks_protect_attendance_closure() FROM PUBLIC, anon, authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261122101100_attendance_closure_rls_and_tamper_guard',
  'Attendance Closure Part 2/3: Added BEFORE UPDATE/DELETE tamper-protection trigger (trg_tasks_protect_attendance_closure) and narrow SELECT-only RLS Level 2b for subject-employee awareness in Home -> Track Requests.',
  ARRAY['tasks']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
