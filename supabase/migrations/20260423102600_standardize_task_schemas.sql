-- =========================================================================
-- POWERPROJECT: TASK SCHEMA STANDARDIZATION & MULTI-ENTITY SUPPORT
-- Architecture: Context Link Table (no uuid[] arrays)
--
-- What this migration does:
--   1. Renames columns to snake_case (idempotent).
--   2. Adds task_board jsonb and metadata jsonb to all task tables.
--   3. Creates task_context_links — a unified, scalable join table that
--      replaces all multi-entity uuid[] columns across ALL archetypes:
--        source_type: 'task' | 'daily_task' | 'template' | <future>
--        entity_type: 'assignee' | 'client' | 'partner' | 'vendor' |
--                     'employee' | <future>
--        metadata:    jsonb for link-level context (roles, flags, etc.)
--   4. Migrates existing single-uuid data into the link table.
--   5. Re-applies RLS policies using snake_case column names.
--   6. Creates computed relationships for PostgREST joins.
--   7. Updates the daily task generator to propagate context links.
--
-- What does NOT change:
--   assigned_to, client_id, partner_id, vendor_id, employee_id columns
--   remain as single uuid. They serve as the backward-compatible
--   "primary" reference. Multi-entity links live in task_context_links.
-- =========================================================================


-- =========================================================================
-- SECTION 1: RENAME COLUMNS (snake_case standardization — idempotent)
-- =========================================================================
DO $$
BEGIN
    -- tasks table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='verticalid') THEN
        ALTER TABLE public.tasks RENAME COLUMN verticalid TO vertical_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='stageid') THEN
        ALTER TABLE public.tasks RENAME COLUMN stageid TO stage_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='createdat') THEN
        ALTER TABLE public.tasks RENAME COLUMN createdat TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='updatedat') THEN
        ALTER TABLE public.tasks RENAME COLUMN updatedat TO updated_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='parent_task') THEN
        ALTER TABLE public.tasks RENAME COLUMN parent_task TO parent_task_id;
    END IF;

    -- daily_tasks table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='verticalid') THEN
        ALTER TABLE public.daily_tasks RENAME COLUMN verticalid TO vertical_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='stageid') THEN
        ALTER TABLE public.daily_tasks RENAME COLUMN stageid TO stage_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='createdat') THEN
        ALTER TABLE public.daily_tasks RENAME COLUMN createdat TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='updatedat') THEN
        ALTER TABLE public.daily_tasks RENAME COLUMN updatedat TO updated_at;
    END IF;

    -- daily_task_templates table
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='verticalid') THEN
        ALTER TABLE public.daily_task_templates RENAME COLUMN verticalid TO vertical_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='stageid') THEN
        ALTER TABLE public.daily_task_templates RENAME COLUMN stageid TO stage_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='createdat') THEN
        ALTER TABLE public.daily_task_templates RENAME COLUMN createdat TO created_at;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='updatedat') THEN
        ALTER TABLE public.daily_task_templates RENAME COLUMN updatedat TO updated_at;
    END IF;
END $$;


-- =========================================================================
-- SECTION 2: ADD NEW COLUMNS (idempotent)
--   task_board  jsonb  — kanban/board slot configuration
--   metadata    jsonb  — future extensibility without schema migrations
-- =========================================================================
DO $$
BEGIN
    -- tasks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='task_board') THEN
        ALTER TABLE public.tasks ADD COLUMN task_board jsonb NOT NULL DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='metadata') THEN
        ALTER TABLE public.tasks ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
    END IF;

    -- daily_tasks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='task_board') THEN
        ALTER TABLE public.daily_tasks ADD COLUMN task_board jsonb NOT NULL DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='metadata') THEN
        ALTER TABLE public.daily_tasks ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
    END IF;

    -- daily_task_templates
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='task_board') THEN
        ALTER TABLE public.daily_task_templates ADD COLUMN task_board jsonb NOT NULL DEFAULT '[]';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='metadata') THEN
        ALTER TABLE public.daily_task_templates ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}';
    END IF;
