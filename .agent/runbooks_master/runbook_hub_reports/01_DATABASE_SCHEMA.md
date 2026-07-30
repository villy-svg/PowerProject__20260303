# Runbook 01: Database Schema — Hub Daily Shift Reports

## 1. Objective

Create two new database tables to support the **Hub Daily Shift Reports** Maker-Checker workflow:

1. `hub_shift_reports` — The header record for a single hub × date × shift combination.
2. `hub_shift_report_entries` — One row per client per report, storing both Maker (draft) and Checker (verified) figures independently.

This is a **write-once, never-destructive** schema: draft figures from the Maker are never overwritten — the Checker stores their independently verified numbers in separate `verified_*` columns.

---

## 2. Prerequisites

- [ ] You have Supabase Dashboard access (or the Supabase CLI connected to the project).
- [ ] You have verified that `public.hubs`, `public.clients`, and `public.user_profiles` tables exist.
- [ ] You have confirmed the `get_user_permission_level(vertical_id text)` RLS function is available and uses `'DATA_MANAGER'` as the vertical key.
- [ ] You have read the **Database Migration Policy** skill before proceeding.
- [ ] Migration timestamp prefix confirmed: **`20260730`**.

---

## 3. Files Affected

| Action | Path |
| :----- | :--- |
| CREATE | `supabase/migrations/20260730120000_hub_shift_reports.sql` |

---

## 4. Implementation Steps

### 4.1 Create the Migration File

Create the file `supabase/migrations/20260730120000_hub_shift_reports.sql` with the following complete content.

