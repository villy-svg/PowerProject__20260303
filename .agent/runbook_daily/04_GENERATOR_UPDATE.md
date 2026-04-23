# Runbook 2.1 — Generator Function Update

## Phase 2: Supabase Edge Function / Generator Logic Updates
## Subphase 2.1: Update `generate_daily_tasks()` to produce parent + sub-tasks

---

## Objective

Modify the existing `generate_daily_tasks()` PL/pgSQL function to:
1. Continue generating parent tasks exactly as before (zero regression).
2. **After** inserting a parent task, check if `has_sub_assignees = true`.
3. If yes, query `daily_task_template_subtasks` for active blueprints.
4. Insert sub-tasks with `parent_task_id` pointing to the just-created parent task.
5. All within a **single implicit transaction** (PL/pgSQL functions are transactional by default).

---

## Prerequisites

- [ ] All Phase 1 runbooks (1.1, 1.2, 1.3) complete and validated.
- [ ] `daily_task_templates` has `senior_manager_id` and `has_sub_assignees`.
- [ ] `daily_task_template_subtasks` table exists.
- [ ] `daily_tasks` has `parent_task_id`.

---

## Current Generator Logic (Before)

Location: `supabase/migrations/20260101000003_functions_triggers.sql` lines 98-155.

```
FOR each active template:
  IF should_run based on frequency:
    INSERT one daily_task row
    UPDATE template.last_run_at
    tasks_created++
RETURN tasks_created
```

**Critical**: The function is `SECURITY DEFINER`, meaning it runs with the privileges of the function owner (postgres), bypassing RLS. This is correct for a cron/system function.

---

## Updated Generator Logic (After)

```
FOR each active template:
  IF should_run based on frequency:
    INSERT parent daily_task → capture RETURNING id into v_parent_id
    IF template.has_sub_assignees = true:
      FOR each active sub-blueprint WHERE parent_template_id = template.id:
        INSERT sub daily_task with parent_task_id = v_parent_id
        sub_tasks_created++
    UPDATE template.last_run_at
    tasks_created++
RETURN tasks_created (parent count only, sub-tasks tracked separately in logs)
```

---

## Migration SQL

File: `supabase/migrations/YYYYMMDDHHMMSS_generator_subtask_support.sql`

