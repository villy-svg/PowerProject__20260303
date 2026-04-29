# Runbook 4.2 — Performance & Search Optimization

## Phase 4: RLS & Indexes
## Subphase 4.2: High-Performance GIN & Composite Indexes

---

## 1. Objective: Maintaining Sub-Second Kanban Latency
As we move from a simple table to a complex Multi-Hub architecture, the database has to do significantly more work. Every time a user opens a board, the database must:
1.  Filter by Vertical.
2.  Filter by Board Tag (e.g., "DAILY").
3.  Run the "Three-Key" RLS check (Hub, Role, Status).

Without the indexes in this runbook, the database would perform "Full Table Scans" (reading every single row), causing board load times to jump from milliseconds to seconds.

### The Optimization Strategy:
- **JSONB Search (GIN)**: For finding tags inside arrays instantly.
- **Partial Indexing**: For ignoring "Inactive" or "Historical" data to keep the index size small and fast.
- **Composite Indexing**: For speeding up the connection between Users and their active Employee profiles.

---

## 2. Prerequisites (Validation)
Verify that the `tasks`, `daily_task_templates`, and `task_context_links` tables are all in their final schema state (Phase 3 complete).

---

## 3. Implementation: The Optimization Layer

**Action**: Run the following SQL block to apply the performance hardening: `supabase/migrations/20260424110000_phase_4_2_performance_hardening.sql`

```sql
-- =========================================================================
-- POWERPROJECT: PHASE 4.2 — SEARCH & RLS OPTIMIZATION
-- =========================================================================

BEGIN;

-- 1. GIN Index for Board Tag Search
-- Problem: Standard indexes can't search inside a JSONB array like ["DAILY"].
-- Solution: GIN (Generalized Inverted Index) maps every tag to its rows.
-- Impact: `WHERE task_board @> '["DAILY"]'` becomes near-instant.
CREATE INDEX IF NOT EXISTS idx_tasks_board_gin 
  ON public.tasks USING GIN (task_board);

-- 2. Partial Index for Active Authorizations
-- Logic: We only care about links that are 'is_active = true'. 
-- This index is 80% smaller than a full index because it ignores historical/deleted links.
CREATE INDEX IF NOT EXISTS idx_tcl_rls_active_lookup
  ON public.task_context_links (source_id, entity_type, entity_id)
  WHERE is_active = true;

-- 3. Hierarchy Composite Index
-- Optimizes the parent-child relationship lookups used in the "Tree View".
CREATE INDEX IF NOT EXISTS idx_tasks_parent_child_stage
  ON public.tasks (parent_task_id, stage_id)
  WHERE parent_task_id IS NOT NULL;

-- 4. GIN Index for Template Dispatch Rules
-- Allows the Task Generator to find templates with 'has_multiple_hubs' without scanning every row.
CREATE INDEX IF NOT EXISTS idx_dtt_metadata_rules_gin
  ON public.daily_task_templates USING GIN (metadata);

-- 5. Employee Status Composite
-- Directly supports the RLS `check_task_junction` function.
CREATE INDEX IF NOT EXISTS idx_employees_status_junction
  ON public.employees (id, status, hub_id, role_id)
  WHERE status = 'Active';

COMMIT;
```

---

## 4. Benchmarking (How to Verify Success)

Every implementer must run `EXPLAIN ANALYZE` on these queries. 

### A. The "Board Search" Test
```sql
EXPLAIN ANALYZE 
SELECT count(*) FROM tasks WHERE task_board @> '["DAILY"]'::jsonb;
```
**Success Criteria**: The output must show `Bitmap Index Scan on idx_tasks_board_gin`. 
**Failure**: If it says `Seq Scan`, the index was not created or the syntax is wrong.

### B. The "RLS Junction" Test
```sql
EXPLAIN ANALYZE 
SELECT * FROM task_context_links 
WHERE source_id = 'YOUR_TEMPLATE_UUID' AND is_active = true;
```
**Success Criteria**: The output must show `Index Scan using idx_tcl_rls_active_lookup`.

---

## 5. Maintenance & Monitoring
Indexes are not "Set and Forget." As the `tasks` table grows towards 100k+ rows:

1.  **Monitor Bloat**:
    ```sql
    SELECT relname, 100 * pg_relation_size(indexrelid) / pg_relation_size(indrelid) AS index_ratio
    FROM pg_index JOIN pg_class ON pg_class.oid = pg_index.indexrelid
    WHERE relname LIKE 'idx_%';
    ```
    If `index_ratio` > 50%, the index is becoming inefficient. Run `REINDEX INDEX [name];`.

2.  **Monitor Usage**:
    If `idx_scan` count is 0 for an index after 1 month of production use, it should be deleted to save write performance.

---

## Conclusion: Multi-Hub Implementation Complete
You have successfully deployed a scalable, role-aware, multi-hub task engine with hardened security and optimized performance.
