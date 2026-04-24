# Runbook 1.2 — Migrate Existing Hub Data

## Phase 1: Multi-Hub Database Support
## Subphase 1.2: Populate `task_context_links` with existing `hub_id` values

---

## Objective

Copy every existing non-null `hub_id` from `tasks`, `daily_tasks`, and `daily_task_templates` into the `task_context_links` table as `entity_type = 'hub'` links. This ensures all existing tasks are "multi-hub ready" without losing any data.

---

## Prerequisites

- [ ] [Runbook 1.1](./01_HUB_CONTEXT_LINKS.md) complete and validated.

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_migrate_hub_data_to_links.sql`

```sql
-- =========================================================================
-- POWERPROJECT: MULTI-HUB SUPPORT — STEP 2
-- Migrates existing scalar hub_id values into task_context_links.
-- ON CONFLICT DO NOTHING ensures idempotency (safe to re-run).
-- =========================================================================

-- tasks.hub_id → hub links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'task', id, 'hub', hub_id
FROM public.tasks
WHERE hub_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_tasks.hub_id → hub links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'hub', hub_id
FROM public.daily_tasks
WHERE hub_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_task_templates.hub_id → hub links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'hub', hub_id
FROM public.daily_task_templates
WHERE hub_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
```

---

## What This Does NOT Do

- Does **NOT** drop the `hub_id` column from any table. It remains as the backward-compatible "primary hub" reference.
- Does **NOT** modify any existing rows.
- Does **NOT** change any FK constraints.

The scalar `hub_id` column will continue to be written by existing code. New multi-hub code will read/write via `task_context_links`.

---

## Validation

### V1.2.1: Count verification
```sql
-- Count tasks with hub_id
SELECT COUNT(*) AS tasks_with_hub FROM public.tasks WHERE hub_id IS NOT NULL;

-- Count corresponding hub links
SELECT COUNT(*) AS hub_links FROM public.task_context_links
WHERE source_type = 'task' AND entity_type = 'hub';

-- These counts should match
```

### V1.2.2: Same check for daily_tasks
```sql
SELECT COUNT(*) FROM public.daily_tasks WHERE hub_id IS NOT NULL;
SELECT COUNT(*) FROM public.task_context_links
WHERE source_type = 'daily_task' AND entity_type = 'hub';
```

### V1.2.3: Same check for templates
```sql
SELECT COUNT(*) FROM public.daily_task_templates WHERE hub_id IS NOT NULL;
SELECT COUNT(*) FROM public.task_context_links
WHERE source_type = 'template' AND entity_type = 'hub';
```

### V1.2.4: Spot check — verify a specific task's hub link
```sql
SELECT t.id, t.text, t.hub_id AS scalar_hub,
       tcl.entity_id AS linked_hub,
       h.name AS hub_name
FROM public.tasks t
JOIN public.task_context_links tcl
  ON tcl.source_id = t.id
  AND tcl.source_type = 'task'
  AND tcl.entity_type = 'hub'
JOIN public.hubs h ON h.id = tcl.entity_id
WHERE t.hub_id IS NOT NULL
LIMIT 5;
```
Expected: `scalar_hub` = `linked_hub` for every row.

### V1.2.5: Computed relationship now returns data
```sql
SELECT t.id, t.text, h.name
FROM public.tasks t, LATERAL public.hubs(t) h
LIMIT 5;
```
Expected: Returns task-hub pairs.

### V1.2.6: Idempotency check
Run the migration again. Expected: 0 new rows inserted (all `ON CONFLICT DO NOTHING`).

---

## Rollback
```sql
-- Remove hub links (preserves all other link types)
DELETE FROM public.task_context_links WHERE entity_type = 'hub';
```

---

## Next → [Runbook 2.1: Consolidate Tables](./03_CONSOLIDATE_TABLES.md)
