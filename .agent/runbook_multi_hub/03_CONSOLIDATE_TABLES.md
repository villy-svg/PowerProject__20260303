# Runbook 2.1 — Consolidate daily_tasks into tasks

## Phase 2: Table Consolidation
## Subphase 2.1: Merge `daily_tasks` into `tasks` and retire the table

---

## Objective

Move all rows from `daily_tasks` into the `tasks` table, using the `task_board` JSONB column to tag them as daily-board tasks. Then drop the `daily_tasks` table. After this runbook, there is only ONE task table.

---

## Prerequisites

- [ ] [Runbook 1.2](./02_MIGRATE_HUB_DATA.md) complete and validated.
- [ ] All existing `daily_tasks` hub links are in `task_context_links`.

---

## Column Mapping

The `daily_tasks` table has columns that don't exist on `tasks`, and vice versa. Here is the exact mapping:

| daily_tasks column | tasks column | Notes |
|---|---|---|
| `id` | `id` | Direct copy |
| `text` | `text` | Direct copy |
| `description` | `description` | Direct copy |
| `priority` | `priority` | Direct copy |
| `stage_id` | `stage_id` | Direct copy (already snake_case) |
| `vertical_id` | `vertical_id` | Direct copy |
| `hub_id` | `hub_id` | Direct copy |
| `city` | `city` | Direct copy |
| `function_name` | `function` | **Name difference!** `daily_tasks` uses `function_name`, `tasks` uses `function` |
| `assigned_to` | `assigned_to` | Direct copy |
| `client_id` | — | Stored in `task_context_links` (already migrated by 20260423102600) |
| `employee_id` | — | Stored in `task_context_links` |
| `partner_id` | — | Stored in `task_context_links` |
| `vendor_id` | — | Stored in `task_context_links` |
| `created_at` | `created_at` | Direct copy |
| `updated_at` | `updated_at` | Direct copy |
| `created_by` | `created_by` | Direct copy |
| `last_updated_by` | `last_updated_by` | Direct copy |
| `submission_by` | — | Goes into `metadata` JSONB |
| `scheduled_date` | — | **DROPPED** per user decision |
| `is_recurring` | — | **DROPPED** per user decision |
| `task_board` | `task_board` | Direct copy (will contain `["DAILY"]`) |
| `metadata` | `metadata` | Direct copy |
| — | `parent_task_id` | Set to NULL for migrated tasks |
| — | `user_id` | Set to `created_by` |

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_consolidate_daily_into_tasks.sql`

```sql
-- =========================================================================
-- POWERPROJECT: TABLE CONSOLIDATION
-- Merges daily_tasks into tasks and retires the daily_tasks table.
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: INSERT daily_tasks rows into tasks
-- ON CONFLICT DO NOTHING prevents duplicates if re-run.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.tasks (
    id, text, description, priority, stage_id, vertical_id,
    hub_id, city, "function", assigned_to,
    parent_task_id, user_id, created_by, last_updated_by,
    task_board, metadata,
    created_at, updated_at
)
SELECT
    dt.id,
    dt.text,
    dt.description,
    dt.priority,
    dt.stage_id,
    dt.vertical_id,
    dt.hub_id,
    dt.city,
    dt.function_name,        -- maps to tasks.function
    dt.assigned_to,
    NULL,                     -- parent_task_id (no parent for migrated tasks)
    dt.created_by,            -- user_id
    dt.created_by,
    dt.last_updated_by,
    COALESCE(dt.task_board, '["DAILY"]'::jsonb),  -- tag as DAILY board
    CASE
        WHEN dt.submission_by IS NOT NULL
        THEN jsonb_build_object('submission_by', dt.submission_by) || COALESCE(dt.metadata, '{}'::jsonb)
        ELSE COALESCE(dt.metadata, '{}'::jsonb)
    END,
    dt.created_at,
    dt.updated_at
