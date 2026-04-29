# Runbook 3.2 — Performance Indexes

## Phase 3: Row Level Security & Performance
## Subphase 3.2: Add indexes to support hierarchy queries

---

## Objective

Add database indexes to ensure that hierarchy queries (parent lookup, child listing, senior manager resolution) perform well as data grows.

---

## Prerequisites

- [ ] All Phase 1, 2, and 3.1 runbooks complete.

---

## Index Plan

| Index | Table | Column(s) | Type | Purpose |
|---|---|---|---|---|
| `idx_daily_tasks_parent_task_id` | `daily_tasks` | `parent_task_id` | Partial (WHERE NOT NULL) | Already created in Runbook 1.3 |
| `idx_daily_tasks_assigned_to` | `daily_tasks` | `assigned_to` | B-tree | Speed up RLS `assigned_to = auth.uid()` checks |
| `idx_daily_tasks_scheduled_date` | `daily_tasks` | `scheduled_date` | B-tree | Speed up date-filtered board queries |
| `idx_daily_tasks_vertical_id` | `daily_tasks` | `vertical_id` | B-tree | Speed up RLS vertical permission checks |
| `idx_dtt_subtasks_parent_template_id` | `daily_task_template_subtasks` | `parent_template_id` | B-tree | Already created in Runbook 1.2 |
| `idx_dtt_senior_manager_id` | `daily_task_templates` | `senior_manager_id` | Partial (WHERE NOT NULL) | Speed up senior manager policy lookups |

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_daily_hierarchy_indexes.sql`

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 6/6
-- Performance indexes for hierarchy queries.
-- =========================================================================

-- daily_tasks indexes
CREATE INDEX IF NOT EXISTS idx_daily_tasks_assigned_to
  ON public.daily_tasks (assigned_to);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_scheduled_date
  ON public.daily_tasks (scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_vertical_id
  ON public.daily_tasks (vertical_id);

-- Composite index for common board query pattern
CREATE INDEX IF NOT EXISTS idx_daily_tasks_board_query
  ON public.daily_tasks (vertical_id, scheduled_date, stage_id);

-- daily_task_templates index for senior manager lookup
CREATE INDEX IF NOT EXISTS idx_dtt_senior_manager_id
  ON public.daily_task_templates (senior_manager_id)
  WHERE senior_manager_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
```

---

## Validation

### V3.2.1: All indexes exist
```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND (tablename = 'daily_tasks' OR tablename = 'daily_task_templates'
       OR tablename = 'daily_task_template_subtasks')
ORDER BY tablename, indexname;
```
Expected: All indexes listed above present.

### V3.2.2: Query plan check
```sql
EXPLAIN ANALYZE
SELECT * FROM public.daily_tasks
WHERE vertical_id = 'CHARGING_HUBS'
  AND scheduled_date = CURRENT_DATE
  AND stage_id = 'TODO';
```
Expected: Uses `idx_daily_tasks_board_query` (Index Scan or Bitmap Index Scan).

---

## Rollback
```sql
DROP INDEX IF EXISTS idx_daily_tasks_assigned_to;
DROP INDEX IF EXISTS idx_daily_tasks_scheduled_date;
DROP INDEX IF EXISTS idx_daily_tasks_vertical_id;
DROP INDEX IF EXISTS idx_daily_tasks_board_query;
DROP INDEX IF EXISTS idx_dtt_senior_manager_id;
```

## Next → [Runbook 4.1: Template Service Extension](./07_TEMPLATE_SERVICE.md)
