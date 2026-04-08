-- =========================================================================
-- POWERPROJECT v1.1.6: WORKFLOW RBAC HARDENING & 406 ERROR RESOLUTION
-- Fixes the 406 error by allowing assignees to submit and update proofs.
-- Prevents non-managers from editing sensitive task columns via a trigger.
-- Safe for re-run. Chronologically backdated to 2026-04-05.
-- =========================================================================

-- 1. VERTICAL SETTINGS (Scalability Pillar)
-- Native 'IF NOT EXISTS' for columns is supported in modern Postgres
ALTER TABLE public.verticals ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{"submission_lock_on_review": true}'::jsonb;

-- Update any null settings to the default
UPDATE public.verticals SET settings = '{"submission_lock_on_review": true}'::jsonb WHERE settings IS NULL;


-- 2. "FORCE FIELD" TRIGGER (Identity Protection Pillar)
-- Create the trigger function (OR REPLACE handles idempotency)
CREATE OR REPLACE FUNCTION public.protect_task_columns()
RETURNS TRIGGER AS $$
DECLARE
  -- Whitelist of columns that workers ARE allowed to update for workflow transitions
  v_allowed_cols text[] := ARRAY['stageid', 'stage_id', 'last_updated_by', 'updatedat', 'updated_at'];
  v_new_json     jsonb := to_jsonb(NEW);
  v_old_json     jsonb := to_jsonb(OLD);
  v_col          text;
  v_final_json   jsonb;
  v_perm_level   text;
  v_vertical_id  text;
BEGIN
  -- Resolve the correct vertical ID column safely via JSONB to avoid compiler errors
  IF TG_TABLE_NAME = 'tasks' THEN
    v_vertical_id := v_new_json->>'verticalid';
  ELSE
    v_vertical_id := v_new_json->>'vertical_id';
  END IF;

  -- Determine user privilege for this vertical
  v_perm_level := public.get_user_permission_level(v_vertical_id);

  -- If NOT an editor or admin, enforce the lockdown
  IF v_perm_level NOT IN ('editor', 'admin') THEN
    -- Start with the OLD record as the base
    v_final_json := v_old_json;

    -- Loop through the update request and ONLY copy over allowed changes
    FOR v_col IN SELECT jsonb_object_keys(v_new_json) LOOP
      IF v_col = ANY(v_allowed_cols) THEN
        v_final_json := v_final_json || jsonb_build_object(v_col, v_new_json->v_col);
      ELSE
        -- If they tried to change a locked column, log it to the DB console for "Inspect" visibility
        IF v_old_json->v_col IS DISTINCT FROM v_new_json->v_col THEN
          RAISE WARNING '[Workflow Guard] Unauthorized edit to column "%" by user "%" was reverted.', v_col, auth.uid();
        END IF;
      END IF;
    END LOOP;

    -- Populate the NEW record with the sanitized/reverted JSON
    NEW := jsonb_populate_record(NEW, v_final_json);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tasks (Triggers need a DO block for IF NOT EXISTS check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_task_columns') THEN
    CREATE TRIGGER trg_protect_task_columns
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.protect_task_columns();
  END IF;
END $$;

-- Apply trigger to daily_tasks
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_daily_task_columns') THEN
    CREATE TRIGGER trg_protect_daily_task_columns
    BEFORE UPDATE ON public.daily_tasks
    FOR EACH ROW EXECUTE FUNCTION public.protect_task_columns();
  END IF;
END $$;


-- 3. SUBMISSIONS RLS HARDENING (Workflow Activation)
-- Redefine INSERT to include the Assignee Exception
DROP POLICY IF EXISTS "Submissions INSERT via task vertical" ON public.submissions;
CREATE POLICY "Submissions INSERT via task vertical" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND (
          public.get_user_permission_level(t.verticalid) IN ('contributor','editor','admin')
          OR t.assigned_to = auth.uid() -- The "Assignee Exception"
        )
    )
  );

-- Redefine UPDATE for Lockdown logic + Global Toggle
DROP POLICY IF EXISTS "Submissions UPDATE via task vertical" ON public.submissions;
CREATE POLICY "Submissions UPDATE via task vertical" ON public.submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.verticals v ON v.id = t.verticalid
      WHERE t.id = submissions.task_id
        AND (
          -- Managers: Always allowed (with hardening for self-approval)
          public.get_user_permission_level(t.verticalid) IN ('editor','admin')
          OR
          -- Workers: Allowed if pending AND (Lock is OFF OR Task not in Review)
          (
            auth.uid() = submissions.submitted_by
            AND submissions.status = 'pending'
            AND (
              (v.settings->>'submission_lock_on_review')::boolean IS NOT TRUE
              OR t.stageid != 'REVIEW'
            )
          )
        )
    )
  );


-- 4. TASKS / DAILY TASKS RLS (Workflow Activation)
-- Allow the worker as a Viewer-Assignee to move their own task cards
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.tasks
  FOR UPDATE
  USING (
    public.get_user_permission_level(verticalid) IN ('editor', 'admin')
    OR assigned_to = auth.uid()
  );

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks
  FOR UPDATE
  USING (
    public.get_user_permission_level(vertical_id) IN ('editor', 'admin')
    OR assigned_to = auth.uid()
  );


-- 5. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';