FROM public.daily_tasks dt
ON CONFLICT (id) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2: UPDATE task_context_links — change source_type from
-- 'daily_task' to 'task' for all migrated rows.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.task_context_links
SET source_type = 'task'
WHERE source_type = 'daily_task'
  AND source_id IN (SELECT id FROM public.tasks);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: UPDATE computed relationships — drop daily_tasks overloads
-- (the hubs() and assignees() functions for daily_tasks are no longer needed)
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.assignees(public.daily_tasks);
DROP FUNCTION IF EXISTS public.hubs(public.daily_tasks);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: DROP daily_tasks table and all dependent objects
-- CASCADE drops: FKs, triggers, RLS policies, indexes
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.daily_tasks CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5: ENSURE tasks RLS covers all migrated rows
-- The existing tasks RLS uses vertical_id, which daily_tasks also had.
-- No RLS changes needed — the policies from 20260423102600 already cover it.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
```

---

## Critical Implementation Notes

### 1. UUID Collision Safety
`daily_tasks` and `tasks` both use `gen_random_uuid()` for IDs. The probability of collision is astronomically low, but `ON CONFLICT (id) DO NOTHING` protects against it.

### 2. `task_board` Tagging
Migrated daily tasks get `task_board = '["DAILY"]'`. This is how the frontend will filter "show me daily tasks" vs "show me project tasks". The UI will use:
```javascript
const isDailyTask = (task) => task.task_board?.includes('DAILY');
```

### 3. `submission_by` → `metadata`
The `submission_by` column only existed on `daily_tasks`. Rather than adding it to `tasks`, we store it in the `metadata` JSONB. Access pattern:
```javascript
const submissionBy = task.metadata?.submission_by || null;
```

### 4. `function_name` → `function`
The `daily_tasks` table used `function_name` while `tasks` uses `function`. The migration handles this mapping in the INSERT.

---

## Validation

### V2.1.1: Row count verification
```sql
-- Before running: count daily_tasks
-- SELECT COUNT(*) FROM public.daily_tasks;
-- After running: verify same count added to tasks
SELECT COUNT(*) FROM public.tasks WHERE task_board @> '["DAILY"]'::jsonb;
```
Expected: Matches the pre-migration daily_tasks count.

### V2.1.2: daily_tasks table is gone
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'daily_tasks';
```
Expected: 0 rows.

### V2.1.3: Context links updated
```sql
SELECT COUNT(*) FROM public.task_context_links WHERE source_type = 'daily_task';
```
Expected: 0 (all changed to 'task').

### V2.1.4: Spot check — verify a migrated task
```sql
SELECT id, text, stage_id, vertical_id, task_board, metadata
FROM public.tasks
WHERE task_board @> '["DAILY"]'::jsonb
LIMIT 5;
```
Expected: Shows migrated tasks with DAILY tag and any submission_by in metadata.

### V2.1.5: Computed relationships still work
```sql
-- assignees should still resolve for migrated tasks
SELECT t.id, a.full_name
FROM public.tasks t, LATERAL public.assignees(t) a
WHERE t.task_board @> '["DAILY"]'::jsonb
LIMIT 5;
```

### V2.1.6: Hubs relationship works for migrated tasks
```sql
SELECT t.id, h.name
FROM public.tasks t, LATERAL public.hubs(t) h
WHERE t.task_board @> '["DAILY"]'::jsonb
LIMIT 5;
```

---

## Rollback

**WARNING**: This is a destructive migration. To rollback, you would need to:
1. Re-create the `daily_tasks` table from `20260101000001_tables.sql`.
2. Move rows back from `tasks` where `task_board @> '["DAILY"]'`.
3. Re-create the computed functions.

It is strongly recommended to **backup `daily_tasks` before running** this migration:
```sql
CREATE TABLE public.daily_tasks_backup AS SELECT * FROM public.daily_tasks;
```

---

## Next → [Runbook 3.1: Template Multi-Hub](./04_TEMPLATE_MULTI_HUB.md)
