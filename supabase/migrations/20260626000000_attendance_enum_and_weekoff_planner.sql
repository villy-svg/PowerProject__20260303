-- =========================================================================
-- POWERPROJECT: Attendance Enum Fix + Week Off Planner Schema
-- Migration: 20260626000000_attendance_enum_and_weekoff_planner.sql
--
-- Skill compliance:
--   database-migration-policy §3  (Iterative Evolution — new timestamped file)
--   database-migration-policy §5  (PostgreSQL Kick at end)
--   database-migration-policy §2  (Repair-Safe Idempotency — IF NOT EXISTS)
--   rbac-security-system §3       (Standard RLS pattern on all new tables)
--   database-table-naming-convention ([vertical]_[feature]_[details])
--
-- ─────────────────────────────────────────────────────────────────────────
-- CHANGES IN THIS MIGRATION
-- ─────────────────────────────────────────────────────────────────────────
--
--  FIX 1 — [Pre-existing Bug] attendance_status_enum missing new values
--    The frontend added 'no-show' and 'no-call-no-show' statuses but they
--    were never added to the DB enum. Any attempt to save these statuses
--    from AttendanceSuggestEditModal would fail with a type error.
--    Fix: Add both values to the enum idempotently.
--
--  NEW 1 — weekoff_plan_status_enum
--    A dedicated status enum for the bulk week-off planner lifecycle:
--    draft → pending → approved / rejected → (rejected can be re-submitted)
--    cancelled covers the case where a contributor replaces a pending plan
--    with a newer version before it is reviewed.
--
--  NEW 2 — employee_weekoff_plans (plan header table)
--    One row per bulk week-off plan submission. Covers a date_from/date_to
--    window of 1-15 days. Enforced by a CHECK constraint at DB level.
--    Naming: employee (vertical) + weekoff (feature) + plans (details)
--
--  NEW 3 — employee_weekoff_plan_entries (line items table)
--    One row per employee per date within a plan. On approval, each entry
--    is upserted into daily_attendances as status='week-off'.
--    Naming: employee (vertical) + weekoff (feature) + plan_entries (details)
--
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 1: Fix pre-existing bug — add missing enum values
--
-- PostgreSQL does not support IF NOT EXISTS on ALTER TYPE ADD VALUE.
-- We use a DO block with an exception guard for idempotency.
-- -------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TYPE public.attendance_status_enum ADD VALUE 'no-show';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.attendance_status_enum ADD VALUE 'no-call-no-show';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- STEP 2: Create weekoff_plan_status_enum
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.weekoff_plan_status_enum AS ENUM (
    'draft',      -- Saved but not yet submitted for approval
    'pending',    -- Submitted; awaiting Editor review
    'approved',   -- Editor approved; entries written to daily_attendances
    'rejected',   -- Editor rejected; Contributor can edit and resubmit
    'cancelled'   -- Automatically cancelled when a new version is submitted
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- STEP 3: Create employee_weekoff_plans (plan header)
--
-- Design notes:
--   - One row per bulk plan submission.
--   - CHECK constraint enforces the 15-day max planning window at DB level.
--   - date_from and date_to must be future or current dates — NOT enforced
--     here at DB level (enforced in UI + service layer) to avoid blocking
--     re-opens of rejected historical drafts.
--   - submitted_by = contributor/editor who created the plan.
--   - reviewed_by = editor who approved/rejected (NULL until reviewed).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_weekoff_plans (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by  uuid        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reviewed_by   uuid                 REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  plan_status   public.weekoff_plan_status_enum NOT NULL DEFAULT 'draft',
  date_from     date        NOT NULL,
  date_to       date        NOT NULL,
  review_note   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Enforce max 15-day planning window (0 = single day, 14 = 15 days inclusive)
  CONSTRAINT chk_weekoff_plan_date_order  CHECK (date_to >= date_from),
  CONSTRAINT chk_weekoff_plan_window      CHECK ((date_to - date_from) <= 14)
);

-- -------------------------------------------------------------------------
-- STEP 4: Create employee_weekoff_plan_entries (plan line items)
--
-- Design notes:
--   - One row per employee per date per plan.
--   - Cascade deletes if the parent plan is deleted.
--   - Unique constraint prevents duplicate entries for the same
--     employee+date within the same plan.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_weekoff_plan_entries (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id     uuid        NOT NULL REFERENCES public.employee_weekoff_plans(id) ON DELETE CASCADE,
  employee_id uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date  date        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_weekoff_entry UNIQUE (plan_id, employee_id, shift_date)
);

-- -------------------------------------------------------------------------
-- STEP 5: Performance Indexes
-- -------------------------------------------------------------------------

-- Filter plans by status (editor approval queue, contributor draft list)
CREATE INDEX IF NOT EXISTS idx_employee_weekoff_plans_status
  ON public.employee_weekoff_plans(plan_status);

-- Filter plans by submitter (contributor "My Plans" section)
CREATE INDEX IF NOT EXISTS idx_employee_weekoff_plans_submitted_by
  ON public.employee_weekoff_plans(submitted_by);

-- Lookup all entries for a plan (plan detail view, approval)
CREATE INDEX IF NOT EXISTS idx_employee_weekoff_plan_entries_plan_id
  ON public.employee_weekoff_plan_entries(plan_id);

-- Lookup all entries for a specific employee (future: employee timeline view)
CREATE INDEX IF NOT EXISTS idx_employee_weekoff_plan_entries_employee_id
  ON public.employee_weekoff_plan_entries(employee_id);

-- -------------------------------------------------------------------------
-- STEP 6: Auto-update updated_at trigger for employee_weekoff_plans
-- Reuse the existing update_attendance_updated_at() function.
-- -------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_employee_weekoff_plans_updated_at
  BEFORE UPDATE ON public.employee_weekoff_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();

-- -------------------------------------------------------------------------
-- STEP 7: Enable Row Level Security
-- -------------------------------------------------------------------------
ALTER TABLE public.employee_weekoff_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_weekoff_plan_entries  ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- STEP 8: RLS Policies — employee_weekoff_plans
--
-- SELECT: Any user with board access (viewer+) can read all plans
--         so editors can see pending plans and contributors can see
--         the status of their own submissions.
-- INSERT: Contributor+ can create new plans (they own the submitted_by field)
-- UPDATE: Editor+ can update request_status (approve/reject).
--         The contributor can also update their own draft plan.
--         We use a permissive OR policy for this split ownership.
-- DELETE: Contributor can delete their own DRAFT plans only.
-- -------------------------------------------------------------------------

-- SELECT: viewer and above
CREATE POLICY "weekoff_plans_select" ON public.employee_weekoff_plans
  FOR SELECT USING (
    public.get_user_permission_level('employees') IN ('viewer', 'contributor', 'editor', 'admin')
  );

-- INSERT: contributor and above
CREATE POLICY "weekoff_plans_insert" ON public.employee_weekoff_plans
  FOR INSERT WITH CHECK (
    public.get_user_permission_level('employees') IN ('contributor', 'editor', 'admin')
  );

-- UPDATE: editor/admin (to approve/reject any plan) OR the plan's own
--         submitter (to update a draft/rejected plan they own)
CREATE POLICY "weekoff_plans_update" ON public.employee_weekoff_plans
  FOR UPDATE USING (
    public.get_user_permission_level('employees') IN ('editor', 'admin')
    OR submitted_by = auth.uid()
  )
  WITH CHECK (
    public.get_user_permission_level('employees') IN ('editor', 'admin')
    OR submitted_by = auth.uid()
  );

-- DELETE: contributor can only delete their own drafts
CREATE POLICY "weekoff_plans_delete" ON public.employee_weekoff_plans
  FOR DELETE USING (
    submitted_by = auth.uid()
    AND plan_status = 'draft'
  );

-- -------------------------------------------------------------------------
-- STEP 9: RLS Policies — employee_weekoff_plan_entries
--
-- Entries inherit their visibility from their parent plan.
-- -------------------------------------------------------------------------

-- SELECT: anyone with board access
CREATE POLICY "weekoff_plan_entries_select" ON public.employee_weekoff_plan_entries
  FOR SELECT USING (
    public.get_user_permission_level('employees') IN ('viewer', 'contributor', 'editor', 'admin')
  );

-- INSERT: contributor+ (service layer inserts entries when a plan is saved)
CREATE POLICY "weekoff_plan_entries_insert" ON public.employee_weekoff_plan_entries
  FOR INSERT WITH CHECK (
    public.get_user_permission_level('employees') IN ('contributor', 'editor', 'admin')
  );

-- UPDATE: editor/admin only (entries are not individually edited; plan is re-submitted)
CREATE POLICY "weekoff_plan_entries_update" ON public.employee_weekoff_plan_entries
  FOR UPDATE USING (
    public.get_user_permission_level('employees') IN ('editor', 'admin')
  )
  WITH CHECK (
    public.get_user_permission_level('employees') IN ('editor', 'admin')
  );

-- DELETE: contributor can delete their own plan's entries (when re-submitting)
CREATE POLICY "weekoff_plan_entries_delete" ON public.employee_weekoff_plan_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.employee_weekoff_plans p
      WHERE p.id = plan_id
        AND p.submitted_by = auth.uid()
        AND p.plan_status IN ('draft', 'rejected')
    )
  );

-- -------------------------------------------------------------------------
-- STEP 10: PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
