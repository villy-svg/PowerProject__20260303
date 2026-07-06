-- =========================================================================
-- POWERPROJECT: Viewer RBAC Enhancements (Escalations & Attendance)
--               + Legacy daily_tasks Decommissioning
--
-- Skill compliance:
--   rbac-security-system §3 (Standard RLS Pattern)
--   database-migration-policy §2 (Repair-Safe Idempotency)
--   database-migration-policy §5 (PostgreSQL Kick)
-- =========================================================================

-- =========================================================================
-- 1. Decommission legacy `daily_tasks` table and related dependencies
-- =========================================================================

-- A. Clean up orphaned polymorphic records (Idempotent)
DELETE FROM public.task_context_links WHERE source_type = 'daily_task';

-- B. Clean up task_context_links RLS to remove daily_tasks branch
-- (CRITICAL: Must be done BEFORE modifying public.tasks to prevent Postgres 
-- from re-validating this policy and crashing because daily_tasks is missing)
DROP POLICY IF EXISTS "tcl SELECT" ON public.task_context_links;
CREATE POLICY "tcl SELECT" ON public.task_context_links
FOR SELECT USING (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    ))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl INSERT" ON public.task_context_links;
CREATE POLICY "tcl INSERT" ON public.task_context_links
FOR INSERT WITH CHECK (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('contributor','editor','admin')
    ))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl DELETE" ON public.task_context_links;
CREATE POLICY "tcl DELETE" ON public.task_context_links
FOR DELETE USING (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('editor','admin')
    ))
    OR source_type = 'template'
);

-- C. Drop table completely
-- Using CASCADE automatically handles dropping dependent functions (like assignees(daily_tasks))
-- and triggers (like protect_task_columns_daily_tasks), making this perfectly idempotent.
DROP TABLE IF EXISTS public.daily_tasks CASCADE;

-- =========================================================================
-- 2. Tasks Table: Permit INSERT for Escalations by anyone
-- =========================================================================
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.tasks;
CREATE POLICY "Permit INSERT based on role" ON public.tasks
FOR INSERT WITH CHECK (
    public.get_user_permission_level(vertical_id) IN ('contributor','editor','admin')
    OR (
        task_board @> '["Escalations"]'::jsonb
    )
);

-- =========================================================================
-- 3. Daily Attendances: Permit SELECT for own records for Viewers
-- =========================================================================
DROP POLICY IF EXISTS "Attendance: SELECT for contributor+" ON public.daily_attendances;
DROP POLICY IF EXISTS "Attendance: SELECT for contributor+ or own record" ON public.daily_attendances;

CREATE POLICY "Attendance: SELECT for contributor+ or own record"
  ON public.daily_attendances
  FOR SELECT
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('contributor', 'editor', 'admin')
    OR (
      public.get_user_permission_level('EMPLOYEES') = 'viewer' 
      AND employee_id = (SELECT employee_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );


-- -------------------------------------------------------------------------
-- PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
