-- =========================================================================
-- POWERPROJECT: Viewer RBAC Enhancements (Escalations & Attendance)
--
-- Skill compliance:
--   rbac-security-system §3 (Standard RLS Pattern)
--   database-migration-policy §2 (Repair-Safe Idempotency)
--   database-migration-policy §5 (PostgreSQL Kick)
-- =========================================================================

-- 1. Tasks Table: Permit INSERT for Escalations by anyone
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.tasks;
CREATE POLICY "Permit INSERT based on role" ON public.tasks
FOR INSERT WITH CHECK (
    public.get_user_permission_level(verticalid) IN ('contributor','editor','admin')
    OR (
        task_board @> '["Escalations"]'::jsonb
    )
);

-- 2. Daily Attendances: Permit SELECT for own records for Viewers
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
