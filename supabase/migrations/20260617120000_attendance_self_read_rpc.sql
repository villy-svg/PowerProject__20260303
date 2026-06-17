-- =========================================================================
-- POWERPROJECT: Attendance — Self-Read RLS Policy
--
-- Root cause of the fetchMyTodayAttendance error:
--
--   The existing SELECT policy "Attendance: SELECT for contributor+"
--   gates on ROLE LEVEL only — not on employee identity. This means:
--
--   a) contributor+ users can see ALL employees' records for today.
--      .maybeSingle() in fetchMyTodayAttendance() receives multiple rows
--      → PGRST116 error ("more than one row returned").
--
--   b) viewer-level employees (who CAN check in via the SECURITY DEFINER
--      RPC) have NO SELECT policy that passes for them, so they can't
--      read their own record to check if their shift is active.
--
-- Design intent (as originally written):
--   Each employee should be able to read THEIR OWN daily_attendances row.
--   RLS was supposed to scope this automatically — it just wasn't written.
--
-- Fix:
--   Add a second SELECT policy "Attendance: SELECT own record" that allows
--   ANY authenticated employee to read rows WHERE the employee_id matches
--   their linked employee_id in user_profiles. PostgreSQL RLS policies are
--   OR'd — a row is visible when ANY policy's USING clause passes.
--
--   The existing "contributor+" policy is unchanged — manager-board reads
--   for supervisors still work as before.
--
-- Additionally: fetchMyTodayAttendance() is updated to pass an explicit
--   .eq('employee_id', ...) filter so that contributor+ users (who now
--   match BOTH policies) never accidentally receive other employees' rows.
--
-- Skill compliance:
--   database-migration-policy §2 (Repair-Safe Idempotency)
--   database-migration-policy §5 (PostgreSQL Kick)
--   rbac-security-system §3 (Least-privilege access validation)
-- =========================================================================

-- Self-read policy: any authenticated employee can read their own row.
-- The subquery resolves auth.uid() → user_profiles.employee_id → employee_id.
-- If no employee is linked, the subquery returns NULL and no rows are exposed.
DROP POLICY IF EXISTS "Attendance: SELECT own record" ON public.daily_attendances;
CREATE POLICY "Attendance: SELECT own record"
  ON public.daily_attendances
  FOR SELECT
  USING (
    employee_id = (
      SELECT employee_id
      FROM public.user_profiles
      WHERE id = auth.uid()
        AND employee_id IS NOT NULL
    )
  );

-- -------------------------------------------------------------------------
-- PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
