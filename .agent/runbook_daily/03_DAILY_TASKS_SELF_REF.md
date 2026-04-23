# Runbook 1.3 — Daily Tasks Self-Reference

## Phase 1: Database Migrations & Schema Updates
## Subphase 1.3: Add `parent_task_id` self-reference to `daily_tasks`

---

## Objective

Add a `parent_task_id` column to `daily_tasks` that self-references `daily_tasks(id)`. This mirrors the existing `tasks.parent_task` pattern exactly. Also add a `CHECK` constraint to prevent a row from being its own parent (infinite loop prevention).

---

## Prerequisites

- [ ] [Runbook 1.2](./02_SUBTASK_BLUEPRINT_TABLE.md) complete and validated.

---

## Column Design

| Column | Type | Default | Nullable | FK | ON DELETE |
|---|---|---|---|---|---|
| `parent_task_id` | uuid | NULL | YES | daily_tasks(id) | SET NULL |

**Critical safety constraint:**
```sql
CHECK (parent_task_id != id)
```
This prevents a daily task from referencing itself, which would create a 1-row infinite loop.

**Why `parent_task_id` and not `parent_task`?**
The main `tasks` table uses `parent_task`. We use `parent_task_id` to follow the `daily_tasks` naming convention (snake_case with `_id` suffix for FKs: `hub_id`, `client_id`, etc.) and to avoid confusion between the two tables.

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_daily_tasks_self_reference.sql`

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 3/6
-- Adds parent_task_id self-reference to daily_tasks.
-- =========================================================================

-- 1. Add the column
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid;

-- 2. Self-referencing FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_tasks_parent_task_id_fkey'
  ) THEN
    ALTER TABLE public.daily_tasks
      ADD CONSTRAINT daily_tasks_parent_task_id_fkey
      FOREIGN KEY (parent_task_id)
      REFERENCES public.daily_tasks(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 3. Anti-self-reference constraint (infinite loop prevention)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_tasks_no_self_parent'
  ) THEN
    ALTER TABLE public.daily_tasks
      ADD CONSTRAINT daily_tasks_no_self_parent
      CHECK (parent_task_id IS NULL OR parent_task_id != id)
      NOT VALID;
  END IF;
END $$;

-- 4. Index: fast child lookup by parent
CREATE INDEX IF NOT EXISTS idx_daily_tasks_parent_task_id
  ON public.daily_tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

-- 5. PostgreSQL Kick
NOTIFY pgrst, 'reload schema';
```

---

## Validation

### V1.3.1: Column exists
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_tasks' AND column_name = 'parent_task_id';
```
Expected: `uuid`, `YES`.

### V1.3.2: FK constraint
```sql
SELECT conname, confrelid::regclass
FROM pg_constraint
WHERE conname = 'daily_tasks_parent_task_id_fkey';
```
Expected: target = `daily_tasks` (self-reference).

### V1.3.3: CHECK constraint
```sql
SELECT conname, consrc
FROM pg_constraint
WHERE conname = 'daily_tasks_no_self_parent';
```
Expected: constraint exists.

### V1.3.4: Anti-self-reference test
```sql
-- This MUST fail:
INSERT INTO public.daily_tasks (text, vertical_id, parent_task_id)
VALUES ('SELF_REF_TEST', 'CHARGING_HUBS', gen_random_uuid());
-- First insert (parent_task_id is a random UUID that doesn't exist) → FK violation

-- Correct test: insert, then try to set parent_task_id = own id
INSERT INTO public.daily_tasks (text, vertical_id)
VALUES ('SELF_REF_TEST', 'CHARGING_HUBS') RETURNING id;

UPDATE public.daily_tasks
SET parent_task_id = id
WHERE text = 'SELF_REF_TEST';
-- Expected: ERROR violating CHECK constraint "daily_tasks_no_self_parent"

-- Cleanup
DELETE FROM public.daily_tasks WHERE text = 'SELF_REF_TEST';
```

### V1.3.5: Parent-child relationship test
```sql
-- Insert parent
INSERT INTO public.daily_tasks (text, vertical_id)
VALUES ('PARENT_TEST', 'CHARGING_HUBS') RETURNING id;
-- Use returned ID below

INSERT INTO public.daily_tasks (text, vertical_id, parent_task_id)
VALUES ('CHILD_TEST', 'CHARGING_HUBS', 'PARENT_ID_HERE') RETURNING id;

-- Verify relationship
SELECT dt.id, dt.text, dt.parent_task_id, p.text AS parent_text
FROM public.daily_tasks dt
LEFT JOIN public.daily_tasks p ON p.id = dt.parent_task_id
WHERE dt.text IN ('PARENT_TEST', 'CHILD_TEST');

-- Expected: CHILD_TEST has parent_task_id pointing to PARENT_TEST

-- Test ON DELETE SET NULL: delete parent
DELETE FROM public.daily_tasks WHERE text = 'PARENT_TEST';

SELECT parent_task_id FROM public.daily_tasks WHERE text = 'CHILD_TEST';
-- Expected: parent_task_id = NULL (SET NULL worked, child not deleted)

-- Cleanup
DELETE FROM public.daily_tasks WHERE text = 'CHILD_TEST';
```

### V1.3.6: Existing data regression
```sql
SELECT COUNT(*) FROM public.daily_tasks WHERE parent_task_id IS NOT NULL;
```
Expected: `0` (no existing rows should have a parent).

### V1.3.7: Partial index check
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'daily_tasks' AND indexname = 'idx_daily_tasks_parent_task_id';
```
Expected: 1 row. The `WHERE parent_task_id IS NOT NULL` filter keeps the index small.

---

## Deep Dive: Infinite Loop Prevention Strategy

Self-referencing tables can create **circular chains** (A→B→C→A). The CHECK constraint only prevents direct self-reference (A→A). For deeper loops:

**Current approach (Phase 1 — simple):** The CHECK prevents depth-0 loops. The generator (Phase 2) only creates depth-1 hierarchies (parent + direct children). Multi-level nesting is not supported in the generator, so circular chains cannot be created by the automated system.

**Future hardening (optional):** If manual re-parenting is ever allowed in the UI, add a `BEFORE UPDATE` trigger that walks up the chain to detect cycles:

```sql
-- FUTURE: Only implement if manual re-parenting is added
CREATE OR REPLACE FUNCTION prevent_daily_task_cycle()
RETURNS TRIGGER AS $$
DECLARE
  v_current uuid := NEW.parent_task_id;
  v_depth integer := 0;
BEGIN
  WHILE v_current IS NOT NULL AND v_depth < 10 LOOP
    IF v_current = NEW.id THEN
      RAISE EXCEPTION 'Circular parent reference detected for daily_task %', NEW.id;
    END IF;
    SELECT parent_task_id INTO v_current FROM public.daily_tasks WHERE id = v_current;
    v_depth := v_depth + 1;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This is NOT included in Phase 1 because the generator only creates flat parent→child relationships.

---

## Rollback
```sql
ALTER TABLE public.daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_no_self_parent;
ALTER TABLE public.daily_tasks DROP CONSTRAINT IF EXISTS daily_tasks_parent_task_id_fkey;
DROP INDEX IF EXISTS idx_daily_tasks_parent_task_id;
ALTER TABLE public.daily_tasks DROP COLUMN IF EXISTS parent_task_id;
NOTIFY pgrst, 'reload schema';
```

## Next → [Runbook 2.1: Generator Function Update](./04_GENERATOR_UPDATE.md)
