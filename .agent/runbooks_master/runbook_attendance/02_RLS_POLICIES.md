# Phase 1.2 — RLS Policies for Attendance Tables

## Skills Required (Read Before Starting)
- `rbac-security-system` — Full RLS pattern, `get_user_permission_level()` helper
- `database-migration-policy` — Migration naming, PostgreSQL Kick

---

## Objective

Enable Row Level Security (RLS) on both new tables and define access policies:

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `daily_attendances` | contributor+ | editor+ (or self-service via service role) | editor+ | admin only |
| `attendance_edit_requests` | contributor+ | contributor+ (own submissions) | editor+ | admin only |

---

## Access Logic Design

### daily_attendances

- **SELECT**: Any user with contributor or higher access to the EMPLOYEES vertical can view the attendance grid.
- **INSERT**: Only `editor` and `admin` can directly insert (check-in/out logic runs via service functions, or via an Edge Function with service role for the employee self-service flow).
- **UPDATE**: Only `editor` and `admin` can modify existing records (approving edits).
- **DELETE**: Only `admin` can delete (accidental deletion prevention).

### attendance_edit_requests

- **SELECT**: Any user with contributor+ access can read their own submissions. Editors+ can read all.
- **INSERT**: Any contributor+ can create a pending request (they are the Maker).
- **UPDATE**: Only `editor+` can update `request_status` and `reviewed_by` (they are the Checker).
- **DELETE**: Admin only.

---

## Step 1: Create the RLS Migration File

**File to create:**
```
supabase/migrations/20260611000001_attendance_rls.sql
```

**Full SQL Content:**

```sql
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
```

---

## Step 2: Push the Migration

```bash
supabase db push --linked
```

---

## Validation Checklist

- [ ] RLS is enabled on `daily_attendances` (visible in Supabase Studio > Auth > Policies)
- [ ] RLS is enabled on `attendance_edit_requests`
- [ ] 4 policies exist on `daily_attendances` (SELECT, INSERT, UPDATE, DELETE)
- [ ] 4 policies exist on `attendance_edit_requests`
- [ ] Re-running the file a second time produces **zero errors** (idempotency confirmed)
- [ ] As a contributor user: can SELECT from `daily_attendances` ✅
- [ ] As a contributor user: cannot INSERT into `daily_attendances` directly ✅
- [ ] As a contributor user: can INSERT into `attendance_edit_requests` ✅
- [ ] As a contributor user: can only SELECT own rows from `attendance_edit_requests` ✅
- [ ] As an editor user: can INSERT and UPDATE `daily_attendances` ✅
- [ ] As an editor user: can SELECT all rows in `attendance_edit_requests` ✅
- [ ] `NOTIFY pgrst` present at end of file

---

## Security Notes

> **Employee Self-Service Check-In (Phase 4)**  
> When an employee (who may not have 'editor' role) logs their own attendance, the check-in/out must bypass the `INSERT` RLS policy on `daily_attendances`. This is handled via a **Supabase Edge Function** (or RPC) that runs with the service role. Do NOT relax the RLS policies to allow contributors to directly insert attendance records — this would break the Maker-Checker security model.

---

## DO NOT Proceed to Phase 2 Until All Items Above Are Checked.