END $$;


-- =========================================================================
-- SECTION 3: CREATE task_context_links TABLE
--
-- The single source of truth for all multi-entity relationships across
-- all task archetypes. Designed to scale to future archetypes and
-- entity types without any new migrations.
--
-- source_type  — 'task' | 'daily_task' | 'template' | <future archetype>
-- source_id    — uuid of the parent record
-- entity_type  — 'assignee' | 'client' | 'partner' | 'vendor' |
--                'employee' | <future relationship type>
-- entity_id    — uuid of the related entity
-- metadata     — link-level context, e.g.:
--                assignee: { "is_lead": true, "assigned_by": "<uuid>" }
--                client:   { "billing_context": "retainer" }
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.task_context_links (
    id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    source_type text        NOT NULL,
    source_id   uuid        NOT NULL,
    entity_type text        NOT NULL,
    entity_id   uuid        NOT NULL,
    metadata    jsonb       NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_type, source_id, entity_type, entity_id)
);

COMMENT ON TABLE public.task_context_links IS
    'Unified multi-entity context link table. '
    'source_type identifies the archetype (task/daily_task/template/future). '
    'entity_type identifies the relationship kind (assignee/client/partner/vendor/employee/future). '
    'metadata jsonb stores relationship-level context (is_lead, role, billing_context, etc.).';


-- =========================================================================
-- SECTION 4: MIGRATE EXISTING SINGLE-UUID DATA INTO task_context_links
-- ON CONFLICT DO NOTHING ensures this is safe to re-run.
-- =========================================================================

-- tasks.assigned_to -> assignee links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'task', id, 'assignee', assigned_to
FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_tasks.assigned_to -> assignee links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'assignee', assigned_to
FROM public.daily_tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_tasks context links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'client', client_id FROM public.daily_tasks WHERE client_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'partner', partner_id FROM public.daily_tasks WHERE partner_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'vendor', vendor_id FROM public.daily_tasks WHERE vendor_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'daily_task', id, 'employee', employee_id FROM public.daily_tasks WHERE employee_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_task_templates.assigned_to -> assignee links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'assignee', assigned_to
FROM public.daily_task_templates
WHERE assigned_to IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- daily_task_templates context links
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'client', client_id FROM public.daily_task_templates WHERE client_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'partner', partner_id FROM public.daily_task_templates WHERE partner_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'vendor', vendor_id FROM public.daily_task_templates WHERE vendor_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'employee', employee_id FROM public.daily_task_templates WHERE employee_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;


-- =========================================================================
-- SECTION 5: INDEXES ON task_context_links
-- =========================================================================

-- Primary lookup: all links for a given source record
CREATE INDEX IF NOT EXISTS idx_tcl_source
    ON public.task_context_links (source_type, source_id);

-- Reverse lookup: all sources linked to a given entity
CREATE INDEX IF NOT EXISTS idx_tcl_entity
    ON public.task_context_links (entity_type, entity_id);

-- Fast RLS check: "find all tasks where I am an assignee"
CREATE INDEX IF NOT EXISTS idx_tcl_assignee_lookup
    ON public.task_context_links (entity_id)
    WHERE entity_type = 'assignee';

-- GIN index on metadata for future JSONB queries
CREATE INDEX IF NOT EXISTS idx_tcl_metadata
    ON public.task_context_links USING GIN (metadata);


-- =========================================================================
-- SECTION 6: RLS ON task_context_links
-- =========================================================================
ALTER TABLE public.task_context_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tcl SELECT" ON public.task_context_links;
CREATE POLICY "tcl SELECT" ON public.task_context_links
FOR SELECT USING (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    ))
    OR (source_type = 'daily_task' AND EXISTS (
        SELECT 1 FROM public.daily_tasks dt
        WHERE dt.id = source_id
          AND public.get_user_permission_level(dt.vertical_id) IN ('viewer','contributor','editor','admin')
    ))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl INSERT" ON public.task_context_links;
