# Phase 1: Database Foundation — Execution Guide

> **Prerequisite**: No prior phases needed. This is the starting point.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 1A, 1B, 1C

---

## Phase 1A: Create `entities` Table

### What to Create

**File**: `supabase/migrations/20260406000001_entities_table.sql`

```sql
-- =========================================================================
-- HOT/COLD STORAGE: 1/5 — ENTITIES TABLE
-- Central lifecycle + routing registry for data tiering.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. ENTITIES TABLE
CREATE TABLE IF NOT EXISTS public.entities (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type   text        NOT NULL,
  storage_tier  text        NOT NULL DEFAULT 'hot',
  cold_provider text,
  cold_pointer  text,
  cold_batch_id text,
  cold_index    integer,
  metadata      jsonb       DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived_at   timestamptz
);

-- 2. CHECK CONSTRAINTS (Repair-Safe via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entities' AND constraint_name = 'chk_entities_storage_tier'
  ) THEN
    ALTER TABLE public.entities ADD CONSTRAINT chk_entities_storage_tier
      CHECK (storage_tier IN ('hot', 'cold'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entities' AND constraint_name = 'chk_entities_cold_provider'
  ) THEN
    ALTER TABLE public.entities ADD CONSTRAINT chk_entities_cold_provider
      CHECK (cold_provider IS NULL OR cold_provider IN ('gdrive', 's3', 'supabase_storage'));
  END IF;
END $$;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_entities_tier_created 
  ON public.entities (storage_tier, created_at);
CREATE INDEX IF NOT EXISTS idx_entities_type 
  ON public.entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_batch 
  ON public.entities (cold_batch_id) WHERE cold_batch_id IS NOT NULL;

-- 4. RLS (Enabled, admin-only for now — Edge Functions use service_role)
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Entities master_admin full access" ON public.entities;
CREATE POLICY "Entities master_admin full access" ON public.entities
  FOR ALL USING (public.is_master_admin());

DROP POLICY IF EXISTS "Entities service_role bypass" ON public.entities;
CREATE POLICY "Entities service_role bypass" ON public.entities
  FOR ALL USING (auth.role() = 'service_role');

-- 5. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
```

### Validation Script

```sql
-- 1. Verify table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'entities';

-- 2. Verify constraints
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'entities' AND constraint_type = 'CHECK';

-- 3. Verify indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'entities';

-- 4. Test insert (should succeed)
INSERT INTO public.entities (entity_type, storage_tier) 
VALUES ('test', 'hot') RETURNING id;

-- 5. Test constraint (should FAIL)
INSERT INTO public.entities (entity_type, storage_tier) 
VALUES ('test', 'warm'); -- ERROR: violates check constraint

-- 6. Cleanup
DELETE FROM public.entities WHERE entity_type = 'test';
```

### Rollback
```sql
DROP TABLE IF EXISTS public.entities CASCADE;
NOTIFY pgrst, 'reload schema';
```

---

## Phase 1B: Create `entity_type_registry` Table

### What to Create

**File**: `supabase/migrations/20260406000002_entity_type_registry.sql`

```sql
-- =========================================================================
-- HOT/COLD STORAGE: 2/5 — ENTITY TYPE REGISTRY
-- Configuration table for archival policies per entity type.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. REGISTRY TABLE
CREATE TABLE IF NOT EXISTS public.entity_type_registry (
  entity_type        text        NOT NULL PRIMARY KEY,
  display_name       text        NOT NULL,
  hot_table          text        NOT NULL,
  has_binary_assets  boolean     NOT NULL DEFAULT false,
  storage_bucket     text,                                 -- Supabase Storage bucket name (required if has_binary_assets = true)
  cold_provider      text        NOT NULL DEFAULT 'gdrive', -- which storage adapter to use for cold
  archive_after_days integer     NOT NULL DEFAULT 90,
  batch_size         integer     NOT NULL DEFAULT 25,
  enabled            boolean     NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

-- 2. CHECK CONSTRAINTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entity_type_registry' AND constraint_name = 'chk_registry_batch_size'
  ) THEN
    ALTER TABLE public.entity_type_registry ADD CONSTRAINT chk_registry_batch_size
      CHECK (batch_size BETWEEN 5 AND 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'entity_type_registry' AND constraint_name = 'chk_registry_archive_days'
  ) THEN
    ALTER TABLE public.entity_type_registry ADD CONSTRAINT chk_registry_archive_days
      CHECK (archive_after_days BETWEEN 1 AND 365);
  END IF;
END $$;

-- 3. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entity_type_registry_updated_at ON public.entity_type_registry;
CREATE TRIGGER trg_entity_type_registry_updated_at
  BEFORE UPDATE ON public.entity_type_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. RLS
ALTER TABLE public.entity_type_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Registry master_admin full access" ON public.entity_type_registry;
CREATE POLICY "Registry master_admin full access" ON public.entity_type_registry
  FOR ALL USING (public.is_master_admin());

DROP POLICY IF EXISTS "Registry service_role bypass" ON public.entity_type_registry;
CREATE POLICY "Registry service_role bypass" ON public.entity_type_registry
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Registry SELECT for authenticated" ON public.entity_type_registry;
CREATE POLICY "Registry SELECT for authenticated" ON public.entity_type_registry
  FOR SELECT TO authenticated USING (true);

-- 5. SEED DATA
INSERT INTO public.entity_type_registry
  (entity_type, display_name, hot_table, has_binary_assets, storage_bucket, cold_provider, archive_after_days, batch_size)
VALUES
  ('proof_of_work', 'Proof of Work Submissions', 'submissions', true, 'field-submissions', 'gdrive', 7, 25)
ON CONFLICT (entity_type) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  has_binary_assets  = EXCLUDED.has_binary_assets,
  storage_bucket     = EXCLUDED.storage_bucket,
  cold_provider      = EXCLUDED.cold_provider,
  updated_at         = now();
-- DO UPDATE (not DO NOTHING) so re-running the seed stays idempotent AND picks up config changes.

-- 6. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
```

