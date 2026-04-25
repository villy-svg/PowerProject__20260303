-- =========================================================================
-- POWERPROJECT: WARM TASK ARCHIVAL SYSTEM
-- 
-- Moves tasks in 'DEPRIORITIZED' or 'COMPLETED' stages that are older 
-- than 7 days to a backup table to optimize frontend rendering performance.
-- =========================================================================

-- 1. Create Backup Tables (Cloned from originals)
-- FORCE RECREATION to ensure schema is a 1:1 match if previous failed runs left stale tables.
-- WARNING TO DEVELOPERS: If you add a new table with ON DELETE CASCADE from tasks,
-- you MUST also add it to the archival RPC in this file, or data will be purged!
DROP TABLE IF EXISTS public.tasks_backup;
DROP TABLE IF EXISTS public.task_context_links_backup;
DROP TABLE IF EXISTS public.submissions_backup;

CREATE TABLE public.tasks_backup (LIKE public.tasks INCLUDING ALL);
CREATE TABLE public.task_context_links_backup (LIKE public.task_context_links INCLUDING ALL);
CREATE TABLE public.submissions_backup (LIKE public.submissions INCLUDING ALL);

-- Drop inherited foreign keys from backup tables to prevent them from locking hot data
-- or crashing due to broken references when data moves across tables.
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_hub_id_fkey;
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_assigned_to_fkey;
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_parent_task_fkey;
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_parent_task_id_fkey;
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_created_by_fkey;
ALTER TABLE public.tasks_backup DROP CONSTRAINT IF EXISTS tasks_last_updated_by_fkey;

ALTER TABLE public.submissions_backup DROP CONSTRAINT IF EXISTS submissions_task_id_fkey;
ALTER TABLE public.submissions_backup DROP CONSTRAINT IF EXISTS submissions_submitted_by_fkey;
ALTER TABLE public.submissions_backup DROP CONSTRAINT IF EXISTS submissions_entity_id_fkey;

-- 2. Add Comments
COMMENT ON TABLE public.tasks_backup IS 'Warm archival table for old completed or deprioritized tasks. Note: Keep schema in sync with tasks table!';
COMMENT ON TABLE public.task_context_links_backup IS 'Warm archival table for context links of archived tasks.';
COMMENT ON TABLE public.submissions_backup IS 'Warm archival table for submissions of archived tasks.';

-- 3. RLS for tasks_backup
ALTER TABLE public.tasks_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Backup tasks SELECT" ON public.tasks_backup;
CREATE POLICY "Backup tasks SELECT" ON public.tasks_backup
FOR SELECT USING (
    public.get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin')
);

DROP POLICY IF EXISTS "Backup tasks UPDATE" ON public.tasks_backup;
CREATE POLICY "Backup tasks UPDATE" ON public.tasks_backup
FOR UPDATE USING (
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')
);

DROP POLICY IF EXISTS "Backup tasks DELETE" ON public.tasks_backup;
CREATE POLICY "Backup tasks DELETE" ON public.tasks_backup
FOR DELETE USING (
    public.get_user_permission_level(vertical_id) = 'admin'
);

-- 4. RLS for task_context_links_backup
ALTER TABLE public.task_context_links_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Backup tcl SELECT" ON public.task_context_links_backup;
CREATE POLICY "Backup tcl SELECT" ON public.task_context_links_backup
FOR SELECT USING (
    (source_type = 'task' AND EXISTS (
        SELECT 1 FROM public.tasks_backup t
        WHERE t.id = source_id
          AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    ))
);

-- 5. RLS for submissions_backup
ALTER TABLE public.submissions_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Backup submissions SELECT" ON public.submissions_backup;
CREATE POLICY "Backup submissions SELECT" ON public.submissions_backup
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tasks_backup t
        WHERE t.id = submissions_backup.task_id
          AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    )
);

-- 6. Stored Procedure for Archival
CREATE OR REPLACE FUNCTION public.archive_old_tasks_to_backup()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    moved_count_tasks integer := 0;
    moved_count_links integer := 0;
    moved_count_submissions integer := 0;
    task_ids uuid[];