```sql
-- =========================================================================
-- POWERPROJECT: DAILY TASK HIERARCHY — STEP 4/6
-- Updates generate_daily_tasks() to produce sub-tasks.
-- Uses CREATE OR REPLACE for idempotency.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template RECORD;
    sub_blueprint RECORD;
    tasks_created integer := 0;
    sub_tasks_created integer := 0;
    should_run boolean;
    day_of_week integer;
    v_parent_id uuid;
BEGIN
    FOR template IN
        SELECT * FROM public.daily_task_templates
        WHERE is_active = true
    LOOP
        should_run := false;

        -- ── Frequency Check (unchanged) ──────────────────────────
        IF template.frequency = 'DAILY' THEN
            IF template.last_run_at IS NULL
               OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                  < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                should_run := true;
            END IF;
        ELSIF template.frequency = 'WEEKLY' THEN
            day_of_week := EXTRACT(DOW FROM now() AT TIME ZONE 'UTC');
            IF (template.frequency_details->>'day_of_week') IS NOT NULL
               AND (template.frequency_details->>'day_of_week')::int = day_of_week THEN
                IF template.last_run_at IS NULL
                   OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                      < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    should_run := true;
                END IF;
            END IF;
        ELSIF template.frequency = 'MONTHLY' THEN
            IF (template.frequency_details->>'day_of_month') IS NOT NULL
               AND (template.frequency_details->>'day_of_month')::int
                   = EXTRACT(DAY FROM now() AT TIME ZONE 'UTC') THEN
                IF template.last_run_at IS NULL
                   OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                      < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    should_run := true;
                END IF;
            END IF;
        END IF;

        IF should_run THEN
            -- ── Insert Parent Task ───────────────────────────────
            INSERT INTO public.daily_tasks (
                text, description, priority, stage_id,
                vertical_id, hub_id, client_id, employee_id,
                partner_id, vendor_id,
                city, function_name,
                assigned_to, scheduled_date, is_recurring,
                created_by, last_updated_by
            ) VALUES (
                template.title,
                template.description,
                'Medium',
                'TODO',
                template.vertical_id,
                template.hub_id,
                template.client_id,
                template.employee_id,
                template.partner_id,
                template.vendor_id,
                template.city,
                template.function_name,
                template.assigned_to,
                CURRENT_DATE,
                TRUE,
                template.created_by,
                template.created_by
            )
            RETURNING id INTO v_parent_id;

            -- ── Generate Sub-Tasks (if toggle is ON) ─────────────
            IF template.has_sub_assignees = true THEN
                FOR sub_blueprint IN
                    SELECT * FROM public.daily_task_template_subtasks
                    WHERE parent_template_id = template.id
                      AND is_active = true
                    ORDER BY sort_order ASC
                LOOP
                    INSERT INTO public.daily_tasks (
                        text, description, priority, stage_id,
                        vertical_id, hub_id, client_id, employee_id,
                        partner_id, vendor_id,
                        city, function_name,
                        assigned_to, scheduled_date, is_recurring,
                        parent_task_id,
                        created_by, last_updated_by
                    ) VALUES (
                        sub_blueprint.title,
                        sub_blueprint.description,
                        COALESCE(sub_blueprint.priority, 'Medium'),
                        'TODO',
                        template.vertical_id,
                        template.hub_id,
                        template.client_id,
                        template.employee_id,
                        template.partner_id,
                        template.vendor_id,
                        template.city,
                        template.function_name,
                        sub_blueprint.assigned_to,
                        CURRENT_DATE,
                        TRUE,
                        v_parent_id,
                        template.created_by,
                        template.created_by
                    );

                    sub_tasks_created := sub_tasks_created + 1;
                END LOOP;
            END IF;

            -- ── Update last_run_at ───────────────────────────────
            UPDATE public.daily_task_templates
            SET last_run_at = now()
            WHERE id = template.id;

            tasks_created := tasks_created + 1;
        END IF;
    END LOOP;

    -- Log sub-task count for observability
    IF sub_tasks_created > 0 THEN
        RAISE NOTICE 'generate_daily_tasks: Created % parent tasks and % sub-tasks',
            tasks_created, sub_tasks_created;
    END IF;

    RETURN tasks_created;
END;
$$;

NOTIFY pgrst, 'reload schema';
```

---

## Key Implementation Notes

### 1. Transaction Safety
PL/pgSQL functions run inside an implicit transaction. If any INSERT fails (e.g., a bad FK reference in a sub-blueprint), the **entire** function invocation rolls back — no parent tasks without their sub-tasks, no partial state.

### 2. Sub-Tasks Inherit Context from Parent Template
Sub-tasks get `vertical_id`, `hub_id`, `client_id`, `employee_id`, `partner_id`, `vendor_id`, `city`, `function_name` from the **parent template**, NOT from the sub-blueprint. The sub-blueprint only controls: `title`, `description`, `assigned_to`, `priority`. This ensures organizational context consistency.

### 3. `assigned_to` Override
The parent task uses `template.assigned_to` (the senior manager or primary assignee). Each sub-task uses `sub_blueprint.assigned_to` (the specific sub-assignee). This is the core of the hierarchy: different people responsible for different pieces.

### 4. Return Value
The function still returns the count of **parent** tasks created (for backward compatibility with any callers). Sub-task count is logged via `RAISE NOTICE`.

---

## Validation

### V2.1.1: Function replaced successfully
```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'generate_daily_tasks';
```
Expected: 1 row. The `prosrc` should contain `has_sub_assignees` and `parent_task_id`.

### V2.1.2: Simple template (no sub-tasks) — regression test
```sql
-- Create a simple template (has_sub_assignees = false, the default)
INSERT INTO public.daily_task_templates
  (title, vertical_id, frequency, is_active, last_run_at)
VALUES ('REGRESSION_TEST', 'CHARGING_HUBS', 'DAILY', true, NULL)
RETURNING id;

-- Run the generator
SELECT public.generate_daily_tasks();
-- Expected: returns >= 1

-- Verify task was created
SELECT id, text, parent_task_id FROM public.daily_tasks
WHERE text = 'REGRESSION_TEST' AND scheduled_date = CURRENT_DATE;
-- Expected: 1 row, parent_task_id = NULL

-- Cleanup
DELETE FROM public.daily_tasks WHERE text = 'REGRESSION_TEST';
DELETE FROM public.daily_task_templates WHERE title = 'REGRESSION_TEST';
```

