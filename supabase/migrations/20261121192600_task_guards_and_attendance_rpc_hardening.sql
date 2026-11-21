-- =========================================================================
-- POWERPROJECT: Attendance Closure — Part 2/3: Task Trigger Guards &
--               Scoped Maker-Checker RPC Hardening
-- Migration: 20261121192600_task_guards_and_attendance_rpc_hardening.sql
--
-- Linked Runbooks:
--   docs/runbooks/attendance-closure-phased-rollout/phase-3-unmarked-attendance-pilot.md
--   docs/runbooks/attendance-closure-phased-rollout/phase-4-automated-batch-rollout.md
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped file),
--                             §5 (PostgreSQL Kick: NOTIFY pgrst)
--   rbac-security-system §3 (Scoped GUC bypass — preserves protect_task_columns
--                            enforcement on rpc_orchestrate_tasks)
--   production-safeguards (Push-storm suppression GUC, active profile resolution)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Push-Storm Guard on notify_on_task_change()
-- Preserves 100% of existing behavior; only skips when a server-side batch
-- explicitly sets transaction-local `app.suppress_task_push = 'on'`.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_task_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_user_id uuid;
BEGIN
  -- Allow batch generators & silent auto-close triggers to suppress per-row push storms
  IF current_setting('app.suppress_task_push', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- assigned_to is an employee_id. We need the active auth user_id from user_profiles to match fcm_tokens.
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT id INTO v_user_id
    FROM public.user_profiles
    WHERE employee_id = NEW.assigned_to
      AND is_active = true
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  -- If we cannot resolve to a user profile, we cannot send a push notification.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'New Task Assigned',
         'body', 'You have been assigned: ' || NEW.text,
         'type', 'task_assigned',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );

       PERFORM public.trigger_push_notification(v_payload);
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- SCENARIO A: Task Assigned (changed)
    IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'New Task Assigned',
         'body', 'You have been assigned: ' || NEW.text,
         'type', 'task_assigned',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );

       PERFORM public.trigger_push_notification(v_payload);

    -- SCENARIO B: Task Status Changed
    -- Ignore assignment changes and only look at stage changes
    ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.assigned_to IS NOT NULL THEN
       v_payload := jsonb_build_object(
         'user_id', v_user_id,
         'title', 'Task Status Updated',
         'body', 'Task "' || NEW.text || '" moved to ' || NEW.stage_id,
         'type', 'task_status_changed',
         'entity_id', NEW.id,
         'entity_type', 'task'
       );

       PERFORM public.trigger_push_notification(v_payload);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 1B: Scoped Trusted Bypass in protect_task_columns()
-- Without this, when an employee's own check-in or self-Week-Off fires
-- func_daily_attendances_auto_close_closure_tasks(), or a Contributor/Viewer
-- Reporting Manager calls rpc_submit_attendance_task_choice(), auth.uid() is
-- a viewer/contributor and protect_task_columns() would silently revert
-- `metadata` / `assigned_to`.
-- SECURITY: Intentionally does NOT blanket-bypass `current_user = 'postgres'`
-- because other SECURITY DEFINER RPCs (such as rpc_orchestrate_tasks) rely on
-- protect_task_columns() to prevent Contributors from overwriting task fields.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_task_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allowed_cols text[] := ARRAY['stage_id', 'last_updated_by', 'updated_at', 'parent_task_id'];
  v_new_json     jsonb  := to_jsonb(NEW);
  v_old_json     jsonb  := to_jsonb(OLD);
  v_col          text;
  v_final_json   jsonb;
  v_perm_level   text;
  v_vertical_id  text;
BEGIN
  -- Allow only explicit server/SQL contexts (service_role or no JWT uid) or
  -- callers that explicitly opted in via transaction-local bypass GUC.
  IF current_user = 'service_role'
     OR auth.uid() IS NULL
     OR current_setting('app.bypass_task_column_guard', true) = 'on' THEN
    RETURN NEW;
  END IF;

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
$$;


