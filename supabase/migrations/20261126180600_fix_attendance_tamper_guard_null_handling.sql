-- =========================================================================
-- POWERPROJECT: Fix Attendance Tamper Guard NULL-Handling & RPC NOT IN Guards
-- Migration: 20261126180600_fix_attendance_tamper_guard_null_handling.sql
--
-- Root Cause:
--   In 20261122101100_attendance_closure_rls_and_tamper_guard.sql,
--   func_tasks_protect_attendance_closure() checked:
--     IF (OLD.metadata->>'type') NOT IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
--   In SQL three-valued logic, NULL NOT IN (...) evaluates to NULL (falsy),
--   so any task whose metadata->>'type' is NULL (including BANK_UPDATE,
--   EMPLOYEE_DEACTIVATION, and standard tasks with metadata = '{}') skipped
--   the early return and was falsely blocked by the attendance closure guard.
--
-- Fix:
--   1. Use COALESCE(..., '') on both OLD and NEW metadata->>'type' in
--      func_tasks_protect_attendance_closure() so non-attendance tasks pass
--      through while still blocking direct edits to attendance closure tasks
--      AND blocking mutation of a normal task into a forged attendance task.
--   2. Apply COALESCE(..., '') to the nullable NOT IN / <> guards in
--      rpc_submit_attendance_task_choice, rpc_approve_attendance_task, and
--      rpc_reject_attendance_task.
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped), §5 (NOTIFY pgrst)
--   database-table-naming-convention (trg_tasks_* / func_tasks_*)
--   rbac-security-system §3 (Least-privilege SECURITY DEFINER + trigger guard)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Fix Tamper-Protection Trigger Function on public.tasks
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.func_tasks_protect_attendance_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- NULL-safe early exit for non-attendance tasks.
  -- Also inspects NEW on UPDATE so a normal task cannot be mutated into a
  -- forged attendance closure task via direct UPDATE.
  IF COALESCE(OLD.metadata->>'type', '') NOT IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
     AND (
       TG_OP = 'DELETE'
       OR COALESCE(NEW.metadata->>'type', '') NOT IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
     ) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Trusted server / Maker-Checker RPC / auto-close trigger contexts
  IF current_user = 'service_role'
     OR auth.uid() IS NULL
     OR current_setting('app.bypass_task_column_guard', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT public.is_master_admin() THEN
      RAISE EXCEPTION 'Attendance closure escalations cannot be deleted. Resolve them via the Attendance Closure review flow.';
    END IF;
    RETURN OLD;
  END IF;

  -- Block direct tampering of workflow/routing columns (forces Maker-Checker RPCs)
  IF NEW.stage_id    IS DISTINCT FROM OLD.stage_id
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.metadata    IS DISTINCT FROM OLD.metadata
     OR NEW.vertical_id IS DISTINCT FROM OLD.vertical_id
     OR NEW.task_board  IS DISTINCT FROM OLD.task_board THEN
    RAISE EXCEPTION 'Attendance closure tasks must be updated via the Mark Attendance / Review Attendance flow (direct stage or assignment edits are blocked).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_protect_attendance_closure ON public.tasks;
CREATE TRIGGER trg_tasks_protect_attendance_closure
  BEFORE UPDATE OR DELETE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.func_tasks_protect_attendance_closure();

REVOKE ALL ON FUNCTION public.func_tasks_protect_attendance_closure() FROM PUBLIC, anon, authenticated;


-- -------------------------------------------------------------------------
-- SECTION 2: NULL-Safe NOT IN Guards in Attendance Maker-Checker RPCs
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

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND COALESCE(public.get_user_permission_level('EMPLOYEES'), '') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned reporting manager or an Employees Admin can submit this attendance mark.';
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

  v_shift_date       := NULLIF(v_task.metadata->>'shift_date', '')::date;
  IF v_shift_date IS NULL THEN
    RAISE EXCEPTION 'Attendance closure task metadata is missing shift_date.';
  END IF;
  v_suggested_status := v_task.metadata->>'suggested_status';
  v_edit_request_id  := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
  v_checker_name     := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Checker');

  IF COALESCE(v_suggested_status, '') NOT IN ('week-off', 'leave', 'absent', 'no-show', 'no-call-no-show') THEN
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
  v_subject_emp_id    uuid;
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

  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND COALESCE(v_caller_profile.role_id, '') <> 'master_editor'
     AND COALESCE(public.get_user_permission_level('EMPLOYEES'), '') NOT IN ('editor', 'admin') THEN
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
REVOKE ALL ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_approve_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_approve_attendance_task(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_reject_attendance_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reject_attendance_task(uuid, text) TO authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261126180600_fix_attendance_tamper_guard_null_handling',
  'Fixed NULL NOT IN three-valued logic bug in func_tasks_protect_attendance_closure() (unblocking BANK_UPDATE, EMPLOYEE_DEACTIVATION, and standard task updates while guarding both OLD and NEW metadata.type) and hardened nullable NOT IN guards in attendance Maker-Checker RPCs.',
  ARRAY['tasks']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