### Validation Script

```sql
-- 1. Verify seed data
SELECT * FROM public.entity_type_registry;

-- 2. Test batch_size constraint (should FAIL)
INSERT INTO public.entity_type_registry (entity_type, display_name, hot_table, batch_size)
VALUES ('test_fail', 'Test', 'test', 200); -- ERROR: batch_size must be 5-100

-- 3. Test idempotency (run seed again, should no-op)
INSERT INTO public.entity_type_registry (entity_type, display_name, hot_table)
VALUES ('proof_of_work', 'Proof of Work Submissions', 'submissions')
ON CONFLICT (entity_type) DO NOTHING;
-- Should return 0 rows affected
```

### Rollback
```sql
DROP TABLE IF EXISTS public.entity_type_registry CASCADE;
NOTIFY pgrst, 'reload schema';
```

---

## Phase 1C: Link `submissions` to `entities`

### What to Create

**File**: `supabase/migrations/20260406000003_submissions_entity_link.sql`

```sql
-- =========================================================================
-- HOT/COLD STORAGE: 3/5 — SUBMISSIONS ↔ ENTITIES LINK
-- Adds entity_id FK to submissions for hot/cold routing.
-- Idempotent: Safe to re-run. Backward-compatible (nullable).
-- =========================================================================

DO $$
BEGIN
  -- 1. Add entity_id column (nullable — existing submissions are unaffected)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN entity_id uuid;
  END IF;

  -- 2. FK constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'submissions' AND constraint_name = 'submissions_entity_id_fkey'
  ) THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_entity_id_fkey
      FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Partial index (only index non-null values)
CREATE INDEX IF NOT EXISTS idx_submissions_entity_id 
  ON public.submissions (entity_id) WHERE entity_id IS NOT NULL;

-- 4. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
```

### Validation Script

```sql
-- 1. Verify column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'submissions' AND column_name = 'entity_id';

-- 2. Verify FK
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'submissions' AND constraint_name = 'submissions_entity_id_fkey';

-- 3. Verify existing submissions are unaffected
SELECT COUNT(*) FROM public.submissions WHERE entity_id IS NULL;
-- Should match total submission count

-- 4. Test FK enforcement
INSERT INTO public.submissions (task_id, submitted_by, entity_id)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff');
-- Should FAIL with FK violation (entity doesn't exist)
```

### Rollback
```sql
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_entity_id_fkey;
DROP INDEX IF EXISTS idx_submissions_entity_id;
ALTER TABLE public.submissions DROP COLUMN IF EXISTS entity_id;
NOTIFY pgrst, 'reload schema';
```

---

## Deployment Command

After creating all 3 migration files:

```bash
npx supabase db push --linked
```

Or for local development:

```bash
npx supabase db reset
```

---

## After Completion

Update the runbook (`.agent/runbooks/hot-cold-storage-runbook.md`):
1. Set Phase 1A/1B/1C status to `[x] DONE`
2. Fill in Chat ID and date
3. Mark validation checkboxes
4. Update File Registry status to `Created`

> [!IMPORTANT]
> **Cross-Phase Ordering**: The `archive_logs` table (Phase 9 migration) is referenced by the `entity-archive` Edge Function (Phase 6). You MUST apply Phase 9's migration **before** deploying Phase 6's Edge Function, or log writes will silently fail. Recommended migration deployment order:
> `1A → 1B → 1C → 9 (archive_logs) → 8 (cron, last)`
