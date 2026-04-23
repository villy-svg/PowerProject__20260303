# Runbook 3.1 — RLS Policy Updates

## Phase 3: Row Level Security & Performance
## Subphase 3.1: RLS policies for hierarchy-aware access control

---

## Objective

Update RLS policies so:
1. **Senior Managers** can view/edit tasks assigned to their sub-assignees.
2. **Sub-assignees** can only view/edit their own assigned sub-tasks.
3. The new `daily_task_template_subtasks` table gets standard RBAC policies.
4. All existing policies continue to work (zero regression).

---

## Prerequisites

- [ ] All Phase 1 & Phase 2 runbooks complete.
- [ ] Read [RBAC Security System](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/rbac-security-system/SKILL.md).

---

## Current RLS State

### `daily_tasks` (from `20260405000000_workflow_rbac_hardening.sql`):
- **SELECT**: `get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin')`
- **UPDATE**: `get_user_permission_level(vertical_id) IN ('editor','admin') OR assigned_to = auth.uid()`
- **INSERT/DELETE**: Standard role-based

### `daily_task_templates`:
- All policies use hardcoded `'CHARGING_HUBS'` vertical check.

### Problem with Current Policies
Current policies don't account for the hierarchy. A senior manager needs to see sub-tasks that are `assigned_to` someone else. The current UPDATE policy only allows `assigned_to = auth.uid()` OR editor/admin roles.

---

## Strategy

We need a **helper function** that checks if the current user is the senior manager of a daily task's parent template. This avoids duplicating complex logic across multiple policies.

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_daily_hierarchy_rls.sql`

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 5/6
-- RLS policies for hierarchy-aware access control.
-- =========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: Helper Function — Senior Manager Check
-- ═══════════════════════════════════════════════════════════════════════════

-- Returns TRUE if auth.uid()'s linked employee_id matches the
-- senior_manager_id of the template that generated a given daily task.
-- Used in RLS policies to grant managers visibility over sub-tasks.
CREATE OR REPLACE FUNCTION public.is_senior_manager_of_daily_task(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_tasks dt
    -- Walk up: if this is a sub-task, find its parent
    JOIN public.daily_tasks parent_dt
      ON parent_dt.id = COALESCE(dt.parent_task_id, dt.id)
    -- Find the template that created the parent
    -- We match on text + vertical_id + scheduled_date as the link
    -- (there is no direct template_id FK on daily_tasks)
    JOIN public.daily_task_templates dtt
      ON dtt.title = parent_dt.text
      AND dtt.vertical_id = parent_dt.vertical_id
    -- Check if current user's employee is the senior manager
    JOIN public.user_profiles up
      ON up.id = auth.uid()
    WHERE dt.id = p_task_id
      AND dtt.senior_manager_id = up.employee_id
      AND dtt.senior_manager_id IS NOT NULL
  );
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 2: Updated daily_tasks Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- SELECT: Add senior manager visibility
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_tasks;
CREATE POLICY "Permit SELECT based on role" ON public.daily_tasks
FOR SELECT USING (
  public.get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin')
  OR assigned_to = (SELECT employee_id FROM public.user_profiles WHERE id = auth.uid())
  OR public.is_senior_manager_of_daily_task(id)
);

-- UPDATE: Add senior manager edit rights + assignee self-edit
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks
FOR UPDATE USING (
  public.get_user_permission_level(vertical_id) IN ('editor','admin')
  OR assigned_to = auth.uid()
  OR public.is_senior_manager_of_daily_task(id)
);

-- INSERT and DELETE: Keep unchanged (role-based only)
-- No changes needed — sub-tasks are created by the generator (SECURITY DEFINER),
-- not by end users directly.

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: daily_task_template_subtasks Policies
-- ═══════════════════════════════════════════════════════════════════════════

-- Standard RBAC pattern using the parent template's vertical
-- Since subtasks don't have their own vertical_id, we join to the parent.

DROP POLICY IF EXISTS "Permit SELECT on subtask blueprints" ON public.daily_task_template_subtasks;
CREATE POLICY "Permit SELECT on subtask blueprints" ON public.daily_task_template_subtasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.daily_task_templates dtt
    WHERE dtt.id = daily_task_template_subtasks.parent_template_id
      AND public.get_user_permission_level(dtt.vertical_id) IN ('viewer','contributor','editor','admin')
  )
);

DROP POLICY IF EXISTS "Permit INSERT on subtask blueprints" ON public.daily_task_template_subtasks;
CREATE POLICY "Permit INSERT on subtask blueprints" ON public.daily_task_template_subtasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.daily_task_templates dtt
    WHERE dtt.id = daily_task_template_subtasks.parent_template_id
      AND public.get_user_permission_level(dtt.vertical_id) IN ('contributor','editor','admin')
  )
);

DROP POLICY IF EXISTS "Permit UPDATE on subtask blueprints" ON public.daily_task_template_subtasks;
CREATE POLICY "Permit UPDATE on subtask blueprints" ON public.daily_task_template_subtasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.daily_task_templates dtt
    WHERE dtt.id = daily_task_template_subtasks.parent_template_id
      AND public.get_user_permission_level(dtt.vertical_id) IN ('editor','admin')
  )
);

DROP POLICY IF EXISTS "Permit DELETE on subtask blueprints" ON public.daily_task_template_subtasks;
CREATE POLICY "Permit DELETE on subtask blueprints" ON public.daily_task_template_subtasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.daily_task_templates dtt
    WHERE dtt.id = daily_task_template_subtasks.parent_template_id
      AND public.get_user_permission_level(dtt.vertical_id) = 'admin'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: Updated daily_task_templates Policies
-- Fix: Use template's own vertical_id instead of hardcoded 'CHARGING_HUBS'
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_task_templates;
CREATE POLICY "Permit SELECT based on role" ON public.daily_task_templates
FOR SELECT USING (
  public.get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin')
);

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_task_templates;
CREATE POLICY "Permit INSERT based on role" ON public.daily_task_templates
FOR INSERT WITH CHECK (
  public.get_user_permission_level(vertical_id) IN ('contributor','editor','admin')
);

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_task_templates;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_task_templates
FOR UPDATE
USING (public.get_user_permission_level(vertical_id) IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level(vertical_id) IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_task_templates;
CREATE POLICY "Permit DELETE based on role" ON public.daily_task_templates
FOR DELETE USING (public.get_user_permission_level(vertical_id) = 'admin');

-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
```