-- -------------------------------------------------------------------------
-- SECTION 1C: Scoped GUC Opt-In on Attendance Maker-Checker RPCs
-- Wraps UPDATE public.tasks in rpc_submit/approve/reject_attendance_task*
-- with transaction-local `app.bypass_task_column_guard = 'on'` so assigned
-- Contributor/Viewer Reporting Managers and Checkers can cleanly update
-- `assigned_to`, `description`, and `metadata` without weakening
-- protect_task_columns() for other SECURITY DEFINER RPCs.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_attendance_task_choice(
  p_task_id uuid,
  p_status  text,
  p_note    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller            uuid := auth.uid();
  v_caller_profile    record;
  v_task              public.tasks%ROWTYPE;
  v_task_type         text;
  v_subject_emp_id    uuid;
  v_shift_date        date;
  v_maker_emp_id      uuid;
  v_maker_name        text;
  v_checker_rec       record;
  v_edit_request_id   uuid;
  v_clean_note        text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_new_description   text;
  v_orphan_mgr_prefix text;
  v_new_metadata      jsonb;
  v_existing_da       record;
  v_prev_bypass_guard text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
  END IF;

  -- Hard-block 'present' at DB layer
  IF p_status NOT IN ('week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
    RAISE EXCEPTION 'Invalid attendance status "%". Marking Present is not permitted from this task.', COALESCE(p_status, 'NULL');
  END IF;

  SELECT id, name, email, employee_id, role_id, is_active
  INTO v_caller_profile
  FROM public.user_profiles
  WHERE id = v_caller;

  IF NOT FOUND OR NOT COALESCE(v_caller_profile.is_active, false) THEN
    RAISE EXCEPTION 'Unauthorized: inactive user profile.';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found.';
  END IF;

  v_task_type := v_task.metadata->>'type';
  IF v_task_type NOT IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE') THEN
    RAISE EXCEPTION 'Task is not an attendance closure task.';
  END IF;

  IF v_task.stage_id <> 'BACKLOG' THEN
    RAISE EXCEPTION 'Attendance status can only be submitted while the task is in BACKLOG (current stage: %).', v_task.stage_id;
  END IF;

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND public.get_user_permission_level('EMPLOYEES') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned reporting manager or an Employees Admin can submit this attendance mark.';
  END IF;

  v_subject_emp_id := (v_task.metadata->>'employee_id')::uuid;
  v_shift_date     := (v_task.metadata->>'shift_date')::date;
  v_maker_emp_id   := COALESCE(v_caller_profile.employee_id, v_task.assigned_to);
  v_maker_name     := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Manager');

  -- Concurrency guard: if attendance was already recorded for (employee, date)
  -- (e.g. concurrent check-in or Attendance Board edit whose auto-close trigger
  -- skipped this locked row via FOR UPDATE SKIP LOCKED), auto-resolve cleanly
  -- instead of creating a stale pending edit request and REVIEW task.
  SELECT attendance_status, marked_source INTO v_existing_da
  FROM public.daily_attendances
  WHERE employee_id = v_subject_emp_id
    AND shift_date = v_shift_date;

  IF FOUND THEN
    v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_resolved',        true,
      'auto_resolved_at',     now(),
      'auto_resolved_status', v_existing_da.attendance_status::text,
      'auto_resolved_source', COALESCE(v_existing_da.marked_source, 'attendance_board'),
      'review_note',          'Auto-closed: attendance already marked as ' || COALESCE(v_existing_da.attendance_status::text, 'recorded')
                              || ' via ' || COALESCE(v_existing_da.marked_source, 'attendance_board') || '.'
    );

    v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
    BEGIN
      PERFORM set_config('app.bypass_task_column_guard', 'on', true);
      UPDATE public.tasks
      SET stage_id = 'COMPLETED', metadata = v_new_metadata, last_updated_by = v_caller, updated_at = now()
      WHERE id = p_task_id;
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
      RAISE;
    END;

    RETURN jsonb_build_object(
      'status', 'already_marked',
      'task_id', p_task_id,
      'attendance_status', v_existing_da.attendance_status::text
    );
  END IF;

  INSERT INTO public.attendance_edit_requests (
    employee_id, shift_date, suggested_status, requested_by,
    request_status, maker_note, created_at, updated_at
  )
  VALUES (
    v_subject_emp_id, v_shift_date, p_status::public.attendance_status_enum, v_caller,
    'pending', COALESCE(v_clean_note, 'Submitted via attendance closure task'), now(), now()
  )
  RETURNING id INTO v_edit_request_id;

  SELECT * INTO v_checker_rec
  FROM public.fn_find_first_editor_in_hierarchy(v_maker_emp_id, v_caller);

  v_new_description := COALESCE(v_task.description, '');
  IF COALESCE(v_checker_rec.is_orphan_manager, false) THEN
    v_orphan_mgr_prefix := '⚠️ ORPHAN MANAGER: Submitting manager ' || v_maker_name
      || ' has no Editor or above in their reporting hierarchy.';
    IF position('⚠️ ORPHAN MANAGER:' IN v_new_description) = 0 THEN
      v_new_description := v_orphan_mgr_prefix || E'\n\n' || v_new_description;
    END IF;
  END IF;

  v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
    'is_orphan_manager',   COALESCE(v_checker_rec.is_orphan_manager, false),
    'maker_employee_id',   v_maker_emp_id,
    'maker_user_id',       v_caller,
    'maker_name',          v_maker_name,
    'suggested_status',    p_status,
    'maker_note',          v_clean_note,
    'submitted_at',        now(),
    'edit_request_id',     v_edit_request_id,
    'checker_employee_id', v_checker_rec.checker_employee_id,
    'checker_user_id',     v_checker_rec.checker_user_id
  );

  v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
  BEGIN
    PERFORM set_config('app.bypass_task_column_guard', 'on', true);

    UPDATE public.tasks
    SET
      stage_id        = 'REVIEW',
      assigned_to     = v_checker_rec.checker_employee_id,
      description     = v_new_description,
      metadata        = v_new_metadata,
      last_updated_by = v_caller,
      updated_at      = now()
    WHERE id = p_task_id;

    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    RAISE;
  END;

  UPDATE public.task_context_links
  SET is_active = false
  WHERE source_type = 'task'
    AND source_id = p_task_id
    AND entity_type = 'assignee';

  IF v_checker_rec.checker_employee_id IS NOT NULL THEN
    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (p_task_id, 'task', 'assignee', v_checker_rec.checker_employee_id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id)
    DO UPDATE SET is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'status', 'submitted',
    'task_id', p_task_id,
    'edit_request_id', v_edit_request_id,
    'checker_employee_id', v_checker_rec.checker_employee_id,
    'is_orphan_manager', COALESCE(v_checker_rec.is_orphan_manager, false)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_approve_attendance_task(
  p_task_id     uuid,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller            uuid := auth.uid();
  v_caller_profile    record;
  v_task              public.tasks%ROWTYPE;
  v_task_type         text;
  v_subject_emp_id    uuid;
  v_shift_date        date;
  v_suggested_status  text;
  v_maker_user_id     uuid;
  v_edit_request_id   uuid;
  v_existing_status   public.attendance_status_enum;
  v_checker_name      text;
  v_clean_note        text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_rows_affected     integer := 0;
  v_new_metadata      jsonb;
  v_prev_bypass_guard text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
  END IF;

  SELECT id, name, email, employee_id, role_id, is_active
  INTO v_caller_profile
  FROM public.user_profiles
  WHERE id = v_caller;

  IF NOT FOUND OR NOT COALESCE(v_caller_profile.is_active, false) THEN
    RAISE EXCEPTION 'Unauthorized: inactive user profile.';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found.';
  END IF;

  v_task_type := v_task.metadata->>'type';
  IF v_task_type NOT IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE') THEN
    RAISE EXCEPTION 'Task is not an attendance closure task.';
  END IF;

  IF v_task.stage_id <> 'REVIEW' THEN
    RAISE EXCEPTION 'Only tasks in REVIEW can be approved (current stage: %).', v_task.stage_id;
  END IF;

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND v_caller_profile.role_id <> 'master_editor'
     AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned Checker or an Employees Editor/Admin can approve this task.';
  END IF;

  v_maker_user_id := NULLIF(v_task.metadata->>'maker_user_id', '')::uuid;

  IF v_maker_user_id IS NOT NULL
     AND v_maker_user_id = v_caller
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot approve your own attendance submission.';
  END IF;

  v_subject_emp_id   := (v_task.metadata->>'employee_id')::uuid;
  v_shift_date       := (v_task.metadata->>'shift_date')::date;
  v_suggested_status := v_task.metadata->>'suggested_status';
  v_edit_request_id  := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
  v_checker_name     := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Checker');

  IF v_suggested_status NOT IN ('week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
    RAISE EXCEPTION 'Invalid suggested status on task metadata.';
  END IF;

  SELECT attendance_status INTO v_existing_status
  FROM public.daily_attendances
  WHERE employee_id = v_subject_emp_id
    AND shift_date = v_shift_date;

  IF v_existing_status = 'present' THEN
    IF v_edit_request_id IS NOT NULL THEN
      UPDATE public.attendance_edit_requests
      SET
        request_status = 'rejected',
        reviewed_by    = v_caller,
        review_note    = 'Preserved existing Present record.',
        updated_at     = now()
      WHERE id = v_edit_request_id AND request_status = 'pending';
    END IF;

    v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_resolved',   true,
      'checker_user_id', v_caller,
      'checker_name',    v_checker_name,
      'reviewed_at',     now(),
      'review_note',     COALESCE(v_clean_note, 'Employee already marked Present — existing record preserved.')
    );

    v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
    BEGIN
      PERFORM set_config('app.bypass_task_column_guard', 'on', true);
      UPDATE public.tasks
      SET stage_id = 'COMPLETED', metadata = v_new_metadata, last_updated_by = v_caller, updated_at = now()
      WHERE id = p_task_id;
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
      RAISE;
    END;

    RETURN jsonb_build_object('status', 'preserved_present', 'task_id', p_task_id);
  END IF;

  INSERT INTO public.daily_attendances (
    employee_id, shift_date, attendance_status, session_logs_data,
    marked_by, approved_by, marked_source, created_at, updated_at
  )
  VALUES (
    v_subject_emp_id, v_shift_date, v_suggested_status::public.attendance_status_enum, '[]'::jsonb,
    v_maker_user_id, v_caller, 'unmarked_task', now(), now()
  )
  ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    attendance_status = EXCLUDED.attendance_status,
    marked_by         = EXCLUDED.marked_by,
    approved_by       = EXCLUDED.approved_by,
    marked_source     = EXCLUDED.marked_source,
    updated_at        = now()
  WHERE daily_attendances.attendance_status <> 'present';

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    IF v_edit_request_id IS NOT NULL THEN
      UPDATE public.attendance_edit_requests
      SET
        request_status = 'rejected',
        reviewed_by    = v_caller,
        review_note    = 'Preserved existing Present record.',
        updated_at     = now()
      WHERE id = v_edit_request_id AND request_status = 'pending';
    END IF;

    v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
      'auto_resolved',   true,
      'checker_user_id', v_caller,
      'checker_name',    v_checker_name,
      'reviewed_at',     now(),
      'review_note',     COALESCE(v_clean_note, 'Employee already marked Present — existing record preserved.')
    );

    v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
    BEGIN
      PERFORM set_config('app.bypass_task_column_guard', 'on', true);
      UPDATE public.tasks
      SET stage_id = 'COMPLETED', metadata = v_new_metadata, last_updated_by = v_caller, updated_at = now()
      WHERE id = p_task_id;
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
      RAISE;
    END;

    RETURN jsonb_build_object('status', 'preserved_present', 'task_id', p_task_id);
  END IF;

  IF v_edit_request_id IS NOT NULL THEN
    UPDATE public.attendance_edit_requests
    SET
      request_status = 'approved',
      reviewed_by    = v_caller,
      review_note    = v_clean_note,
      updated_at     = now()
    WHERE id = v_edit_request_id AND request_status = 'pending';
  END IF;

  v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
    'checker_user_id', v_caller,
    'checker_name',    v_checker_name,
    'reviewed_at',     now(),
    'review_note',     v_clean_note
  );

  v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
  BEGIN
    PERFORM set_config('app.bypass_task_column_guard', 'on', true);
    UPDATE public.tasks
    SET stage_id = 'COMPLETED', metadata = v_new_metadata, last_updated_by = v_caller, updated_at = now()
    WHERE id = p_task_id;
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    RAISE;
  END;

  RETURN jsonb_build_object(
    'status', 'approved',
    'task_id', p_task_id,
    'attendance_status', v_suggested_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reject_attendance_task(
  p_task_id     uuid,
  p_review_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller            uuid := auth.uid();
  v_caller_profile    record;
  v_task              public.tasks%ROWTYPE;
  v_task_type         text;
  v_maker_emp_id      uuid;
  v_reassign_emp_id   uuid;
  v_edit_request_id   uuid;
  v_checker_name      text;
  v_clean_note        text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_new_metadata      jsonb;
  v_prev_bypass_guard text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
  END IF;

  SELECT id, name, email, employee_id, role_id, is_active
  INTO v_caller_profile
  FROM public.user_profiles
  WHERE id = v_caller;

  IF NOT FOUND OR NOT COALESCE(v_caller_profile.is_active, false) THEN
    RAISE EXCEPTION 'Unauthorized: inactive user profile.';
  END IF;

  SELECT * INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found.';
  END IF;

  v_task_type := v_task.metadata->>'type';
  IF v_task_type NOT IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE') THEN
    RAISE EXCEPTION 'Task is not an attendance closure task.';
  END IF;

  IF v_task.stage_id <> 'REVIEW' THEN
    RAISE EXCEPTION 'Only tasks in REVIEW can be rejected (current stage: %).', v_task.stage_id;
  END IF;

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND v_caller_profile.role_id <> 'master_editor'
     AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned Checker or an Employees Editor/Admin can reject this task.';
  END IF;

  v_maker_emp_id    := NULLIF(v_task.metadata->>'maker_employee_id', '')::uuid;
  v_edit_request_id := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
  v_checker_name    := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Checker');

  IF v_edit_request_id IS NOT NULL THEN
    UPDATE public.attendance_edit_requests
    SET
      request_status = 'rejected',
      reviewed_by    = v_caller,
      review_note    = v_clean_note,
      updated_at     = now()
    WHERE id = v_edit_request_id AND request_status = 'pending';
  END IF;

  v_new_metadata := COALESCE(v_task.metadata, '{}'::jsonb) || jsonb_build_object(
    'last_rejection_note', COALESCE(v_clean_note, 'Rejected by reviewer — please re-verify and re-submit.'),
    'rejected_by_name',    v_checker_name,
    'rejected_at',         now(),
    'checker_user_id',     v_caller,
    'checker_name',        v_checker_name,
    'review_note',         v_clean_note
  );

  -- Re-verify Maker is still Active with an active app login; else fallback to Master Admin
  IF v_maker_emp_id IS NOT NULL THEN
    SELECT m.id INTO v_reassign_emp_id
    FROM public.employees m
    WHERE m.id = v_maker_emp_id
      AND m.status = 'Active'
      AND EXISTS (
        SELECT 1
        FROM public.user_profiles up_m
        WHERE up_m.employee_id = m.id
          AND up_m.is_active = true
      );
  END IF;

  IF v_reassign_emp_id IS NULL THEN
    v_reassign_emp_id := public.fn_get_fallback_master_admin_employee(NULL);
  END IF;

  v_prev_bypass_guard := current_setting('app.bypass_task_column_guard', true);
  BEGIN
    PERFORM set_config('app.bypass_task_column_guard', 'on', true);

    UPDATE public.tasks
    SET
      stage_id        = 'BACKLOG',
      assigned_to     = v_reassign_emp_id,
      metadata        = v_new_metadata,
      last_updated_by = v_caller,
      updated_at      = now()
    WHERE id = p_task_id;

    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    RAISE;
  END;

  UPDATE public.task_context_links
  SET is_active = false
  WHERE source_type = 'task'
    AND source_id = p_task_id
    AND entity_type = 'assignee';

  IF v_reassign_emp_id IS NOT NULL THEN
    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (p_task_id, 'task', 'assignee', v_reassign_emp_id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id)
    DO UPDATE SET is_active = true;
  END IF;

  RETURN jsonb_build_object('status', 'rejected', 'task_id', p_task_id);
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 2: Least-Privilege Grants
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_approve_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_attendance_task(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_reject_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reject_attendance_task(uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- SECTION 3: Evolution Ledger Log & PostgREST Schema Reload (Mandatory)
-- -------------------------------------------------------------------------
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261121192600_task_guards_and_attendance_rpc_hardening',
  'Attendance Closure Part 2/3: push-storm suppression GUC + active profile lookup in notify_on_task_change, scoped bypass + search_path in protect_task_columns, and explicit app.bypass_task_column_guard opt-in on rpc_submit/approve/reject_attendance_task*.',
  ARRAY['tasks', 'attendance_edit_requests', 'daily_attendances']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
