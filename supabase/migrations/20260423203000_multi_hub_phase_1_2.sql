-- POWERPROJECT: MULTI-HUB MASTER ARCHITECTURE (Phases 1-4)
-- 1. Hub Links & Computed Relationships
-- 2. Table Consolidation (daily_tasks -> tasks)
-- 3. Generator Fan-Out Spawner (Hardened)
-- 4. Hybrid RLS Security (Three-Key System)
-- 5. Performance GIN & Composite Indexes
-- =========================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: HUB COMPUTED RELATIONSHIPS & INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 1: HUB COMPUTED RELATIONSHIPS & INDEXES
-- ═══════════════════════════════════════════════════════════════════════════

-- hubs() for tasks (Always safe)
CREATE OR REPLACE FUNCTION public.hubs(t public.tasks)
RETURNS SETOF public.hubs AS $$
    SELECT h.* FROM public.hubs h
    JOIN public.task_context_links tcl ON tcl.entity_id = h.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'task'
      AND tcl.entity_type = 'hub';
$$ LANGUAGE sql STABLE;

-- hubs() for daily_task_templates (Always safe)
CREATE OR REPLACE FUNCTION public.hubs(t public.daily_task_templates)
RETURNS SETOF public.hubs AS $$
    SELECT h.* FROM public.hubs h
    JOIN public.task_context_links tcl ON tcl.entity_id = h.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'template'
      AND tcl.entity_type = 'hub';
$$ LANGUAGE sql STABLE;

-- Conditional functions and migrations
DO $$
BEGIN
    -- Only create daily_tasks helpers if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_tasks') THEN
        
        EXECUTE 'CREATE OR REPLACE FUNCTION public.hubs(t public.daily_tasks)
        RETURNS SETOF public.hubs AS $func$
            SELECT h.* FROM public.hubs h
            JOIN public.task_context_links tcl ON tcl.entity_id = h.id
            WHERE tcl.source_id = t.id
              AND tcl.source_type = ''daily_task''
              AND tcl.entity_type = ''hub'';
        $func$ LANGUAGE sql STABLE';

        -- ═══════════════════════════════════════════════════════════════════════════
        -- SECTION 2: DATA MIGRATION (Hub Links)
        -- ═══════════════════════════════════════════════════════════════════════════

        -- daily_tasks.hub_id → hub links
        INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
        SELECT 'daily_task', id, 'hub', hub_id
        FROM public.daily_tasks
        WHERE hub_id IS NOT NULL
        ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

    END IF;
END $$;

-- tasks.hub_id → hub links (Always safe)
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'task', id, 'hub', hub_id
FROM public.tasks
WHERE hub_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

