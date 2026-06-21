-- =========================================================================
-- WARM TASK ARCHIVAL SYSTEM - COOLDOWN OVERRIDE
-- 
-- Modifies the archive_old_tasks_to_backup function to accept an optional
-- p_ignore_cooldown parameter. When true, it archives COMPLETED and 
-- DEPRIORITIZED tasks immediately, bypassing the 7-day waiting period.
-- =========================================================================

-- Drop the old parameter-less version to avoid signature conflicts in PostgREST
DROP FUNCTION IF EXISTS public.archive_old_tasks_to_backup();

-- Create the new version with the p_ignore_cooldown parameter
CREATE OR REPLACE FUNCTION public.archive_old_tasks_to_backup(p_ignore_cooldown boolean DEFAULT false)
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
    -- 2. last updated more than 7 days ago OR p_ignore_cooldown is true
    -- 3. HIERARCHY SAFEGUARD: Do not archive if it has active children that are NOT eligible for archival.
    -- 4. LIMIT 5000 to prevent massive WAL spikes and out-of-memory errors on huge backlogs.
    -- 5. FOR UPDATE SKIP LOCKED to prevent concurrency race conditions if a user modifies the task mid-archive.
    SELECT array_agg(id) INTO task_ids
    FROM (
        SELECT id FROM public.tasks parent
        WHERE (stage_id = 'DEPRIORITIZED' OR stage_id = 'COMPLETED')
          AND (p_ignore_cooldown OR updated_at < (now() - INTERVAL '7 days'))
          AND NOT EXISTS (
              SELECT 1 FROM public.tasks child
              WHERE child.parent_task_id = parent.id
                AND NOT (
                    (child.stage_id = 'DEPRIORITIZED' OR child.stage_id = 'COMPLETED')
                    AND (p_ignore_cooldown OR child.updated_at < (now() - INTERVAL '7 days'))
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

-- Reload Schema
NOTIFY pgrst, 'reload schema';
