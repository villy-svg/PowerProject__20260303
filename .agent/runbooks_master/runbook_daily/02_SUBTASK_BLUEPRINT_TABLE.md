# Runbook 1.2 — Sub-Task Blueprint Table

## Phase 1: Database Migrations & Schema Updates
## Subphase 1.2: Create `daily_task_template_subtasks` junction table

---

## Objective

Create a new table `daily_task_template_subtasks` that stores sub-task blueprints attached to a master template. When the generator fires a master template with `has_sub_assignees = true`, it reads this table to create linked sub-tasks.

---

## Prerequisites

- [ ] [Runbook 1.1](./01_TEMPLATE_SCHEMA.md) complete and validated.

---

## Table Design

```
daily_task_templates (1) ──→ daily_task_template_subtasks (N)
                                       │ assigned_to (FK)
                                       ▼
                                   employees
```

| Column | Type | Default | Nullable | Purpose |
|---|---|---|---|---|
| `id` | uuid | gen_random_uuid() | NO (PK) | Unique ID |
| `parent_template_id` | uuid | — | NO | FK → daily_task_templates(id) ON DELETE CASCADE |
| `title` | text | — | NO | Sub-task title for generated instance |
| `description` | text | — | YES | Optional description |
| `assigned_to` | uuid | — | YES | FK → employees(id) ON DELETE SET NULL |
| `priority` | text | 'Medium' | YES | Default priority |
| `sort_order` | integer | 0 | YES | Display ordering |
| `is_active` | boolean | true | YES | Enable/disable individual sub-blueprints |
| `created_at` | timestamptz | now() | YES | Timestamp |
| `updated_at` | timestamptz | now() | YES | Timestamp |
| `created_by` | uuid | — | YES | FK → auth.users(id) |

**Key decisions:**
- CASCADE delete when parent template is deleted (cleanup orphans).
- No `vertical_id` — inherited from parent template.
- No `frequency` — sub-tasks fire when parent fires.

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_daily_subtask_blueprint_table.sql`

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 2/6
-- Creates the daily_task_template_subtasks blueprint table.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.daily_task_template_subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_template_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  priority text DEFAULT 'Medium'::text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtt_subtasks_parent_template_id_fkey') THEN
    ALTER TABLE public.daily_task_template_subtasks
      ADD CONSTRAINT dtt_subtasks_parent_template_id_fkey
      FOREIGN KEY (parent_template_id) REFERENCES public.daily_task_templates(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtt_subtasks_assigned_to_fkey') THEN
    ALTER TABLE public.daily_task_template_subtasks
      ADD CONSTRAINT dtt_subtasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.employees(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dtt_subtasks_created_by_fkey') THEN
    ALTER TABLE public.daily_task_template_subtasks
      ADD CONSTRAINT dtt_subtasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dtt_subtasks_parent_template_id
  ON public.daily_task_template_subtasks (parent_template_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dtt_subtasks_modtime') THEN
    CREATE TRIGGER update_dtt_subtasks_modtime
      BEFORE UPDATE ON public.daily_task_template_subtasks
      FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
  END IF;
END $$;

ALTER TABLE public.daily_task_template_subtasks ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
```

---

## Validation

### V1.2.1: Table exists
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'daily_task_template_subtasks';
```
Expected: 1 row.

### V1.2.2: All 11 columns present
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'daily_task_template_subtasks' ORDER BY ordinal_position;
```

### V1.2.3: FK constraints
```sql
SELECT conname, confrelid::regclass, confdeltype FROM pg_constraint
WHERE conrelid = 'public.daily_task_template_subtasks'::regclass AND contype = 'f';
```
Expected: 3 FKs (CASCADE, SET NULL, NO ACTION).

### V1.2.4: CASCADE delete test
```sql
-- Insert test parent
INSERT INTO public.daily_task_templates (title, vertical_id, frequency)
VALUES ('CASCADE_TEST', 'CHARGING_HUBS', 'DAILY') RETURNING id;
-- Insert sub-blueprints (use returned ID)
-- Delete parent → verify sub-blueprints are gone
```

### V1.2.5: RLS enabled
```sql
SELECT relrowsecurity FROM pg_class WHERE relname = 'daily_task_template_subtasks';
```
Expected: `true` (policies added in Runbook 3.1).

---

## Rollback
```sql
DROP TABLE IF EXISTS public.daily_task_template_subtasks CASCADE;
NOTIFY pgrst, 'reload schema';
```

## Next → [Runbook 1.3: Daily Tasks Self-Reference](./03_DAILY_TASKS_SELF_REF.md)