CREATE POLICY "tcl INSERT" ON public.task_context_links
FOR INSERT WITH CHECK (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('contributor','editor','admin')
    ))
    OR (source_type = 'daily_task' AND EXISTS (
        SELECT 1 FROM public.daily_tasks dt
        WHERE dt.id = source_id
          AND public.get_user_permission_level(dt.vertical_id) IN ('contributor','editor','admin')
    ))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl DELETE" ON public.task_context_links;
CREATE POLICY "tcl DELETE" ON public.task_context_links
FOR DELETE USING (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('editor','admin')
    ))
    OR (source_type = 'daily_task' AND EXISTS (
        SELECT 1 FROM public.daily_tasks dt
        WHERE dt.id = source_id
          AND public.get_user_permission_level(dt.vertical_id) IN ('editor','admin')
    ))
    OR source_type = 'template'
);


-- =========================================================================
-- SECTION 7: RE-APPLY TASK & SUBMISSION RLS POLICIES
-- assigned_to stays as single uuid — no ANY() array hacks needed.
-- Multi-assignee access is checked via task_context_links.
-- =========================================================================

-- tasks
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.tasks;
CREATE POLICY "Permit SELECT based on role" ON public.tasks
FOR SELECT USING (
    public.get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin')
);

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.tasks;
CREATE POLICY "Permit INSERT based on role" ON public.tasks
FOR INSERT WITH CHECK (
    public.get_user_permission_level(vertical_id) IN ('contributor','editor','admin')
);

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.tasks
FOR UPDATE USING (
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')
    OR auth.uid() = assigned_to
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.source_type = 'task'
          AND tcl.entity_type = 'assignee'
          AND up.id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.tasks;
CREATE POLICY "Permit DELETE based on role" ON public.tasks
FOR DELETE USING (
    public.get_user_permission_level(vertical_id) = 'admin'
);

-- daily_tasks
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks
FOR UPDATE USING (
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')
    OR auth.uid() = assigned_to
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = daily_tasks.id
          AND tcl.source_type = 'daily_task'
          AND tcl.entity_type = 'assignee'
          AND up.id = auth.uid()
    )
);

-- submissions (references tasks.vertical_id — now snake_case)
DROP POLICY IF EXISTS "Submissions SELECT via task vertical" ON public.submissions;
CREATE POLICY "Submissions SELECT via task vertical" ON public.submissions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    )
);

DROP POLICY IF EXISTS "Submissions INSERT via task vertical" ON public.submissions;
CREATE POLICY "Submissions INSERT via task vertical" ON public.submissions
FOR INSERT WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND (
            public.get_user_permission_level(t.vertical_id) IN ('contributor','editor','admin')
            OR auth.uid() = t.assigned_to
            OR EXISTS (
                SELECT 1 FROM public.task_context_links tcl
                JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
                WHERE tcl.source_id = t.id
                  AND tcl.source_type = 'task'
                  AND tcl.entity_type = 'assignee'
                  AND up.id = auth.uid()
            )
          )
    )
);

DROP POLICY IF EXISTS "Submissions UPDATE via task vertical" ON public.submissions;
CREATE POLICY "Submissions UPDATE via task vertical" ON public.submissions
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.tasks t
        JOIN public.verticals v ON v.id = t.vertical_id
        WHERE t.id = submissions.task_id
          AND (
            public.get_user_permission_level(t.vertical_id) IN ('editor','admin')
            OR (
                auth.uid() = submissions.submitted_by
                AND submissions.status = 'pending'
                AND (
                    (v.settings->>'submission_lock_on_review')::boolean IS NOT TRUE
                    OR t.stage_id != 'REVIEW'
                )
            )
          )
    )
);


-- =========================================================================
-- SECTION 8: COMPUTED RELATIONSHIPS (PostgREST joins via context links)
-- Allows: .select('*, assignees(id, full_name, badge_id, ...)')
-- Named "assignees" (not "employees") to be unambiguous.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.assignees(t public.tasks)
RETURNS SETOF public.employees AS $$
    SELECT e.* FROM public.employees e
    JOIN public.task_context_links tcl ON tcl.entity_id = e.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'task'
      AND tcl.entity_type = 'assignee';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.assignees(t public.daily_tasks)
