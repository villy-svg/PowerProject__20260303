-- =========================================================================
-- POWERPROJECT: Attendance Board — Phase 1.2: RLS Policies
--
-- Skill compliance:
--   rbac-security-system §3 (Standard RLS Pattern)
--   rbac-security-system §8 (Staging vs Production parity)
--   database-migration-policy §2 (Repair-Safe Idempotency)
--   database-migration-policy §5 (PostgreSQL Kick)
--
-- Idempotency strategy:
--   PostgreSQL does not support CREATE POLICY IF NOT EXISTS.
--   Each policy is preceded by DROP POLICY IF EXISTS so this file
--   is safe to re-run via `supabase migration repair` without
--   throwing duplicate_object errors.
-- =========================================================================

-- -------------------------------------------------------------------------
-- TABLE A: daily_attendances
-- -------------------------------------------------------------------------
ALTER TABLE public.daily_attendances ENABLE ROW LEVEL SECURITY;

-- Drop-before-create guards (idempotency / repair-safe)
DROP POLICY IF EXISTS "Attendance: SELECT for contributor+" ON public.daily_attendances;
DROP POLICY IF EXISTS "Attendance: INSERT for editor+"      ON public.daily_attendances;
DROP POLICY IF EXISTS "Attendance: UPDATE for editor+"      ON public.daily_attendances;
DROP POLICY IF EXISTS "Attendance: DELETE for admin"        ON public.daily_attendances;

-- SELECT: contributor and above can view all attendance records
-- (Manager Board read access)
CREATE POLICY "Attendance: SELECT for contributor+"
  ON public.daily_attendances
  FOR SELECT
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('contributor', 'editor', 'admin')
  );

-- INSERT: editor and above (direct writes — covers approved edits applied by editor)
-- Note: employee self-service check-in will use a Supabase Edge Function with
-- the service role key (bypasses RLS) to allow employees without editor-level
-- access to create their own attendance record.
CREATE POLICY "Attendance: INSERT for editor+"
  ON public.daily_attendances
  FOR INSERT
  WITH CHECK (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
  );

-- UPDATE: editor and above (used when approving an edit request)
CREATE POLICY "Attendance: UPDATE for editor+"
  ON public.daily_attendances
  FOR UPDATE
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
  )
  WITH CHECK (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
  );

-- DELETE: admin only
CREATE POLICY "Attendance: DELETE for admin"
  ON public.daily_attendances
  FOR DELETE
  USING (
    public.get_user_permission_level('EMPLOYEES') = 'admin'
  );

-- -------------------------------------------------------------------------
-- TABLE B: attendance_edit_requests
-- -------------------------------------------------------------------------
ALTER TABLE public.attendance_edit_requests ENABLE ROW LEVEL SECURITY;

-- Drop-before-create guards (idempotency / repair-safe)
DROP POLICY IF EXISTS "EditRequests: SELECT own or all for editor+" ON public.attendance_edit_requests;
DROP POLICY IF EXISTS "EditRequests: INSERT for contributor+"        ON public.attendance_edit_requests;
DROP POLICY IF EXISTS "EditRequests: UPDATE for editor+"             ON public.attendance_edit_requests;
DROP POLICY IF EXISTS "EditRequests: DELETE for admin"               ON public.attendance_edit_requests;

-- SELECT:
--   - Editors and admins can see ALL pending requests (Approval Queue)
--   - Contributors can only see their OWN submissions
CREATE POLICY "EditRequests: SELECT own or all for editor+"
  ON public.attendance_edit_requests
  FOR SELECT
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
    OR (
      public.get_user_permission_level('EMPLOYEES') = 'contributor'
      AND requested_by = auth.uid()
    )
  );

-- INSERT: contributor and above can submit a new edit request
-- They become the 'requested_by' (the Maker in the Maker-Checker flow)
CREATE POLICY "EditRequests: INSERT for contributor+"
  ON public.attendance_edit_requests
  FOR INSERT
  WITH CHECK (
    public.get_user_permission_level('EMPLOYEES') IN ('contributor', 'editor', 'admin')
    AND requested_by = auth.uid()  -- Must be submitting as yourself
  );

-- UPDATE: editor and above can approve or reject requests (the Checker)
-- They update request_status and reviewed_by columns only.
CREATE POLICY "EditRequests: UPDATE for editor+"
  ON public.attendance_edit_requests
  FOR UPDATE
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
  )
  WITH CHECK (
    public.get_user_permission_level('EMPLOYEES') IN ('editor', 'admin')
  );

-- DELETE: admin only
CREATE POLICY "EditRequests: DELETE for admin"
  ON public.attendance_edit_requests
  FOR DELETE
  USING (
    public.get_user_permission_level('EMPLOYEES') = 'admin'
  );

-- -------------------------------------------------------------------------
-- PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