BEGIN
    -- Identify eligible tasks:
    -- 1. Stage is DEPRIORITIZED or COMPLETED
    -- 2. last updated more than 7 days ago
    -- 3. HIERARCHY SAFEGUARD: Do not archive if it has active children that are NOT eligible for archival.
    -- 4. LIMIT 5000 to prevent massive WAL spikes and out-of-memory errors on huge backlogs.
    -- 5. FOR UPDATE SKIP LOCKED to prevent concurrency race conditions if a user modifies the task mid-archive.
    SELECT array_agg(id) INTO task_ids
    FROM (
        SELECT id FROM public.tasks parent
        WHERE (stage_id = 'DEPRIORITIZED' OR stage_id = 'COMPLETED')
          AND updated_at < (now() - INTERVAL '7 days')
          AND NOT EXISTS (
              SELECT 1 FROM public.tasks child
              WHERE child.parent_task_id = parent.id
                AND NOT (
                    (child.stage_id = 'DEPRIORITIZED' OR child.stage_id = 'COMPLETED')
                    AND child.updated_at < (now() - INTERVAL '7 days')
                )
          )
        LIMIT 5000
        FOR UPDATE SKIP LOCKED
    ) sub;

    -- Exit if no tasks found
    IF task_ids IS NULL OR array_length(task_ids, 1) = 0 THEN
        RETURN json_build_object(
            'tasks_moved', 0,
            'links_moved', 0,
            'status', 'no_tasks_eligible'
        );
    END IF;

    -- Step 1: Move tasks to backup
    -- ON CONFLICT DO UPDATE ensures that if a task was restored and re-archived,
    -- we capture the LATEST state rather than keeping the stale original backup.
    INSERT INTO public.tasks_backup
    SELECT * FROM public.tasks
    WHERE id = ANY(task_ids)
    ON CONFLICT (id) DO UPDATE SET
        vertical_id = EXCLUDED.vertical_id,
        stage_id = EXCLUDED.stage_id,
        updated_at = EXCLUDED.updated_at,
        metadata = EXCLUDED.metadata,
        task_board = EXCLUDED.task_board;
    
    GET DIAGNOSTICS moved_count_tasks = ROW_COUNT;

    -- Step 2: Move context links to backup
    INSERT INTO public.task_context_links_backup
    SELECT * FROM public.task_context_links
    WHERE source_id = ANY(task_ids) 
      AND source_type = 'task'
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS moved_count_links = ROW_COUNT;

    -- Step 3: Move submissions to backup
    INSERT INTO public.submissions_backup
    SELECT * FROM public.submissions
    WHERE task_id = ANY(task_ids)
    ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        comment = EXCLUDED.comment,
        links = EXCLUDED.links;

    GET DIAGNOSTICS moved_count_submissions = ROW_COUNT;

    -- Step 4: Delete from active tables
    -- We delete links first due to the logical dependency
    DELETE FROM public.task_context_links
    WHERE source_id = ANY(task_ids)
      AND source_type = 'task';

    -- Deleting from tasks will CASCADE delete from submissions automatically
    -- due to the foreign key constraint on submissions.task_id
    DELETE FROM public.tasks
    WHERE id = ANY(task_ids);

    -- Step 5: Log the run in the system archive_logs table
    INSERT INTO public.archive_logs (run_id, entity_type, status, records_count)
    VALUES (gen_random_uuid(), 'warm_task_archival', 'success', moved_count_tasks)
    ON CONFLICT DO NOTHING;

    -- Step 6: Mark associated entities as archived so the Cold Storage Engine skips them
    -- (The cold storage edge function filters by archived_at IS NULL)
    UPDATE public.entities
    SET archived_at = now()
    WHERE id IN (
        SELECT entity_id FROM public.submissions_backup 
        WHERE task_id = ANY(task_ids) AND entity_id IS NOT NULL
    ) AND archived_at IS NULL;

    -- Step 7: GLOBAL GARBAGE COLLECTION (Technical Debt Cleanup)
    -- Deletes orphaned links in the hot table using Dynamic SQL for extreme resilience.
    -- This ensures we don't crash if daily_tasks or templates are missing in this environment.
    
    -- Cleanup tasks (Always exists)
    EXECUTE 'DELETE FROM public.task_context_links tcl WHERE source_type = ''task'' AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE id = tcl.source_id)';
    
    -- Cleanup daily_tasks (Optional)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_tasks') THEN
        EXECUTE 'DELETE FROM public.task_context_links tcl WHERE source_type = ''daily_task'' AND NOT EXISTS (SELECT 1 FROM public.daily_tasks WHERE id = tcl.source_id)';
    END IF;

    -- Cleanup templates (Optional)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_task_templates') THEN
        EXECUTE 'DELETE FROM public.task_context_links tcl WHERE source_type = ''template'' AND NOT EXISTS (SELECT 1 FROM public.daily_task_templates WHERE id = tcl.source_id)';
    END IF;

    -- Log Result
    RAISE NOTICE 'Archival completed: Moved % tasks, % links, % submissions.', moved_count_tasks, moved_count_links, moved_count_submissions;

    RETURN json_build_object(
        'tasks_moved', moved_count_tasks,
        'links_moved', moved_count_links,
        'submissions_moved', moved_count_submissions,
        'status', 'success'
    );
