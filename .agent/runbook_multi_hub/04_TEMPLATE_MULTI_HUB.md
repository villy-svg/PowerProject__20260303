# Runbook 3.1 — Template Multi-Hub & Role Configuration

## Phase 3: Generator Fan-Out
## Subphase 3.1: Enable templates to reference multiple hubs & roles (Metadata-driven)

---

## 1. Objective & Architectural Logic
The goal of this phase is to transform the `daily_task_templates` from a static row into a **Polymorphic Dispatcher**. 

### The Problem: Legacy Scalar Constraints
Previously, a template was restricted by a single `hub_id` and a single `assigned_to` column. This architecture failed in three scenarios:
1.  **Multi-Location Tasks**: A "Morning Safety Check" must be generated for Hub A, Hub B, and Hub C simultaneously.
2.  **Role-Based Visibility**: A task should be visible to anyone with the "Ground Staff" role across all linked hubs.
3.  **Dynamic Assignee Overrides**: Hub A might need 2 people for a task, while Hub B only needs 1.

### The Solution: The "Link + Metadata" Pattern
Instead of adding brittle columns to the template table, we leverage the existing `task_context_links` (TCL) infrastructure and enhance it with **Operational Toggles** and **Metadata Rules**.
*   **Hub Links**: Associate a template with N physical locations.
*   **Role Links**: Associate a template with N functional roles (e.g., "All Managers").
*   **Assignee Links**: Explicitly link N individuals who must receive the task.
*   **Active Toggle**: A new `is_active` boolean on the link allows managers to "pause" a template for a specific hub (e.g., during renovations) without losing the historical association.

---

## 2. Prerequisites (Deep Validation)
Before proceeding, the "Low-Context Model" must verify that Phase 1 & 2 are correctly integrated. Run these checks:

### V3.1.0-A: Verify Table Consolidation
```sql
-- Should return 0. If > 0, Phase 2 (Consolidation) failed.
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'daily_tasks';
```

### V3.1.0-B: Verify Context Link Support
```sql
-- Should return 1. Confirms the junction table is ready.
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'task_context_links' AND column_name = 'source_type';
```

### V3.1.0-C: Verify Computed Hubs Relationship
```sql
-- Confirms PostgREST can resolve hub links for templates.
SELECT proname FROM pg_proc 
WHERE proname = 'hubs' AND proargtypes::text LIKE '%daily_task_templates%';
```

---

## 3. Implementation Step-by-Step

### Step 1: Schema Hardening (The Foundation)
We add `metadata` to `employee_roles` to allow for "Seniority-Aware" or "Permission-Aware" filtering in the future. We also add the `is_active` toggle to `task_context_links` to prevent the "Deleted Link" problem where history is lost just to stop a task from generating.

### Step 2: Referential Integrity (The Cleanup Trigger)
When a template is deleted, it must not leave "Ghost Links" in `task_context_links`. We implement a `BEFORE DELETE` trigger to purge these associations atomically.

### Step 3: Performance Optimization (The Auth Index)
The Generator will be querying `task_context_links` thousands of times. We create a **Partial Index** that specifically targets `is_active = true`. This makes the "Generator Scan" significantly faster by ignoring deactivated or historic links.

### Step 4: Run the Migration SQL
**File Path**: `supabase/migrations/20260424103000_role_aware_metadata_full.sql`

```sql
-- =========================================================================
-- POWERPROJECT: PHASE 3.1 — TEMPLATE HARDENING & ROLE-AWARE METADATA
-- =========================================================================

BEGIN;

-- 1. Extend Employee Roles
-- Adds a metadata column to allow role-specific settings (e.g. "is_ground_staff": true)
-- Default to empty object to prevent null-pointer errors in JS.
ALTER TABLE public.employee_roles
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Add Link Status Toggle
-- This allows us to "turn off" a hub for a template without deleting the link.
-- Crucial for seasonal hubs or temporary staffing changes.
ALTER TABLE public.task_context_links
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Create Authorization Index (Partial Index)
-- This index only includes active links, drastically reducing the search space
-- for the Generator and RLS policies.
CREATE INDEX IF NOT EXISTS idx_tcl_auth_active
  ON public.task_context_links (source_id, source_type, entity_type)
  WHERE is_active = true;

-- 4. Set Metadata Documentation
-- We designate the template's 'assigned_to' column as the 'Senior Manager'.
-- This column acts as the fallback owner if no specific links are found.
COMMENT ON COLUMN public.daily_task_templates.assigned_to IS 
  'Acts as the Senior Manager / Parent Owner for all fan-out tasks.';

-- 5. Implement Cleanup Trigger Function
-- Ensures that task_context_links are purged when the source template is removed.
CREATE OR REPLACE FUNCTION public.handle_source_deletion()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.task_context_links WHERE source_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach Cleanup Trigger to Template Table
DROP TRIGGER IF EXISTS trg_cleanup_template_links ON public.daily_task_templates;
CREATE TRIGGER trg_cleanup_template_links
    BEFORE DELETE ON public.daily_task_templates
    FOR EACH ROW EXECUTE FUNCTION public.handle_source_deletion();

COMMIT;

-- Force PostgREST to recognize the new columns and relationships.
NOTIFY pgrst, 'reload schema';
```