-- templates.hub_id → hub links (Always safe)
INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
SELECT 'template', id, 'hub', hub_id
FROM public.daily_task_templates
WHERE hub_id IS NOT NULL
ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tcl_hub_lookup
    ON public.task_context_links (entity_id)
    WHERE entity_type = 'hub';


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 3: TABLE CONSOLIDATION (daily_tasks → tasks)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
    -- Only run migration if daily_tasks still exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_tasks') THEN
        
        -- 1. Backup daily_tasks (Idempotent check)
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_tasks_backup') THEN
            EXECUTE 'CREATE TABLE public.daily_tasks_backup AS SELECT * FROM public.daily_tasks';
        END IF;

        -- 2. Migrate rows to tasks (Hardened for Prod)
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
            COALESCE((SELECT id FROM public.hubs WHERE id = dt.hub_id), dt.hub_id), -- Fallback to original if missing (FK will catch actual errors)
            dt.city,
            dt.function_name,
            (SELECT id FROM public.employees WHERE id = dt.assigned_to), -- Validate assigned_to
            NULL,
            COALESCE((SELECT id FROM public.user_profiles WHERE id = dt.created_by), (SELECT id FROM public.user_profiles LIMIT 1)), -- System Fallback for NOT NULL
            COALESCE((SELECT id FROM public.user_profiles WHERE id = dt.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
            (SELECT id FROM public.user_profiles WHERE id = dt.last_updated_by), -- Optional column
            COALESCE(dt.task_board, '["Hubs Daily"]'::jsonb),
            CASE
                WHEN dt.submission_by IS NOT NULL
                THEN jsonb_build_object('submission_by', dt.submission_by) || COALESCE(dt.metadata, '{}'::jsonb)
                ELSE COALESCE(dt.metadata, '{}'::jsonb)
            END,
            dt.created_at,
            dt.updated_at
        FROM public.daily_tasks dt
        ON CONFLICT (id) DO NOTHING;

        -- 3. Update context links source_type
        UPDATE public.task_context_links
        SET source_type = 'task'
        WHERE source_type = 'daily_task'
          AND source_id IN (SELECT id FROM public.tasks);

        -- 4. Cleanup
        DROP FUNCTION IF EXISTS public.assignees(public.daily_tasks);
        DROP FUNCTION IF EXISTS public.hubs(public.daily_tasks);
        DROP TABLE IF EXISTS public.daily_tasks CASCADE;

    END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: LEGACY DATA CLEANUP & TAGGING
-- ═══════════════════════════════════════════════════════════════════════════

-- Disable Workflow Guard to allow system-level tagging
ALTER TABLE public.tasks DISABLE TRIGGER trg_protect_task_columns;

-- 1. First, tag EVERYTHING that came from daily_tasks as "Hubs Daily"
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_tasks_backup') THEN
        UPDATE public.tasks
        SET task_board = '["Hubs Daily"]'::jsonb
        WHERE id IN (SELECT id FROM public.daily_tasks_backup);
    END IF;
END $$;

-- 2. Tag any remaining empty tasks as "Hubs" (Project tasks)
UPDATE public.tasks
SET task_board = '["Hubs"]'::jsonb
WHERE (task_board IS NULL OR task_board = '[]'::jsonb);

-- 3. Final Safety Check for new Fan-Out tasks
UPDATE public.tasks
SET task_board = '["Hubs Daily"]'::jsonb
WHERE (metadata->>'is_fan_out_child')::boolean = true
   OR (metadata->>'is_fan_out_parent')::boolean = true
   OR (metadata->>'source_template_id') IS NOT NULL;

-- Re-enable Workflow Guard
ALTER TABLE public.tasks ENABLE TRIGGER trg_protect_task_columns;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 4: TEMPLATE HARDENING & ROLE-AWARE METADATA (Phase 3.1)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Extend Employee Roles
ALTER TABLE public.employee_roles
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 1. Add new structural columns
ALTER TABLE public.daily_task_templates 
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'Medium';

-- 2. Add Link Status Toggle
ALTER TABLE public.task_context_links
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 3. Create Authorization Index (Partial Index)
CREATE INDEX IF NOT EXISTS idx_tcl_auth_active
  ON public.task_context_links (source_id, source_type, entity_type)
  WHERE is_active = true;

-- 4. Set Metadata Documentation
COMMENT ON COLUMN public.daily_task_templates.assigned_to IS 
  'Acts as the Senior Manager / Parent Owner for all fan-out tasks.';

-- 5. Implement Cleanup Trigger Function
CREATE OR REPLACE FUNCTION public.handle_source_deletion()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.task_context_links WHERE source_id = OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 6. Attach Cleanup Trigger
DROP TRIGGER IF EXISTS trg_cleanup_template_links ON public.daily_task_templates;
CREATE TRIGGER trg_cleanup_template_links
    BEFORE DELETE ON public.daily_task_templates
    FOR EACH ROW EXECUTE FUNCTION public.handle_source_deletion();


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 5: ATOMIC GENERATOR SPAWNER (Phase 3.2)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lock_acquired  boolean;
    template         RECORD;
    v_parent_id      uuid;
    v_child_id       uuid;
    v_tasks_created  integer := 0;
    v_should_run     boolean;
    v_day_of_week    integer;
    v_fan_out        jsonb;
    v_link           RECORD;
    v_hub_id         uuid;
    v_assignee_ids   uuid[];
    v_active_links   integer;
BEGIN
    -- Global advisory lock prevents race conditions between overlapping cron runs.
    SELECT pg_try_advisory_xact_lock(424242) INTO v_lock_acquired;
    IF NOT v_lock_acquired THEN
        RAISE NOTICE 'Generator already running in another session. Exiting.';
        RETURN 0;
    END IF;

    FOR template IN
        SELECT * FROM public.daily_task_templates 
        WHERE is_active = true 
        ORDER BY priority DESC 
    LOOP
        BEGIN -- Sub-transaction for error isolation
            
            v_should_run := false;

            -- Frequency State Machine
            IF template.frequency = 'DAILY' THEN
                IF template.last_run_at IS NULL
                   OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                      < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    v_should_run := true;
                END IF;
            ELSIF template.frequency = 'WEEKLY' THEN
                v_day_of_week := EXTRACT(DOW FROM now() AT TIME ZONE 'UTC');
                IF (template.frequency_details->>'day_of_week') IS NOT NULL
                   AND (template.frequency_details->>'day_of_week')::int = v_day_of_week THEN
                    IF template.last_run_at IS NULL
                       OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                          < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                        v_should_run := true;
                    END IF;
                END IF;
            ELSIF template.frequency = 'MONTHLY' THEN
                IF (template.frequency_details->>'day_of_month') IS NOT NULL
                   AND (template.frequency_details->>'day_of_month')::int
                       = EXTRACT(DAY FROM now() AT TIME ZONE 'UTC') THEN
                    IF template.last_run_at IS NULL
                       OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC')
                          < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                        v_should_run := true;
                    END IF;
                END IF;
            END IF;

            IF NOT v_should_run THEN
                CONTINUE;
            END IF;

            -- Fan-Out Configuration
            v_fan_out := COALESCE(template.metadata->'fan_out', '{}'::jsonb);
            
            -- Ghost Parent Protection: Multi-hub requires at least one active hub link.
            IF (v_fan_out->>'has_multiple_hubs')::boolean THEN
                SELECT COUNT(*) INTO v_active_links 
                FROM public.task_context_links 
                WHERE source_id = template.id AND entity_type = 'hub' AND is_active = true;
                
                IF v_active_links = 0 THEN
                    RAISE WARNING '[Generator] Template % (%) has multi-hub enabled but 0 active hub links. Skipping.', 
                        template.id, template.title;
                    CONTINUE;
                END IF;
            END IF;

            -- 2. Create the Parent Task (Hardened)
            INSERT INTO public.tasks (
                text, description, priority, stage_id, vertical_id,
                hub_id, city, "function", assigned_to,
                user_id, created_by, last_updated_by, task_board, metadata
            ) VALUES (
                template.title, template.description, template.priority, 'TODO', template.vertical_id,
                template.hub_id, template.city, template.function_name, template.assigned_to,
                COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                '["Hubs Daily"]'::jsonb, 
                template.metadata || jsonb_build_object('is_fan_out_parent', true)
            ) RETURNING id INTO v_parent_id;

            -- 2. Propagate template links to Parent
            INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id, metadata, is_active)
            SELECT 'task', v_parent_id, entity_type, entity_id, metadata, true
            FROM public.task_context_links
            WHERE source_id = template.id AND source_type = 'template' AND is_active = true;

            -- 3. Branch into Fan-Out Modes
            
            -- MODE 3: MULTI-HUB FAN-OUT
            IF (v_fan_out->>'has_multiple_hubs')::boolean THEN
                FOR v_link IN 
                    SELECT entity_id FROM public.task_context_links 
                    WHERE source_id = template.id AND entity_type = 'hub' AND is_active = true
                LOOP
                    v_hub_id := v_link.entity_id;
                    
                    INSERT INTO public.tasks (
                        text, description, priority, stage_id, vertical_id,
                        hub_id, parent_task_id, task_board, metadata,
                        user_id, created_by, last_updated_by
                    ) VALUES (
                        template.title, template.description, template.priority, 'TODO', template.vertical_id,
                        v_hub_id, v_parent_id, '["Hubs Daily"]'::jsonb,
                        jsonb_build_object('is_fan_out_child', true, 'source_template_id', template.id),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1))
                    ) RETURNING id INTO v_child_id;

                    -- Link Governance Roles (Managers) to child so they see it in their board
                    INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
                    SELECT 'task', v_child_id, 'role', entity_id 
                    FROM public.task_context_links 
                    WHERE source_id = template.id AND entity_type = 'role' AND is_active = true;

                    -- Assignee Overrides
                    IF v_fan_out ? 'hub_assignee_map' THEN
                       v_assignee_ids := ARRAY(
                           SELECT jsonb_array_elements_text(COALESCE(v_fan_out->'hub_assignee_map'->v_hub_id::text, '[]'::jsonb))::uuid
                       );
                       IF array_length(v_assignee_ids, 1) > 0 THEN
                           INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
                           SELECT 'task', v_child_id, 'assignee', e.id
                           FROM public.employees e
                           WHERE e.id = ANY(v_assignee_ids) AND e.status = 'Active';
                       END IF;
                    END IF;
                END LOOP;

            -- MODE 2: MULTI-ASSIGNEE FAN-OUT
            ELSIF (v_fan_out->>'has_sub_assignees')::boolean THEN
                 FOR v_link IN 
                    SELECT tcl.entity_id FROM public.task_context_links tcl
                    JOIN public.employees e ON e.id = tcl.entity_id
                    WHERE tcl.source_id = template.id AND tcl.entity_type = 'assignee' 
                      AND tcl.is_active = true AND e.status = 'Active'
                LOOP
                    INSERT INTO public.tasks (
                        text, description, priority, stage_id, vertical_id,
                        hub_id, assigned_to, parent_task_id, task_board, metadata,
                        user_id, created_by, last_updated_by
                    ) VALUES (
                        template.title, template.description, template.priority, 'TODO', template.vertical_id,
                        template.hub_id, v_link.entity_id, v_parent_id, '["Hubs Daily"]'::jsonb,
                        jsonb_build_object('is_fan_out_child', true, 'source_template_id', template.id),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1)),
                        COALESCE((SELECT id FROM public.user_profiles WHERE id = template.created_by), (SELECT id FROM public.user_profiles LIMIT 1))
                    ) RETURNING id INTO v_child_id;

                    -- Propagate Governance Roles (Managers) to child
                    INSERT INTO public.task_context_links (source_type, source_id, entity_type, entity_id)
                    SELECT 'task', v_child_id, 'role', entity_id 
                    FROM public.task_context_links 
                    WHERE source_id = template.id AND entity_type = 'role' AND is_active = true;
                END LOOP;
            END IF;

            -- Update completion status
            UPDATE public.daily_task_templates SET last_run_at = now() WHERE id = template.id;
            v_tasks_created := v_tasks_created + 1;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[Generator Error] Failed at Template %: %', template.id, SQLERRM;
        END;
    END LOOP;

    RETURN v_tasks_created;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 6: HYBRID RLS SECURITY (Phase 4.1)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Security Helper Function