---

## Important: The `is_senior_manager_of_daily_task` Linkage

The function links `daily_tasks` back to `daily_task_templates` via matching `title = text` AND `vertical_id`. This is a soft link (no FK). If a future enhancement adds a `template_id` FK to `daily_tasks`, this function should be updated to use it.

**Why not add `template_id` now?** It would require modifying the `daily_tasks` table (another column, another FK) and updating the generator. This is deferred to keep this phase focused on the core hierarchy.

---

## Validation

### V3.1.1: Helper function exists
```sql
SELECT proname FROM pg_proc WHERE proname = 'is_senior_manager_of_daily_task';
```
Expected: 1 row.

### V3.1.2: Subtask blueprint policies exist
```sql
SELECT policyname FROM pg_policies
WHERE tablename = 'daily_task_template_subtasks'
ORDER BY policyname;
```
Expected: 4 policies (SELECT, INSERT, UPDATE, DELETE).

### V3.1.3: daily_tasks policies updated
```sql
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'daily_tasks' AND policyname LIKE 'Permit%';
```
Expected: Policies now reference `is_senior_manager_of_daily_task`.

### V3.1.4: Template policies no longer hardcode CHARGING_HUBS
```sql
SELECT policyname, qual FROM pg_policies
WHERE tablename = 'daily_task_templates' AND qual LIKE '%CHARGING_HUBS%';
```
Expected: 0 rows (hardcoded reference removed).

### V3.1.5: Regression — normal user can still see their tasks
Test with a user who has viewer access to CHARGING_HUBS:
```javascript
const { data } = await supabase.from('daily_tasks').select('*');
// Should return tasks they could see before
```

---

## Rollback

Re-apply the original policies from `20260101000004_rls_policies.sql` and `20260405000000_workflow_rbac_hardening.sql`.

## Next → [Runbook 3.2: Performance Indexes](./06_PERFORMANCE_INDEXES.md)