```sql
-- =============================================================================
-- Migration: 20260730120000_hub_shift_reports
-- Description: Creates hub_shift_reports and hub_shift_report_entries tables
--              for the Hub Daily Shift Reports Maker-Checker feature.
-- Author:      PowerProject Automation
-- Date:        2026-07-30
-- =============================================================================


-- =============================================================================
-- SECTION 1: CREATE TABLES (Idempotency Guards)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table 1: hub_shift_reports (Header record)
-- One row per hub x report_date x shift. The UNIQUE constraint enforces
-- that only one draft/verified report can exist for a given slot.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hub_shift_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id        uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  report_date   date NOT NULL,
  shift         text NOT NULL CHECK (shift IN ('Day', 'Night')),
  status        text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Verified')),
  submitted_by  uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_at  timestamptz,
  verified_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  verified_at   timestamptz,
  maker_note    text,
  checker_note  text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (hub_id, report_date, shift)
);

-- Add unique constraint idempotently (in case the table pre-existed without it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'hub_shift_reports_hub_id_report_date_shift_key'
  ) THEN
    ALTER TABLE public.hub_shift_reports
      ADD CONSTRAINT hub_shift_reports_hub_id_report_date_shift_key
      UNIQUE (hub_id, report_date, shift);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Table 2: hub_shift_report_entries (Line items per client)
-- Maker fills draft_* columns. Checker independently fills verified_* columns.
-- client_id is nullable (SET NULL on client deletion) but client_name is NOT NULL
-- to preserve the historical record even if the client is later removed.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hub_shift_report_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id             uuid NOT NULL REFERENCES public.hub_shift_reports(id) ON DELETE CASCADE,
  client_id             uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name           text NOT NULL,
  -- Maker (Draft) columns -- always filled on submission
  draft_sessions_3w     integer NOT NULL DEFAULT 0,
  draft_sessions_4w     integer NOT NULL DEFAULT 0,
  draft_parked_3w       integer NOT NULL DEFAULT 0,
  draft_parked_4w       integer NOT NULL DEFAULT 0,
  -- Checker (Verified) columns -- NULL until checker verifies
  verified_sessions_3w  integer,
  verified_sessions_4w  integer,
  verified_parked_3w    integer,
  verified_parked_4w    integer,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);


-- =============================================================================
-- SECTION 2: INDEXES
-- =============================================================================

-- Index for the primary query pattern: find all reports for a hub on a date
CREATE INDEX IF NOT EXISTS idx_hub_shift_reports_hub_date
  ON public.hub_shift_reports (hub_id, report_date);

-- Index for date-range analytics queries
CREATE INDEX IF NOT EXISTS idx_hub_shift_reports_date_status
  ON public.hub_shift_reports (report_date, status);

-- Index for fetching all entries for a given report
CREATE INDEX IF NOT EXISTS idx_hub_shift_report_entries_report_id
  ON public.hub_shift_report_entries (report_id);

-- Index for joining entries back to a client
CREATE INDEX IF NOT EXISTS idx_hub_shift_report_entries_client_id
  ON public.hub_shift_report_entries (client_id);


-- =============================================================================
-- SECTION 3: updated_at AUTO-UPDATE TRIGGERS
-- =============================================================================

-- Reuse the project's standard trigger function (must already exist).
-- If it does not exist, create a local version:
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for hub_shift_reports
DROP TRIGGER IF EXISTS trg_hub_shift_reports_updated_at ON public.hub_shift_reports;
CREATE TRIGGER trg_hub_shift_reports_updated_at
  BEFORE UPDATE ON public.hub_shift_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger for hub_shift_report_entries
DROP TRIGGER IF EXISTS trg_hub_shift_report_entries_updated_at ON public.hub_shift_report_entries;
CREATE TRIGGER trg_hub_shift_report_entries_updated_at
  BEFORE UPDATE ON public.hub_shift_report_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- Uses the project's standard get_user_permission_level() function.
-- Vertical ID for Data Manager is 'DATA_MANAGER'.
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE public.hub_shift_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_shift_report_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies idempotently before re-creating
DROP POLICY IF EXISTS "hub_shift_reports_select"        ON public.hub_shift_reports;
DROP POLICY IF EXISTS "hub_shift_reports_insert"        ON public.hub_shift_reports;
DROP POLICY IF EXISTS "hub_shift_reports_update"        ON public.hub_shift_reports;
DROP POLICY IF EXISTS "hub_shift_reports_delete"        ON public.hub_shift_reports;
DROP POLICY IF EXISTS "hub_shift_report_entries_select" ON public.hub_shift_report_entries;
DROP POLICY IF EXISTS "hub_shift_report_entries_insert" ON public.hub_shift_report_entries;
DROP POLICY IF EXISTS "hub_shift_report_entries_update" ON public.hub_shift_report_entries;
DROP POLICY IF EXISTS "hub_shift_report_entries_delete" ON public.hub_shift_report_entries;

-- ---- hub_shift_reports policies ----

-- SELECT: Viewer+ (level != 'none')
CREATE POLICY "hub_shift_reports_select"
  ON public.hub_shift_reports FOR SELECT
  USING (get_user_permission_level('DATA_MANAGER') != 'none');

-- INSERT: Contributor+ (Makers submit drafts; Checkers create verified rows)
CREATE POLICY "hub_shift_reports_insert"
  ON public.hub_shift_reports FOR INSERT
  WITH CHECK (get_user_permission_level('DATA_MANAGER') IN (
    'contributor', 'editor', 'admin', 'master_contributor', 'master_editor', 'master_admin'
  ));

-- UPDATE: Contributor+ (Maker updates draft; Checker updates to Verified)
CREATE POLICY "hub_shift_reports_update"
  ON public.hub_shift_reports FOR UPDATE
  USING (get_user_permission_level('DATA_MANAGER') IN (
    'contributor', 'editor', 'admin', 'master_contributor', 'master_editor', 'master_admin'
  ));

-- DELETE: Admin only
CREATE POLICY "hub_shift_reports_delete"
  ON public.hub_shift_reports FOR DELETE
  USING (get_user_permission_level('DATA_MANAGER') IN ('admin', 'master_admin'));

-- ---- hub_shift_report_entries policies ----

-- SELECT: Viewer+
CREATE POLICY "hub_shift_report_entries_select"
  ON public.hub_shift_report_entries FOR SELECT
  USING (get_user_permission_level('DATA_MANAGER') != 'none');

-- INSERT: Contributor+
CREATE POLICY "hub_shift_report_entries_insert"
  ON public.hub_shift_report_entries FOR INSERT
  WITH CHECK (get_user_permission_level('DATA_MANAGER') IN (
    'contributor', 'editor', 'admin', 'master_contributor', 'master_editor', 'master_admin'
  ));

-- UPDATE: Contributor+
CREATE POLICY "hub_shift_report_entries_update"
  ON public.hub_shift_report_entries FOR UPDATE
  USING (get_user_permission_level('DATA_MANAGER') IN (
    'contributor', 'editor', 'admin', 'master_contributor', 'master_editor', 'master_admin'
  ));

-- DELETE: Admin only (entries cascade from report deletion, but this guards manual deletion)
CREATE POLICY "hub_shift_report_entries_delete"
  ON public.hub_shift_report_entries FOR DELETE
  USING (get_user_permission_level('DATA_MANAGER') IN ('admin', 'master_admin'));


-- =============================================================================
-- SECTION 5: COMMENTS (Documentation)
-- =============================================================================

COMMENT ON TABLE public.hub_shift_reports IS
  'Header record for a single hub x date x shift report in the Maker-Checker workflow.';
COMMENT ON COLUMN public.hub_shift_reports.shift IS
  'Shift period: Day or Night.';
COMMENT ON COLUMN public.hub_shift_reports.status IS
  'Draft = submitted by Maker; Verified = independently verified by Checker.';
COMMENT ON COLUMN public.hub_shift_reports.maker_note IS
  'Optional free-text note from the hub operator (Maker) when submitting.';
COMMENT ON COLUMN public.hub_shift_reports.checker_note IS
  'Optional free-text note from the data team (Checker) when verifying.';

COMMENT ON TABLE public.hub_shift_report_entries IS
  'One row per active client per shift report. Draft and verified figures stored in separate columns.';
COMMENT ON COLUMN public.hub_shift_report_entries.client_name IS
  'Snapshot of client name at time of submission -- preserved even if client is deleted.';
COMMENT ON COLUMN public.hub_shift_report_entries.draft_sessions_3w IS
  'Maker-submitted: number of 3-wheeler charging sessions.';
COMMENT ON COLUMN public.hub_shift_report_entries.draft_sessions_4w IS
  'Maker-submitted: number of 4-wheeler charging sessions.';
COMMENT ON COLUMN public.hub_shift_report_entries.draft_parked_3w IS
  'Maker-submitted: number of 3-wheelers currently parked.';
COMMENT ON COLUMN public.hub_shift_report_entries.draft_parked_4w IS
  'Maker-submitted: number of 4-wheelers currently parked.';
COMMENT ON COLUMN public.hub_shift_report_entries.verified_sessions_3w IS
  'Checker-verified: number of 3-wheeler charging sessions (NULL until verified).';
COMMENT ON COLUMN public.hub_shift_report_entries.verified_sessions_4w IS
  'Checker-verified: number of 4-wheeler charging sessions (NULL until verified).';
COMMENT ON COLUMN public.hub_shift_report_entries.verified_parked_3w IS
  'Checker-verified: number of 3-wheelers currently parked (NULL until verified).';
COMMENT ON COLUMN public.hub_shift_report_entries.verified_parked_4w IS
  'Checker-verified: number of 4-wheelers currently parked (NULL until verified).';


-- =============================================================================
-- SECTION 6: PostgREST Cache Bust
-- =============================================================================

NOTIFY pgrst, 'reload schema';
```

