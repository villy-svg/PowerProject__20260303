# Runbook 1.1 — Template Schema Extension

## Phase 1: Database Migrations & Schema Updates
## Subphase 1.1: Extend `daily_task_templates` with hierarchy columns

---

## Objective

Add two new columns to the existing `daily_task_templates` table:
1. `senior_manager_id` (UUID) — References which employee acts as the Senior Manager overseeing this template's generated tasks and their sub-tasks.
2. `has_sub_assignees` (BOOLEAN, DEFAULT false) — Toggle flag. When `true`, the generator knows to also create sub-tasks from the blueprint table.

---

## Prerequisites

- [ ] You have access to the Supabase project (staging first).
- [ ] You have read the [Database Migration Policy](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/database-migration-policy/SKILL.md).
- [ ] The current latest migration is `20260421110000_user_management_harden.sql`.

---

## Runbook 1.1.1: Create the Migration File

### Action
Create a new migration file at:
```
supabase/migrations/YYYYMMDDHHMMSS_daily_subtask_hierarchy_templates.sql
```
Use the current timestamp. Example: `20260422120000_daily_subtask_hierarchy_templates.sql`.

### Files Affected
| File | Action |
|---|---|
| `supabase/migrations/YYYYMMDDHHMMSS_daily_subtask_hierarchy_templates.sql` | **NEW** |

### SQL Content

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 1/6
-- Extends daily_task_templates with senior_manager_id and has_sub_assignees.
-- Idempotent. Safe to re-run.
-- =========================================================================

-- 1. Add senior_manager_id column
ALTER TABLE public.daily_task_templates
  ADD COLUMN IF NOT EXISTS senior_manager_id uuid;

-- 2. Add has_sub_assignees toggle
ALTER TABLE public.daily_task_templates
  ADD COLUMN IF NOT EXISTS has_sub_assignees boolean DEFAULT false;

-- 3. Foreign Key: senior_manager_id → employees(id)
-- Uses DO block for idempotent FK creation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'daily_task_templates_senior_manager_id_fkey'
  ) THEN
    ALTER TABLE public.daily_task_templates
      ADD CONSTRAINT daily_task_templates_senior_manager_id_fkey
      FOREIGN KEY (senior_manager_id)
      REFERENCES public.employees(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- 4. PostgreSQL Kick (mandatory per migration policy)
NOTIFY pgrst, 'reload schema';
```

---

## Runbook 1.1.2: Column-Level Design Rationale

This section exists so any future developer or model understands *why* these columns exist.

### `senior_manager_id`

| Property | Value | Why |
|---|---|---|
| Type | `uuid` | Matches `employees.id` type |
| Nullable | YES | Not all templates have a senior manager |
| FK Target | `employees(id)` | Must reference a valid employee |
| ON DELETE | `SET NULL` | If the manager employee is deleted, the template remains functional but loses its manager assignment |
| NOT VALID | YES | Skips validation of existing rows (no data has this column yet, so safe) |

### `has_sub_assignees`

| Property | Value | Why |
|---|---|---|
| Type | `boolean` | Binary toggle — either this template has sub-tasks or it doesn't |
| Default | `false` | Existing templates must not suddenly start generating sub-tasks |
| Nullable | NO (via DEFAULT) | Always has a value |

### Why NOT add `parent_template_id` here?

Templates are **blueprints**, not instances. A template doesn't "belong to" another template in a parent-child relationship. Instead, sub-task blueprints are stored in a **separate junction table** (`daily_task_template_subtasks`), created in [Runbook 1.2](./02_SUBTASK_BLUEPRINT_TABLE.md). This keeps the template table clean and prevents the generator from needing recursive template queries.

---

## Runbook 1.1.3: Deploy to Staging

### Action
```bash
# From project root
supabase db push --linked
```

If using the GitHub Actions pipeline:
1. Commit the new migration file.
2. Push to the `staging` branch.
3. The `staging-db.yml` workflow will run `supabase db push` against the staging project.

### Expected Output
```
Applying migration 20260422120000_daily_subtask_hierarchy_templates.sql...done
```

No errors. No warnings about existing columns (because of `IF NOT EXISTS`).

---

## Validation

### V1.1.1: Column Existence Check

Run this SQL against the staging database (Supabase SQL Editor or `psql`):

```sql
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_task_templates'
  AND column_name IN ('senior_manager_id', 'has_sub_assignees')
ORDER BY column_name;
```

**Expected Result:**

| column_name | data_type | column_default | is_nullable |
|---|---|---|---|
| `has_sub_assignees` | `boolean` | `false` | `YES` |
| `senior_manager_id` | `uuid` | `NULL` | `YES` |

### V1.1.2: Foreign Key Constraint Check

```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE conname = 'daily_task_templates_senior_manager_id_fkey';
```

**Expected Result:**

| conname | conrelid | confrelid |
|---|---|---|
| `daily_task_templates_senior_manager_id_fkey` | `daily_task_templates` | `employees` |

### V1.1.3: Existing Data Regression Check

Verify that existing templates are unaffected:

```sql
SELECT id, title, senior_manager_id, has_sub_assignees
FROM public.daily_task_templates
LIMIT 10;
```

**Expected**: All existing rows show `senior_manager_id = NULL` and `has_sub_assignees = false`. No rows were deleted or modified.

### V1.1.4: Idempotency Check

Run the migration again:
```bash
# This should succeed without errors
supabase db push --linked
```

The migration should be a no-op on re-run (all `IF NOT EXISTS` guards protect it).

### V1.1.5: PostgREST API Check

Verify the Supabase API reflects the new columns:

```bash
# Using curl or the Supabase client
curl -H "apikey: YOUR_ANON_KEY" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     "https://YOUR_PROJECT.supabase.co/rest/v1/daily_task_templates?select=senior_manager_id,has_sub_assignees&limit=1"
```

**Expected**: Returns JSON with the new columns. If you get a `406` error, the `NOTIFY pgrst, 'reload schema'` didn't execute — re-run it manually.

---

## Rollback Plan

If something goes wrong, these columns can be safely dropped without affecting existing functionality:

```sql
ALTER TABLE public.daily_task_templates DROP COLUMN IF EXISTS senior_manager_id;
ALTER TABLE public.daily_task_templates DROP COLUMN IF EXISTS has_sub_assignees;
NOTIFY pgrst, 'reload schema';
```

---

## Next Step

Proceed to → [Runbook 1.2: Sub-Task Blueprint Table](./02_SUBTASK_BLUEPRINT_TABLE.md)