END;
$$;

-- =========================================================================
-- 7. PERFORMANCE OPTIMIZATIONS (Technical Debt Cleanup)
-- Adding missing indexes on foreign keys and common query paths to 
-- dramatically improve PostgREST join performance across the task engine.
-- Wraps in DO block for environment-aware resiliency.
-- =========================================================================
DO $$
BEGIN
    -- Core Tasks (Must exist)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        CREATE INDEX IF NOT EXISTS idx_tasks_hub_id ON public.tasks USING btree (hub_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks USING btree (parent_task_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_last_updated_by ON public.tasks USING btree (last_updated_by);
        CREATE INDEX IF NOT EXISTS idx_tasks_vertical_stage ON public.tasks USING btree (vertical_id, stage_id);
    END IF;

    -- Daily Tasks (Optional - might be missing in drifted environments)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_tasks') THEN
        CREATE INDEX IF NOT EXISTS idx_dt_assigned_to ON public.daily_tasks USING btree (assigned_to);
        CREATE INDEX IF NOT EXISTS idx_dt_hub_id ON public.daily_tasks USING btree (hub_id);
        CREATE INDEX IF NOT EXISTS idx_dt_vertical_stage ON public.daily_tasks USING btree (vertical_id, stage_id);
    END IF;

    -- Templates (Optional)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_task_templates') THEN
        CREATE INDEX IF NOT EXISTS idx_dtt_hub_id ON public.daily_task_templates USING btree (hub_id);
        CREATE INDEX IF NOT EXISTS idx_dtt_vertical_id ON public.daily_task_templates USING btree (vertical_id);
    END IF;
END $$;

-- =========================================================================
-- 8. POSTGREST PARITY: COMPUTED RELATIONSHIPS FOR BACKUP TABLES
-- Allows: .from('tasks_backup').select('*, assignees(*), submissions(*)')
-- ensuring archived tasks look and feel identical to hot tasks in the UI.
-- =========================================================================

DO $$
BEGIN
    -- Only create if the backup table exists (which it should, but we are being hyper-resilient)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks_backup') THEN
        
        -- assignees
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'assignees' AND proargtypes[0]::regtype::text = 'public.tasks_backup') THEN
            CREATE FUNCTION public.assignees(t public.tasks_backup)
            RETURNS SETOF public.employees AS $f$
                SELECT e.* FROM public.employees e
                JOIN public.task_context_links_backup tcl ON tcl.entity_id = e.id
                WHERE tcl.source_id = t.id
                  AND tcl.source_type = 'task'
                  AND tcl.entity_type = 'assignee';
            $f$ LANGUAGE sql STABLE;
        END IF;

        -- submissions
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submissions' AND proargtypes[0]::regtype::text = 'public.tasks_backup') THEN
            CREATE FUNCTION public.submissions(t public.tasks_backup)
            RETURNS SETOF public.submissions_backup AS $f$
                SELECT * FROM public.submissions_backup
                WHERE task_id = t.id;
            $f$ LANGUAGE sql STABLE;
        END IF;

    END IF;

    -- submitter
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions_backup') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'submitter' AND proargtypes[0]::regtype::text = 'public.submissions_backup') THEN
            CREATE FUNCTION public.submitter(s public.submissions_backup)
            RETURNS public.user_profiles AS $f$
                SELECT * FROM public.user_profiles
                WHERE id = s.submitted_by;
            $f$ LANGUAGE sql STABLE;
        END IF;
    END IF;
END $$;

-- =========================================================================
-- 9. GLOBAL PERFORMANCE UPGRADE: STABLE RLS PERMISSIONS
-- Redefining the core permission function as STABLE to allow PostgreSQL 
-- to cache results within a single query, dramatically reducing CPU load.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role_id text;
    v_level text;
BEGIN
    SELECT role_id INTO v_role_id
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF v_role_id = 'master_admin' THEN RETURN 'admin';
    ELSIF v_role_id = 'master_editor' THEN RETURN 'editor';
    ELSIF v_role_id = 'master_contributor' THEN RETURN 'contributor';
    ELSIF v_role_id = 'master_viewer' THEN RETURN 'viewer';
    END IF;

    SELECT access_level INTO v_level
    FROM public.vertical_access
    WHERE user_id = auth.uid() AND vertical_id = v_id;

    RETURN COALESCE(v_level, 'viewer');
END;
$$;

-- 9. Reload Schema
NOTIFY pgrst, 'reload schema';