---

## 5. Validation Queries

Run these in the Supabase SQL Editor after applying the migration to confirm correctness.

### 5.1 Verify Tables Exist

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('hub_shift_reports', 'hub_shift_report_entries')
ORDER BY table_name;
-- Expected: 2 rows, both BASE TABLE
```

### 5.2 Verify Columns

```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('hub_shift_reports', 'hub_shift_report_entries')
ORDER BY table_name, ordinal_position;
```

### 5.3 Verify Unique Constraint

```sql
SELECT conname, contype
FROM pg_constraint
WHERE conname = 'hub_shift_reports_hub_id_report_date_shift_key';
-- Expected: 1 row, contype = 'u'
```

### 5.4 Verify RLS Is Enabled

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('hub_shift_reports', 'hub_shift_report_entries')
  AND relnamespace = 'public'::regnamespace;
-- Expected: relrowsecurity = true for both rows
```

### 5.5 Verify Policies Exist

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('hub_shift_reports', 'hub_shift_report_entries')
ORDER BY tablename, policyname;
-- Expected: 4 policies per table (SELECT, INSERT, UPDATE, DELETE)
```

### 5.6 Verify Indexes

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('hub_shift_reports', 'hub_shift_report_entries')
ORDER BY tablename, indexname;
-- Expected: at least 4 custom indexes plus the primary key indexes
```

