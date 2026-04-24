# Runbook 1.1 — Hub Context Links

## Phase 1: Multi-Hub Database Support
## Subphase 1.1: Add `hub` entity_type support + computed `hubs()` relationship

---

## Objective

Enable the `task_context_links` table to store hub relationships using `entity_type = 'hub'`, and create a PostgREST computed relationship function `hubs()` so the frontend can do `.select('*, hubs(id, name, hub_code, city)')`.

---

## Prerequisites

- [x] Migration `20260423102600_standardize_task_schemas.sql` deployed.
- [x] `task_context_links` table exists with indexes.
- [x] `assignees()` computed functions exist as the pattern to follow.

---

## What Changes

The `task_context_links` table already supports any `entity_type` string — no schema change is needed. We only need to:
1. Create `hubs()` computed relationship functions for `tasks`, `daily_tasks`, and `daily_task_templates`.
2. Add a `hub_lookup` index for fast reverse lookups.

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_hub_context_links.sql`

```sql
-- =========================================================================
-- POWERPROJECT: MULTI-HUB SUPPORT — STEP 1
-- Adds computed PostgREST relationships for hub links.
-- Pattern mirrors the existing assignees() functions exactly.
-- Idempotent (CREATE OR REPLACE).
-- =========================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: COMPUTED RELATIONSHIPS — hubs() for each task archetype
-- Allows: .select('*, hubs(id, name, hub_code, city)')
-- ═══════════════════════════════════════════════════════════════════════════

-- hubs() for tasks
CREATE OR REPLACE FUNCTION public.hubs(t public.tasks)
RETURNS SETOF public.hubs AS $$
    SELECT h.* FROM public.hubs h
    JOIN public.task_context_links tcl ON tcl.entity_id = h.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'task'
      AND tcl.entity_type = 'hub';
$$ LANGUAGE sql STABLE;

-- hubs() for daily_tasks (needed until table consolidation in Phase 2)
CREATE OR REPLACE FUNCTION public.hubs(t public.daily_tasks)
RETURNS SETOF public.hubs AS $$
    SELECT h.* FROM public.hubs h
    JOIN public.task_context_links tcl ON tcl.entity_id = h.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'daily_task'
      AND tcl.entity_type = 'hub';
$$ LANGUAGE sql STABLE;

-- hubs() for daily_task_templates
CREATE OR REPLACE FUNCTION public.hubs(t public.daily_task_templates)
RETURNS SETOF public.hubs AS $$
    SELECT h.* FROM public.hubs h
    JOIN public.task_context_links tcl ON tcl.entity_id = h.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'template'
      AND tcl.entity_type = 'hub';
$$ LANGUAGE sql STABLE;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2: INDEX — Fast hub lookup
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tcl_hub_lookup
    ON public.task_context_links (entity_id)
    WHERE entity_type = 'hub';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: RLS UPDATE — Allow 'hub' entity_type through existing policies
-- ═══════════════════════════════════════════════════════════════════════════
-- No RLS changes needed. The existing tcl policies check source_type
-- ('task', 'daily_task', 'template') and verify access via the parent
-- task's vertical_id. Hub links will be covered automatically because
-- they share the same source_id as the task.


-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
```

---

## Design Rationale

### Why computed functions instead of a direct FK?
`task_context_links.entity_id` is a generic UUID — it could point to `employees`, `hubs`, `clients`, etc. PostgreSQL cannot have a single FK that references multiple tables. PostgREST computed relationships solve this by letting us define type-safe join functions.

### Why `STABLE` (not `IMMUTABLE`)?
The function reads from tables, so it's `STABLE` (same result within a single statement but can change between statements). `IMMUTABLE` would be incorrect and could cause stale cached results.

### Pattern consistency with `assignees()`
The existing `assignees()` functions (from migration `20260423102600`, Section 8) use this exact same pattern:
```sql
CREATE OR REPLACE FUNCTION public.assignees(t public.tasks)
RETURNS SETOF public.employees AS $$
    SELECT e.* FROM public.employees e
    JOIN public.task_context_links tcl ON tcl.entity_id = e.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'task'
      AND tcl.entity_type = 'assignee';
$$ LANGUAGE sql STABLE;
```
Our `hubs()` function is identical except it joins `hubs` and filters `entity_type = 'hub'`.

---

## Validation

### V1.1.1: Functions exist
```sql
SELECT proname FROM pg_proc
WHERE proname = 'hubs'
  AND proargtypes::text LIKE '%tasks%' OR proargtypes::text LIKE '%daily%';
```
Expected: 3 rows (one for each archetype).

### V1.1.2: Index exists
```sql
SELECT indexname FROM pg_indexes
WHERE indexname = 'idx_tcl_hub_lookup';
```
Expected: 1 row.

### V1.1.3: PostgREST join works (after data migration in 1.2)
```bash
# After inserting a test hub link, verify the API resolves it:
curl -H "apikey: ANON_KEY" \
     "https://PROJECT.supabase.co/rest/v1/tasks?select=*,hubs(id,name)&limit=1"
```
Expected: Returns JSON with embedded `hubs` array. If you get a 406, run `NOTIFY pgrst, 'reload schema'` manually.

### V1.1.4: Manual link test
```sql
-- Insert a test hub link
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'task', t.id, 'hub', (SELECT id FROM public.hubs LIMIT 1)
FROM public.tasks t
LIMIT 1
ON CONFLICT DO NOTHING;

-- Verify it appears via computed relationship
SELECT t.id, t.text, h.name AS hub_name
FROM public.tasks t, LATERAL public.hubs(t) h
LIMIT 5;
```
Expected: At least 1 row showing a task with its linked hub name.

---

## Rollback
```sql
DROP FUNCTION IF EXISTS public.hubs(public.tasks);
DROP FUNCTION IF EXISTS public.hubs(public.daily_tasks);
DROP FUNCTION IF EXISTS public.hubs(public.daily_task_templates);
DROP INDEX IF EXISTS idx_tcl_hub_lookup;
NOTIFY pgrst, 'reload schema';
```

---

## Next → [Runbook 1.2: Migrate Hub Data](./02_MIGRATE_HUB_DATA.md)
