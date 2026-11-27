-- =========================================================================
-- Migration: 20261127213500_allow_present_shift_in_mark_attendance.sql
-- Purpose:
--   Allow Makers to submit Present (Day) or Present (Night) in the
--   Mark Attendance closure flow (rpc_submit_attendance_task_choice), and
--   persist shift_type in attendance_edit_requests, tasks.metadata, and
--   daily_attendances on Checker approval (rpc_approve_attendance_task).
--
-- Security Invariants Preserved:
--   - All RBAC, effective Attendance Board Contributor+ / upward Editor+
--     (10-hop), subject-employee self-action, and Maker-Checker separation
--     guards remain intact.
--   - Existing 'present' daily_attendances rows (e.g. self-check-in with
--     geolocation/login timestamps) are still preserved without overwrite.
--   - p_shift_type defaults to NULL so 3-arg callers for non-present
--     statuses remain backward-compatible during rollout.
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped), §5 (NOTIFY pgrst)
--   rbac-security-system §3 (Authorization inside SECURITY DEFINER RPCs)
-- =========================================================================

-- Drop old 3-arg overload so the 4-arg signature with DEFAULT NULL is unambiguous
DROP FUNCTION IF EXISTS public.rpc_submit_attendance_task_choice(uuid, text, text);

-- -------------------------------------------------------------------------
-- SECTION 1: rpc_submit_attendance_task_choice
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_attendance_task_choice(
  p_task_id    uuid,
  p_status     text,
  p_note       text DEFAULT NULL,
  p_shift_type text DEFAULT NULL
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
  v_maker_emp_id               uuid;
  v_maker_name                 text;
  v_checker_rec                record;
  v_edit_request_id            uuid;
  v_clean_note                 text := NULLIF(trim(COALESCE(p_note, '')), '');
  v_clean_shift_type           text := NULLIF(LOWER(TRIM(COALESCE(p_shift_type, ''))), '');
  v_new_description            text;
  v_orphan_mgr_prefix          text;
  v_new_metadata               jsonb;
  v_existing_da                record;
  v_prev_bypass_guard          text;
  v_emp_vertical_level         text;
  v_attendance_feature_level   text;
  v_effective_attendance_level text;
  v_vertical_rank              integer;
  v_feature_rank               integer;
  v_is_direct_assignee         boolean := false;
  v_is_upward_manager          boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
  END IF;

  IF COALESCE(p_status, '') NOT IN ('present', 'week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
    RAISE EXCEPTION 'Invalid attendance status "%".', COALESCE(p_status, 'NULL');
  END IF;

  -- Require explicit 'day' or 'night' shift_type when marking Present; normalize to NULL otherwise
  IF p_status = 'present' THEN
    IF COALESCE(v_clean_shift_type, '') NOT IN ('day', 'night') THEN
      RAISE EXCEPTION 'Shift type ("day" or "night") is required when marking Present.';
    END IF;
  ELSE
    v_clean_shift_type := NULL;
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

  IF v_task.stage_id <> 'BACKLOG' THEN
    RAISE EXCEPTION 'Attendance status can only be submitted while the task is in BACKLOG (current stage: %).', v_task.stage_id;
  END IF;

  v_subject_emp_id := NULLIF(v_task.metadata->>'employee_id', '')::uuid;
  IF v_subject_emp_id IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing employee_id.';
  END IF;

  -- Block subject employee from marking their own attendance closure task (unless master_admin)
  IF v_caller_profile.employee_id IS NOT NULL
     AND v_caller_profile.employee_id = v_subject_emp_id
     AND NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Unauthorized: you cannot mark your own unmarked attendance escalation.';
  END IF;

  -- Authorization check for all non-master_admin callers
  IF NOT public.is_master_admin() THEN
    -- 1. Compute effective Attendance Board level = min(EMPLOYEES vertical, canAccessEmployeeAttendanceBoard feature)
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

      -- NULL feature_access row inherits vertical level; explicit row caps via min(vertical, feature)
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

    -- All non-master_admin paths (direct manager, EMPLOYEES admin, upward manager) require Contributor+ on Attendance Board
    IF v_effective_attendance_level NOT IN ('contributor', 'editor', 'admin') THEN
      RAISE EXCEPTION 'Unauthorized: you need at least Contributor access on the Attendance Board to mark attendance.';
    END IF;

    v_is_direct_assignee := (
      v_caller_profile.employee_id IS NOT NULL
      AND v_task.assigned_to IS NOT NULL
      AND v_caller_profile.employee_id = v_task.assigned_to
    );

    -- Direct reporting manager (with Contributor+) or EMPLOYEES admin (with Contributor+) are authorized
    IF NOT v_is_direct_assignee AND COALESCE(v_emp_vertical_level, '') <> 'admin' THEN
      -- Upward reporting manager path requires effective Editor+ AND strict ancestor within 10 hops
      IF v_effective_attendance_level IN ('editor', 'admin') AND v_caller_profile.employee_id IS NOT NULL THEN
        WITH RECURSIVE upward_chain AS (
          SELECT
            e.manager_id AS emp_id,
            1 AS depth,
            ARRAY[e.id, e.manager_id] AS visited_ids
          FROM public.employees e
          WHERE (e.id = v_subject_emp_id OR (v_task.assigned_to IS NOT NULL AND e.id = v_task.assigned_to))
            AND e.manager_id IS NOT NULL

          UNION ALL

          SELECT
            e.manager_id AS emp_id,
            u.depth + 1 AS depth,
            u.visited_ids || e.manager_id
          FROM upward_chain u
          JOIN public.employees e ON e.id = u.emp_id
          WHERE u.depth < 10
            AND e.manager_id IS NOT NULL
            AND NOT (e.manager_id = ANY(u.visited_ids))
        )
        SELECT EXISTS (
          SELECT 1
          FROM upward_chain
          WHERE emp_id = v_caller_profile.employee_id
        ) INTO v_is_upward_manager;
      END IF;

      IF NOT v_is_upward_manager THEN
        RAISE EXCEPTION 'Unauthorized: only the assigned reporting manager (Contributor+), an upward reporting manager with Attendance Board Editor+ access, or an Employees Admin can submit this attendance mark.';
      END IF;
    END IF;
  END IF;

  v_shift_date   := NULLIF(v_task.metadata->>'shift_date', '')::date;
  IF v_shift_date IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing shift_date.';
  END IF;
  v_maker_emp_id := COALESCE(v_caller_profile.employee_id, v_task.assigned_to);
  v_maker_name   := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Manager');

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
    employee_id, shift_date, suggested_status, suggested_shift_type, requested_by,
    request_status, maker_note, created_at, updated_at
  )
  VALUES (
    v_subject_emp_id, v_shift_date, p_status::public.attendance_status_enum,
    v_clean_shift_type::public.shift_type_enum, v_caller,
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
    'is_orphan_manager',    COALESCE(v_checker_rec.is_orphan_manager, false),
    'maker_employee_id',    v_maker_emp_id,
    'maker_user_id',        v_caller,
    'maker_name',           v_maker_name,
    'suggested_status',     p_status,
    'suggested_shift_type', v_clean_shift_type,
    'maker_note',           v_clean_note,
    'submitted_at',         now(),
    'edit_request_id',      v_edit_request_id,
    'checker_employee_id',  v_checker_rec.checker_employee_id,
    'checker_user_id',      v_checker_rec.checker_user_id
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


-- -------------------------------------------------------------------------
-- SECTION 2: rpc_approve_attendance_task
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
  v_caller               uuid := auth.uid();
  v_caller_profile       record;
  v_task                 public.tasks%ROWTYPE;
  v_task_type            text;
  v_subject_emp_id       uuid;
  v_shift_date           date;
  v_suggested_status     text;
  v_suggested_shift_type text;
  v_maker_user_id        uuid;
  v_edit_request_id      uuid;
  v_existing_status      public.attendance_status_enum;
  v_checker_name         text;
  v_clean_note           text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_rows_affected        integer := 0;
  v_new_metadata         jsonb;
  v_prev_bypass_guard    text;
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

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND COALESCE(v_caller_profile.role_id, '') <> 'master_editor'
     AND COALESCE(public.get_user_permission_level('EMPLOYEES'), '') NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned Checker or an Employees Editor/Admin can approve this task.';
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
-- SECTION 3: Grants, Evolution Ledger & Schema Reload
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_approve_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_attendance_task(uuid, text) TO authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261127213500_allow_present_shift_in_mark_attendance',
  'Allowed Present (Day) and Present (Night) selections in rpc_submit_attendance_task_choice (via optional p_shift_type) and persisted shift_type in attendance_edit_requests, tasks.metadata, and daily_attendances via rpc_approve_attendance_task.',
  ARRAY['tasks', 'daily_attendances', 'attendance_edit_requests']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