### 5.7 Smoke-Test Insert (Run in Supabase SQL Editor, then ROLLBACK)

```sql
BEGIN;

-- Insert a test report header
INSERT INTO public.hub_shift_reports (hub_id, report_date, shift)
SELECT id, CURRENT_DATE, 'Day'
FROM public.hubs
LIMIT 1
RETURNING id, hub_id, report_date, shift, status;

-- Verify the UNIQUE constraint fires on duplicate insert (comment out below to confirm error):
-- INSERT INTO public.hub_shift_reports (hub_id, report_date, shift)
-- SELECT id, CURRENT_DATE, 'Day' FROM public.hubs LIMIT 1;

ROLLBACK;
```

---

## 6. Rollback Plan

If the migration must be reversed (e.g., during staging testing):

```sql
-- WARNING: This is destructive. All report data will be lost.
-- Only run this if the feature has NOT been merged to production.

DROP TABLE IF EXISTS public.hub_shift_report_entries CASCADE;
DROP TABLE IF EXISTS public.hub_shift_reports CASCADE;

-- Remove the trigger function only if it was created solely by this migration
-- and is not referenced by any other table. Check first:
-- SELECT * FROM information_schema.triggers WHERE trigger_schema = 'public';
-- DROP FUNCTION IF EXISTS public.set_updated_at();

NOTIFY pgrst, 'reload schema';
```

> [!CAUTION]
> The `CASCADE` clause drops all indexes, triggers, and policies on the table. Never run this rollback on production without a confirmed data backup.

---

## 7. Design Decisions & Gotchas

| Decision | Rationale |
| :--- | :--- |
| `client_name text NOT NULL` alongside nullable `client_id` | Preserves the historical report even if a client is soft/hard deleted from the `clients` table. |
| `verified_*` columns default to `NULL` | A `NULL` verified value means "not yet checked", distinct from a deliberate `0`. The frontend must treat `NULL` differently from `0`. |
| Binary `status` CHECK constraint `('Draft', 'Verified')` | No 'Pending' or 'Rejected' states — keeps the Maker-Checker workflow simple and binary. |
| `ON DELETE CASCADE` on `report_id` FK in entries | Deleting a report header atomically cleans all its entries. No orphaned entry rows. |
| `ON DELETE SET NULL` on `client_id` FK | Orphaned entries keep their `client_name` snapshot and all numeric data intact. |
| `clients` uses `status = 'Active'`, NOT `is_active` | The `clients` table has no `is_active` column. Always filter with `WHERE status = 'Active'`. |
| No `hub_id` on `clients` table | Clients are globally active. ALL clients with `status = 'Active'` appear as rows in every hub's report. |

---

## 8. Progress Tracking

- [ ] Migration file created at `supabase/migrations/20260730120000_hub_shift_reports.sql`
- [ ] Migration applied to **Staging** environment
- [ ] Validation queries 5.1–5.6 all passed on Staging
- [ ] Migration applied to **Production** environment
- [ ] Validation queries confirmed on Production

**Next Runbook**: `02_RBAC.md`