RETURNS SETOF public.employees AS $$
    SELECT e.* FROM public.employees e
    JOIN public.task_context_links tcl ON tcl.entity_id = e.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'daily_task'
      AND tcl.entity_type = 'assignee';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.assignees(t public.daily_task_templates)
RETURNS SETOF public.employees AS $$
    SELECT e.* FROM public.employees e
    JOIN public.task_context_links tcl ON tcl.entity_id = e.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'template'
      AND tcl.entity_type = 'assignee';
$$ LANGUAGE sql STABLE;


-- =========================================================================
-- SECTION 9: UPDATE generate_daily_tasks()
-- Propagates all context links from template to the new daily_task.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    template      RECORD;
    new_task_id   uuid;
    tasks_created integer := 0;
    should_run    boolean;
    day_of_week   integer;
    link_row      RECORD;
BEGIN
    FOR template IN
        SELECT * FROM public.daily_task_templates
        WHERE is_active = true
    LOOP
        should_run := false;

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
            INSERT INTO public.daily_tasks (
                text, description, priority, stage_id,
                vertical_id, hub_id, client_id, employee_id,
                partner_id, vendor_id, city, function_name,
                assigned_to, scheduled_date, is_recurring,
                created_by, last_updated_by, task_board
            ) VALUES (
                template.title, template.description, 'Medium', 'TODO',
                template.vertical_id, template.hub_id,
                template.client_id, template.employee_id,
                template.partner_id, template.vendor_id,
                template.city, template.function_name,
                template.assigned_to, CURRENT_DATE, TRUE,
                template.created_by, template.created_by, template.task_board
            )
            RETURNING id INTO new_task_id;

            -- Propagate all context links from the template to the new daily task
            FOR link_row IN (
                SELECT entity_type, entity_id, metadata
                FROM public.task_context_links
                WHERE source_id = template.id AND source_type = 'template'
            ) LOOP
                INSERT INTO public.task_context_links
                    (source_type, source_id, entity_type, entity_id, metadata)
                VALUES
                    ('daily_task', new_task_id, link_row.entity_type, link_row.entity_id, link_row.metadata)
                ON CONFLICT DO NOTHING;
            END LOOP;

            UPDATE public.daily_task_templates
            SET last_run_at = now()
            WHERE id = template.id;

            tasks_created := tasks_created + 1;
        END IF;
    END LOOP;

    RETURN tasks_created;
END;
$$;


-- =========================================================================
-- SECTION 10: TRIGGER FUNCTION (references updated snake_case columns)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.protect_task_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_allowed_cols text[] := ARRAY['stage_id', 'last_updated_by', 'updated_at'];
  v_new_json     jsonb  := to_jsonb(NEW);
  v_old_json     jsonb  := to_jsonb(OLD);
  v_col          text;
  v_final_json   jsonb;
  v_perm_level   text;
  v_vertical_id  text;
BEGIN
  v_vertical_id := v_new_json->>'vertical_id';
  v_perm_level  := public.get_user_permission_level(v_vertical_id);

  IF v_perm_level NOT IN ('editor', 'admin') THEN
    v_final_json := v_old_json;
    FOR v_col IN SELECT jsonb_object_keys(v_new_json) LOOP
      IF v_col = ANY(v_allowed_cols) THEN
        v_final_json := v_final_json || jsonb_build_object(v_col, v_new_json->v_col);
      ELSE
        IF v_old_json->v_col IS DISTINCT FROM v_new_json->v_col THEN
          RAISE WARNING '[Workflow Guard] Unauthorized edit to column "%" by user "%" was reverted.',
            v_col, auth.uid();
        END IF;
      END IF;
    END LOOP;
    NEW := jsonb_populate_record(NEW, v_final_json);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================================
-- SECTION 11: RELOAD SCHEMA
-- =========================================================================
NOTIFY pgrst, 'reload schema';