---

## 4. Metadata Schema Specification (The "Brain" of the Generator)

To avoid "Column Bloat" in the database, all complex distribution logic lives in `daily_task_templates.metadata->'fan_out'`.

### JSONB Structure Deep-Dive:
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `mode` | `string` | Yes | `flat` (1 task), `multi_assignee` (N tasks), `multi_hub` (Parent + Children). |
| `has_sub_assignees` | `boolean` | No | If true, creates a separate task for every linked 'assignee'. |
| `has_multiple_hubs` | `boolean` | No | If true, creates a child task for every linked 'hub'. |
| `hub_assignee_map` | `object` | No | Key: Hub UUID, Value: Array of Employee UUIDs. Overrides default assignees for that specific hub. |

### Fan-Out Logic Matrix:
1.  **Flat Mode**:
    *   Creates 1 task using the template's scalar columns.
    *   Links all associated Hubs/Roles to that *single* task.
2.  **Multi-Hub Mode**:
    *   Creates 1 **Parent Task** (Status: 'HIDDEN' or 'SYSTEM').
    *   Creates N **Child Tasks** (one per linked Hub).
    *   Links the Hub to the specific Child Task.
3.  **Hub Assignee Override**:
    *   If `hub_assignee_map` contains a key for a hub, those employees get assigned.
    *   Otherwise, it falls back to the template's default `assigned_to`.

---

## 5. Verification & Testing (The "Fail-Safe" Checklist)

### V3.1.1: Schema Integrity Check
Verify the new columns exist and have correct types.
```sql
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name IN ('employee_roles', 'task_context_links')
  AND column_name IN ('metadata', 'is_active');
```
**Expectation**: `is_active` should be `boolean` with default `true`. `metadata` should be `jsonb` with default `'{}'::jsonb`.

### V3.1.2: Trigger Test (Automatic Cleanup)
1.  **Setup**: Create a dummy template: `INSERT INTO daily_task_templates (text) VALUES ('TEST_CLEANUP') RETURNING id;`
2.  **Link**: Add 3 links to `task_context_links` pointing to that ID.
3.  **Action**: `DELETE FROM daily_task_templates WHERE text = 'TEST_CLEANUP';`
4.  **Verification**: `SELECT COUNT(*) FROM task_context_links WHERE source_id = 'DUMMY_ID';` 
**Expectation**: Should return **0 rows**.

### V3.1.3: Partial Index Validation (Performance)
Ensure the index is being used for active-only queries.
```sql
EXPLAIN ANALYZE
SELECT * FROM public.task_context_links 
WHERE source_id = 'SOME_TEMPLATE_ID' AND is_active = true;
```
**Expectation**: Output MUST mention `Index Scan using idx_tcl_auth_active`. If it says `Seq Scan`, the index is broken.

### V3.1.4: Metadata Default Test
```sql
INSERT INTO public.employee_roles (role_name) VALUES ('TEST_ROLE');
SELECT metadata FROM public.employee_roles WHERE role_name = 'TEST_ROLE';
```
**Expectation**: Should return `{}` (not NULL).

---

## 6. Rollback & Recovery
If the deployment causes performance degradation or logic errors:

1.  **Drop Trigger**: `DROP TRIGGER trg_cleanup_template_links ON daily_task_templates;`
2.  **Drop Function**: `DROP FUNCTION public.handle_source_deletion();`
3.  **Remove Columns**: 
    ```sql
    ALTER TABLE public.employee_roles DROP COLUMN IF EXISTS metadata;
    ALTER TABLE public.task_context_links DROP COLUMN IF EXISTS is_active;
    ```
4.  **Reload**: `NOTIFY pgrst, 'reload schema';`

---

## Next Step → [Runbook 3.2: Atomic Generator Spawner](./05_GENERATOR_FANOUT.md)
