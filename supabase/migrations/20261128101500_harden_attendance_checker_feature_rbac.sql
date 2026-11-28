-- =========================================================================
-- Migration: 20261128101500_harden_attendance_checker_feature_rbac.sql
-- Purpose:
--   Align Checker authorization in rpc_approve_attendance_task and
--   rpc_reject_attendance_task with Maker authorization and frontend
--   canReviewAttendanceTask() by enforcing effective Attendance Board
--   Editor+ access: min(EMPLOYEES vertical, canAccessEmployeeAttendanceBoard).
--
--   Previously, a user with EMPLOYEES = editor/admin whose feature override
--   for canAccessEmployeeAttendanceBoard was downgraded to viewer/none (or a
--   non-Editor assigned on the task) could still approve/reject attendance
--   closure tasks at the DB layer.
--
-- Security Invariants Preserved:
--   - Active profile check, subject-employee self-action block, and
--     Maker-Checker self-approval block remain intact (master_admin only bypass).
--   - Present (Day/Night) shift_type persistence and existing Present record
--     preservation from 20261127213500 remain intact.
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped), §5 (NOTIFY pgrst)
--   rbac-security-system §3 (Authorization inside SECURITY DEFINER RPCs)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: rpc_approve_attendance_task
-- -------------------------------------------------------------------------
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
  v_caller                     uuid := auth.uid();
  v_caller_profile             record;
  v_task                       public.tasks%ROWTYPE;
  v_task_type                  text;
  v_subject_emp_id             uuid;
  v_shift_date                 date;
  v_suggested_status           text;
  v_suggested_shift_type       text;
  v_maker_user_id              uuid;
  v_edit_request_id            uuid;
  v_existing_status            public.attendance_status_enum;
  v_checker_name               text;
  v_clean_note                 text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_rows_affected              integer := 0;
  v_new_metadata               jsonb;
  v_prev_bypass_guard          text;
  v_emp_vertical_level         text;
  v_attendance_feature_level   text;
  v_effective_attendance_level text;
  v_vertical_rank              integer;
  v_feature_rank               integer;
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
  IF COALESCE(v_task_type, '') NOT IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE') THEN
    RAISE EXCEPTION 'Task is not an attendance closure task.';
  END IF;

  IF v_task.stage_id <> 'REVIEW' THEN
    RAISE EXCEPTION 'Only tasks in REVIEW can be approved (current stage: %).', v_task.stage_id;
  END IF;

  v_subject_emp_id := NULLIF(v_task.metadata->>'employee_id', '')::uuid;
  IF v_subject_emp_id IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing employee_id.';
  END IF;

  -- Block subject employee from approving their own attendance closure task (unless master_admin)
  IF v_caller_profile.employee_id IS NOT NULL
     AND v_caller_profile.employee_id = v_subject_emp_id
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot approve your own attendance closure task.';
  END IF;

  -- Checker authorization: require effective Attendance Board Editor+ for all non-master_admin callers
  IF NOT public.is_master_admin() THEN
    IF COALESCE(v_caller_profile.role_id, '') = 'master_editor' THEN
      v_effective_attendance_level := 'editor';
    ELSIF COALESCE(v_caller_profile.role_id, '') = 'master_contributor' THEN
      v_effective_attendance_level := 'contributor';
    ELSIF COALESCE(v_caller_profile.role_id, '') = 'master_viewer' THEN
      v_effective_attendance_level := 'viewer';
    ELSE
      v_emp_vertical_level := LOWER(TRIM(COALESCE(public.get_user_permission_level('EMPLOYEES'), 'none')));

      SELECT LOWER(TRIM(fa.access_level))
      INTO v_attendance_feature_level
      FROM public.feature_access fa
      WHERE fa.user_id = v_caller
        AND UPPER(TRIM(fa.vertical_id)) = 'EMPLOYEES'
        AND fa.feature_id = 'canAccessEmployeeAttendanceBoard'
      LIMIT 1;

      v_attendance_feature_level := COALESCE(v_attendance_feature_level, v_emp_vertical_level);

      v_vertical_rank := CASE v_emp_vertical_level
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'contributor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END;

      v_feature_rank := CASE v_attendance_feature_level
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'contributor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END;

      v_effective_attendance_level := CASE LEAST(v_vertical_rank, v_feature_rank)
        WHEN 4 THEN 'admin'
        WHEN 3 THEN 'editor'
        WHEN 2 THEN 'contributor'
        WHEN 1 THEN 'viewer'
        ELSE 'none'
      END;
    END IF;

    IF v_effective_attendance_level NOT IN ('editor', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: you need at least Editor access on the Attendance Board to approve this task.';
    END IF;
  END IF;

  v_maker_user_id := NULLIF(v_task.metadata->>'maker_user_id', '')::uuid;

  IF v_maker_user_id IS NOT NULL
     AND v_maker_user_id = v_caller
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot approve your own attendance submission.';
  END IF;

  v_shift_date           := NULLIF(v_task.metadata->>'shift_date', '')::date;
  IF v_shift_date IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing shift_date.';
  END IF;
  v_suggested_status     := v_task.metadata->>'suggested_status';
  v_suggested_shift_type := NULLIF(LOWER(TRIM(COALESCE(v_task.metadata->>'suggested_shift_type', ''))), '');
  v_edit_request_id      := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
  v_checker_name         := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Checker');

  IF COALESCE(v_suggested_status, '') NOT IN ('present', 'week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
    RAISE EXCEPTION 'Invalid suggested status on task metadata.';
  END IF;

  IF v_suggested_status = 'present' THEN
    IF COALESCE(v_suggested_shift_type, '') NOT IN ('day', 'night') THEN
      RAISE EXCEPTION 'Invalid or missing shift type on task metadata for Present status.';
    END IF;
  ELSE
    v_suggested_shift_type := NULL;
  END IF;

  SELECT attendance_status INTO v_existing_status
  FROM public.daily_attendances
  WHERE employee_id = v_subject_emp_id
    AND shift_date = v_shift_date;

  -- Preserve any existing Present record (e.g. self-check-in with login/geolocation timestamps)
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
    employee_id, shift_date, attendance_status, shift_type, session_logs_data,
    marked_by, approved_by, marked_source, created_at, updated_at
  )
  VALUES (
    v_subject_emp_id, v_shift_date, v_suggested_status::public.attendance_status_enum,
    v_suggested_shift_type::public.shift_type_enum, '[]'::jsonb,
    v_maker_user_id, v_caller, 'unmarked_task', now(), now()
  )
  ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    attendance_status = EXCLUDED.attendance_status,
    shift_type        = EXCLUDED.shift_type,
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
    'attendance_status', v_suggested_status,
    'shift_type', v_suggested_shift_type
  );
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 2: rpc_reject_attendance_task
-- -------------------------------------------------------------------------
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
  v_caller                     uuid := auth.uid();
  v_caller_profile             record;
  v_task                       public.tasks%ROWTYPE;
  v_task_type                  text;
  v_subject_emp_id             uuid;
  v_maker_emp_id               uuid;
  v_maker_user_id              uuid;
  v_reassign_emp_id            uuid;
  v_edit_request_id            uuid;
  v_checker_name               text;
  v_clean_note                 text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_new_metadata               jsonb;
  v_prev_bypass_guard          text;
  v_emp_vertical_level         text;
  v_attendance_feature_level   text;
  v_effective_attendance_level text;
  v_vertical_rank              integer;
  v_feature_rank               integer;
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
  IF COALESCE(v_task_type, '') NOT IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE') THEN
    RAISE EXCEPTION 'Task is not an attendance closure task.';
  END IF;

  IF v_task.stage_id <> 'REVIEW' THEN
    RAISE EXCEPTION 'Only tasks in REVIEW can be rejected (current stage: %).', v_task.stage_id;
  END IF;

  v_subject_emp_id := NULLIF(v_task.metadata->>'employee_id', '')::uuid;
  IF v_subject_emp_id IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing employee_id.';
  END IF;

  -- Block subject employee from rejecting their own attendance closure task (unless master_admin)
  IF v_caller_profile.employee_id IS NOT NULL
     AND v_caller_profile.employee_id = v_subject_emp_id
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot reject your own attendance closure task.';
  END IF;

  -- Checker authorization: require effective Attendance Board Editor+ for all non-master_admin callers
  IF NOT public.is_master_admin() THEN
    IF COALESCE(v_caller_profile.role_id, '') = 'master_editor' THEN
      v_effective_attendance_level := 'editor';
    ELSIF COALESCE(v_caller_profile.role_id, '') = 'master_contributor' THEN
      v_effective_attendance_level := 'contributor';
    ELSIF COALESCE(v_caller_profile.role_id, '') = 'master_viewer' THEN
      v_effective_attendance_level := 'viewer';
    ELSE
      v_emp_vertical_level := LOWER(TRIM(COALESCE(public.get_user_permission_level('EMPLOYEES'), 'none')));

      SELECT LOWER(TRIM(fa.access_level))
      INTO v_attendance_feature_level
      FROM public.feature_access fa
      WHERE fa.user_id = v_caller
        AND UPPER(TRIM(fa.vertical_id)) = 'EMPLOYEES'
        AND fa.feature_id = 'canAccessEmployeeAttendanceBoard'
      LIMIT 1;

      v_attendance_feature_level := COALESCE(v_attendance_feature_level, v_emp_vertical_level);

      v_vertical_rank := CASE v_emp_vertical_level
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'contributor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END;

      v_feature_rank := CASE v_attendance_feature_level
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'contributor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END;

      v_effective_attendance_level := CASE LEAST(v_vertical_rank, v_feature_rank)
        WHEN 4 THEN 'admin'
        WHEN 3 THEN 'editor'
        WHEN 2 THEN 'contributor'
        WHEN 1 THEN 'viewer'
        ELSE 'none'
      END;
    END IF;

    IF v_effective_attendance_level NOT IN ('editor', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: you need at least Editor access on the Attendance Board to reject this task.';
    END IF;
  END IF;

  v_maker_user_id := NULLIF(v_task.metadata->>'maker_user_id', '')::uuid;
  IF v_maker_user_id IS NOT NULL
     AND v_maker_user_id = v_caller
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot reject your own attendance submission.';
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
-- SECTION 3: Grants, Evolution Ledger & Schema Reload
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_approve_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_attendance_task(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_reject_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reject_attendance_task(uuid, text) TO authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261128101500_harden_attendance_checker_feature_rbac',
  'Enforced effective Attendance Board Editor+ cap (min(EMPLOYEES vertical, canAccessEmployeeAttendanceBoard feature)) in rpc_approve_attendance_task and rpc_reject_attendance_task to match Maker authorization and frontend canReviewAttendanceTask().',
  ARRAY['tasks', 'daily_attendances', 'attendance_edit_requests']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