### V2.1.3: Template with sub-tasks — full hierarchy test
```sql
-- 1. Create parent template with toggle ON
INSERT INTO public.daily_task_templates
  (title, vertical_id, frequency, is_active, has_sub_assignees, last_run_at)
VALUES ('HIERARCHY_TEST_PARENT', 'CHARGING_HUBS', 'DAILY', true, true, NULL)
RETURNING id;
-- Note the returned ID: <PARENT_TEMPLATE_ID>

-- 2. Create sub-blueprints
INSERT INTO public.daily_task_template_subtasks
  (parent_template_id, title, priority, sort_order)
VALUES
  ('<PARENT_TEMPLATE_ID>', 'Sub-Task Alpha', 'High', 1),
  ('<PARENT_TEMPLATE_ID>', 'Sub-Task Beta', 'Low', 2);

-- 3. Run generator
SELECT public.generate_daily_tasks();

-- 4. Verify parent was created
SELECT id, text, parent_task_id FROM public.daily_tasks
WHERE text = 'HIERARCHY_TEST_PARENT' AND scheduled_date = CURRENT_DATE;
-- Expected: 1 row, parent_task_id = NULL
-- Note the ID: <PARENT_TASK_ID>

-- 5. Verify sub-tasks were created and linked
SELECT id, text, parent_task_id, priority FROM public.daily_tasks
WHERE parent_task_id = '<PARENT_TASK_ID>'
ORDER BY text;
-- Expected: 2 rows (Alpha=High, Beta=Low), both with parent_task_id = PARENT_TASK_ID

-- 6. Verify sub-tasks inherited context
SELECT vertical_id, hub_id, city, function_name, is_recurring
FROM public.daily_tasks
WHERE parent_task_id = '<PARENT_TASK_ID>';
-- Expected: All match the parent template values

-- Cleanup
DELETE FROM public.daily_tasks WHERE text LIKE 'HIERARCHY_TEST%' OR text LIKE 'Sub-Task%';
DELETE FROM public.daily_task_template_subtasks WHERE title LIKE 'Sub-Task%';
DELETE FROM public.daily_task_templates WHERE title = 'HIERARCHY_TEST_PARENT';
```

### V2.1.4: Idempotency test (no double-run)
```sql
-- After V2.1.3, run the generator again immediately
SELECT public.generate_daily_tasks();
-- Expected: returns 0 (last_run_at was set, so should_run = false for today)
```

### V2.1.5: Inactive sub-blueprint test
```sql
-- Create template with toggle ON
INSERT INTO public.daily_task_templates
  (title, vertical_id, frequency, is_active, has_sub_assignees, last_run_at)
VALUES ('INACTIVE_SUB_TEST', 'CHARGING_HUBS', 'DAILY', true, true, NULL)
RETURNING id;

-- Create one active and one inactive sub-blueprint
INSERT INTO public.daily_task_template_subtasks
  (parent_template_id, title, is_active) VALUES
  ('<ID>', 'Active Sub', true),
  ('<ID>', 'Inactive Sub', false);

SELECT public.generate_daily_tasks();

-- Verify only active sub was created
SELECT text FROM public.daily_tasks
WHERE scheduled_date = CURRENT_DATE AND text LIKE '%Sub';
-- Expected: 'Active Sub' only. NOT 'Inactive Sub'.

-- Cleanup
DELETE FROM public.daily_tasks WHERE text IN ('INACTIVE_SUB_TEST','Active Sub','Inactive Sub');
DELETE FROM public.daily_task_template_subtasks WHERE title LIKE '%Sub';
DELETE FROM public.daily_task_templates WHERE title = 'INACTIVE_SUB_TEST';
```

---

## Rollback

To revert to the original generator (without sub-task support), re-apply the original function from `20260101000003_functions_triggers.sql` lines 98-155.

## Next → [Runbook 3.1: RLS Policy Updates](./05_RLS_POLICIES.md)
