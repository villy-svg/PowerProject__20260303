-- =========================================================================
-- Migration: 20261127080000_allow_upward_editor_mark_attendance_task.sql
-- Purpose:
--   1. Enforce effective Attendance Board Contributor+ access on ALL
--      non-master_admin Maker paths in rpc_submit_attendance_task_choice()
--      (including direct assigned reporting managers and EMPLOYEES admins,
--      so Viewer/None users or Attendance-Board-downgraded users cannot mark).
--   2. Allow an upward reporting manager (within MAX_HIERARCHY_DEPTH = 10
--      hops above the subject employee or assigned manager) to act as Maker
--      ONLY WHEN they hold effective Editor+ access on Employees -> Attendance Board.
--
-- Security Invariants Preserved:
--   - Subject employee self-marking remains strictly blocked (unless master_admin).
--   - Direct reporting managers & EMPLOYEES admins downgraded to Viewer/None on
--     Attendance Board are blocked.
--   - Upward managers who are Viewer / Contributor / None on EMPLOYEES or
--     downgraded below Editor on canAccessEmployeeAttendanceBoard are blocked.
--   - Non-upward Editors outside the reporting chain remain blocked.
--   - Depth cap (10 hops) and cycle guard match UI hierarchyUtils.MAX_HIERARCHY_DEPTH.
--   - Maker-Checker separation remains intact: maker_user_id = v_caller and
--     fn_find_first_editor_in_hierarchy() routes REVIEW strictly above the Maker.
-- =========================================================================

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

  IF COALESCE(p_status, '') NOT IN ('week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
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

REVOKE ALL ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) TO authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261127080000_allow_upward_editor_mark_attendance_task',
  'Enforced effective Attendance Board Contributor+ access on direct manager and EMPLOYEES admin Maker paths, and allowed upward reporting managers (within 10 hops) with effective Attendance Board Editor+ access to act as Maker in rpc_submit_attendance_task_choice.',
  ARRAY['tasks', 'employees', 'feature_access']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