CREATE OR REPLACE FUNCTION public.check_task_junction(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_profiles up
    JOIN public.employees e ON e.id = up.employee_id
    WHERE up.id = auth.uid()
      AND e.status = 'Active'
      
      -- HUB LINKAGE
      AND EXISTS (
        SELECT 1 FROM public.task_context_links tcl_hub
        WHERE tcl_hub.source_id = p_task_id
          AND tcl_hub.entity_type = 'hub'
          AND tcl_hub.entity_id = e.hub_id
          AND tcl_hub.is_active = true
      )
      
      -- ROLE LINKAGE
      AND (
        NOT EXISTS (
            SELECT 1 FROM public.task_context_links tcl_any_role
            WHERE tcl_any_role.source_id = p_task_id 
              AND tcl_any_role.entity_type = 'role' 
              AND tcl_any_role.is_active = true
        )
        OR EXISTS (
            SELECT 1 FROM public.task_context_links tcl_role
            WHERE tcl_role.source_id = p_task_id
              AND tcl_role.entity_type = 'role'
              AND tcl_role.entity_id = e.role_id
              AND tcl_role.is_active = true
        )
      )
  );
$$;

-- 2. Apply New Visibility Policy
DROP POLICY IF EXISTS "Permit SELECT based on hybrid junction" ON public.tasks;
CREATE POLICY "Permit SELECT based on hybrid junction" ON public.tasks
FOR SELECT USING (
    -- Level 1: Admin/Editor override
    public.get_user_permission_level(vertical_id) IN ('editor','admin')
    
    -- Level 2: Personal Ownership
    OR auth.uid() = assigned_to
    OR EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = tasks.id
          AND tcl.entity_type = 'assignee'
          AND tcl.is_active = true
          AND up.id = auth.uid()
    )

    -- Level 3: The Multi-Hub Junction
    OR public.check_task_junction(id)
);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION 7: PERFORMANCE INDEXES (Phase 4.2)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Metadata GIN Index (For fast JSONB filtering)
CREATE INDEX IF NOT EXISTS idx_tasks_metadata_gin ON public.tasks USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_tcl_metadata_gin ON public.task_context_links USING GIN (metadata);

-- 2. Fan-Out Search Optimization
CREATE INDEX IF NOT EXISTS idx_tasks_parent_child 
    ON public.tasks (parent_task_id) 
    WHERE parent_task_id IS NOT NULL;

-- 3. Composite Link Lookup
CREATE INDEX IF NOT EXISTS idx_tcl_source_hub 
    ON public.task_context_links (source_id, source_type, entity_id) 
    WHERE entity_type = 'hub' AND is_active = true;


-- ═══════════════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
