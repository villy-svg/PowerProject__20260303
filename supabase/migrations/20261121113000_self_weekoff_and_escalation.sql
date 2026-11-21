-- =========================================================================
-- POWERPROJECT: Attendance Closure — Phase 2 (Self-Service Week-Off &
--               Consecutive Week-Off Escalation + Shared Maker-Checker RPCs)
--
-- Migration: 20261121113000_self_weekoff_and_escalation.sql
--
-- Skill compliance:
--   database-migration-policy §3 (Iterative Evolution — new timestamped file)
--   database-migration-policy §5 (PostgreSQL Kick at end)
--   rbac-security-system §3      (Authorization inside SECURITY DEFINER RPCs)
--
-- Scope:
--   1. Shared hierarchy helpers:
--        - fn_get_fallback_master_admin_employee()
--        - fn_find_first_editor_in_hierarchy(p_start_employee_id)
--   2. Partial unique idempotency index on public.tasks for attendance closure
--      tasks (CONSECUTIVE_WEEKOFF_ESCALATION + UNMARKED_ATTENDANCE).
--   3. Self-service Week-Off RPCs:
--        - rpc_get_unmarked_previous_shift_day()
--        - rpc_claim_yesterday_weekoff(p_target_date)
--   4. Shared Maker-Checker RPCs (reused in Phase 3):
--        - rpc_submit_attendance_task_choice(p_task_id, p_status, p_note)
--        - rpc_approve_attendance_task(p_task_id, p_review_note)
--        - rpc_reject_attendance_task(p_task_id, p_review_note)
--      NOTE: Leave Wallet ledger writes are intentionally omitted (Leave
--      Manager is being rebuilt separately).
--   5. GRANT EXECUTE + NOTIFY pgrst, 'reload schema';
-- =========================================================================


-- -------------------------------------------------------------------------
-- SECTION 1: Shared Hierarchy Helpers
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_get_fallback_master_admin_employee(
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT up.employee_id
  FROM public.user_profiles up
  JOIN public.employees e ON e.id = up.employee_id
  WHERE up.role_id = 'master_admin'
    AND up.is_active = true
    AND up.employee_id IS NOT NULL
    AND e.status = 'Active'
    AND (p_exclude_user_id IS NULL OR up.id <> p_exclude_user_id)
  ORDER BY up.created_at ASC NULLS LAST, up.id ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_find_first_editor_in_hierarchy(
  p_start_employee_id uuid,
  p_maker_user_id     uuid DEFAULT NULL
)
RETURNS TABLE (
  checker_employee_id uuid,
  checker_user_id     uuid,
  is_orphan_manager   boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_found_emp_id      uuid;
  v_found_user_id     uuid;
  v_fallback_emp_id   uuid;
  v_fallback_user_id  uuid;
  v_maker_is_master   boolean := false;
BEGIN
  -- Walk UP employees.manager_id starting from the submitting manager's manager.
  -- Cycle-safe via visited_ids[] and hard depth cap of 10.
  WITH RECURSIVE upward AS (
    SELECT
      e.manager_id AS emp_id,
      1 AS depth,
      ARRAY[p_start_employee_id, e.manager_id] AS visited_ids
    FROM public.employees e
    WHERE e.id = p_start_employee_id
      AND e.manager_id IS NOT NULL

    UNION ALL

    SELECT
      e.manager_id AS emp_id,
      u.depth + 1 AS depth,
      u.visited_ids || e.manager_id
    FROM upward u
    JOIN public.employees e ON e.id = u.emp_id
    WHERE u.depth < 10
      AND e.manager_id IS NOT NULL
      AND NOT (e.manager_id = ANY(u.visited_ids))
  )
  SELECT
    u.emp_id,
    up.id
  INTO v_found_emp_id, v_found_user_id
  FROM upward u
  JOIN public.employees e ON e.id = u.emp_id AND e.status = 'Active'
  JOIN public.user_profiles up ON up.employee_id = e.id AND up.is_active = true
  WHERE (p_maker_user_id IS NULL OR up.id <> p_maker_user_id)
    AND (
      up.role_id IN ('master_admin', 'master_editor')
      OR EXISTS (
        SELECT 1
        FROM public.vertical_access va
        WHERE va.user_id = up.id
          AND UPPER(va.vertical_id) = 'EMPLOYEES'
          AND va.access_level IN ('editor', 'admin')
      )
    )
  ORDER BY u.depth ASC, up.created_at ASC NULLS LAST
  LIMIT 1;

  IF v_found_emp_id IS NOT NULL THEN
    RETURN QUERY SELECT v_found_emp_id, v_found_user_id, false;
    RETURN;
  END IF;

  -- Check if Maker itself is a master_admin (e.g., handling an orphan employee)
  IF p_maker_user_id IS NOT NULL THEN
    SELECT (role_id = 'master_admin') INTO v_maker_is_master
    FROM public.user_profiles
    WHERE id = p_maker_user_id;
  END IF;

  -- Fallback 1: Another active master_admin with linked employee_id
  v_fallback_emp_id := public.fn_get_fallback_master_admin_employee(p_maker_user_id);

  -- Fallback 2: Any active master_admin (including self if single master_admin)
  IF v_fallback_emp_id IS NULL THEN
    v_fallback_emp_id := public.fn_get_fallback_master_admin_employee(NULL);
  END IF;

  IF v_fallback_emp_id IS NOT NULL THEN
    SELECT up.id INTO v_fallback_user_id
    FROM public.user_profiles up
    WHERE up.employee_id = v_fallback_emp_id
      AND up.is_active = true
    ORDER BY up.created_at ASC NULLS LAST
    LIMIT 1;
  END IF;

  -- Only flag is_orphan_manager when a non-master manager had no upward Editor+
  RETURN QUERY SELECT v_fallback_emp_id, v_fallback_user_id, (NOT COALESCE(v_maker_is_master, false));
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 2: Idempotency Index on public.tasks
-- Prevents duplicate attendance-closure tasks for the same (employee, date).
-- -------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_attendance_closure_unique
  ON public.tasks ((metadata->>'employee_id'), (metadata->>'shift_date'))
  WHERE (metadata->>'type' IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE'));


-- -------------------------------------------------------------------------
-- SECTION 3: Self-Service Week-Off RPCs
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_get_unmarked_previous_shift_day()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller               uuid := auth.uid();
  v_employee_id          uuid;
  v_is_active            boolean;
  v_emp                  public.employees%ROWTYPE;
  v_ist_now              timestamp;
  v_logical_today        date;
  v_target_date          date;
  v_has_attendance       boolean;
  v_already_escalated    boolean;
  v_prev_was_weekoff     boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  SELECT employee_id, is_active
  INTO v_employee_id, v_is_active
  FROM public.user_profiles
  WHERE id = v_caller;

  IF v_employee_id IS NULL OR NOT COALESCE(v_is_active, false) THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = v_employee_id AND status = 'Active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  -- Compute logical shift date in IST (05:00 AM night-shift boundary)
  v_ist_now := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN extract(hour FROM v_ist_now) < 5 THEN v_ist_now::date - 1
    ELSE v_ist_now::date
  END;
  v_target_date := v_logical_today - 1;

  -- Skip if employee joined after the target date
  IF v_emp.doj IS NOT NULL AND v_emp.doj > v_target_date THEN
    RETURN jsonb_build_object(
      'target_date', v_target_date,
      'is_unmarked', false,
      'already_escalated', false,
      'previous_day_was_weekoff', false
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_attendances
    WHERE employee_id = v_employee_id
      AND shift_date = v_target_date
  ) INTO v_has_attendance;

  SELECT EXISTS (
    SELECT 1
    FROM public.tasks
    WHERE (metadata->>'type') IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE')
      AND (metadata->>'employee_id') = v_employee_id::text
      AND (metadata->>'shift_date') = v_target_date::text
  ) INTO v_already_escalated;

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_attendances
    WHERE employee_id = v_employee_id
      AND shift_date = (v_target_date - 1)
      AND attendance_status = 'week-off'
  ) INTO v_prev_was_weekoff;

  RETURN jsonb_build_object(
    'target_date',              v_target_date,
    'is_unmarked',              (NOT v_has_attendance AND NOT v_already_escalated),
    'already_escalated',        v_already_escalated,
    'previous_day_was_weekoff', v_prev_was_weekoff
  );
END;
$$;


CREATE OR REPLACE FUNCTION public.rpc_claim_yesterday_weekoff(
  p_target_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller               uuid := auth.uid();
  v_employee_id          uuid;
  v_is_active            boolean;
  v_emp                  public.employees%ROWTYPE;
  v_hub_name             text;
  v_ist_now              timestamp;
  v_logical_today        date;
  v_expected_date        date;
  v_prev_was_weekoff     boolean;
  v_existing_task_id     uuid;
  v_manager_emp_id       uuid;
  v_is_orphan_employee   boolean := false;
  v_task_id              uuid;
  v_description          text;
  v_metadata             jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: unauthenticated caller.';
  END IF;

  SELECT employee_id, is_active
  INTO v_employee_id, v_is_active
  FROM public.user_profiles
  WHERE id = v_caller;

  IF v_employee_id IS NULL OR NOT COALESCE(v_is_active, false) THEN
    RAISE EXCEPTION 'Unauthorized: no active employee profile linked to your account.';
  END IF;

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = v_employee_id AND status = 'Active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee record is not active.';
  END IF;

  -- Enforce 05:00 AM IST night-shift boundary (blocks arbitrary historical backdating)
  v_ist_now := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN extract(hour FROM v_ist_now) < 5 THEN v_ist_now::date - 1
    ELSE v_ist_now::date
  END;
  v_expected_date := v_logical_today - 1;

  IF p_target_date IS DISTINCT FROM v_expected_date THEN
    RAISE EXCEPTION 'Self-service Week-Off can only be claimed for the previous shift day (%).', v_expected_date;
  END IF;

  IF v_emp.doj IS NOT NULL AND v_emp.doj > p_target_date THEN
    RAISE EXCEPTION 'Target date precedes employee joining date.';
  END IF;

  -- Already marked guard
  IF EXISTS (
    SELECT 1
    FROM public.daily_attendances
    WHERE employee_id = v_employee_id
      AND shift_date = p_target_date
  ) THEN
    RETURN jsonb_build_object(
      'status', 'already_marked',
      'shift_date', p_target_date
    );
  END IF;

  -- Check if day before target_date was already a Week-Off
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_attendances
    WHERE employee_id = v_employee_id
      AND shift_date = (p_target_date - 1)
      AND attendance_status = 'week-off'
  ) INTO v_prev_was_weekoff;

  -- -----------------------------------------------------------------------
  -- CASE A: Non-Consecutive Week-Off -> Auto-save immediately
  -- -----------------------------------------------------------------------
  IF NOT v_prev_was_weekoff THEN
    INSERT INTO public.daily_attendances (
      employee_id,
      shift_date,
      attendance_status,
      session_logs_data,
      marked_by,
      approved_by,
      marked_source,
      created_at,
      updated_at
    )
    VALUES (
      v_employee_id,
      p_target_date,
      'week-off',
      '[]'::jsonb,
      v_caller,
      NULL,
      'self_weekoff',
      now(),
      now()
    )
    ON CONFLICT (employee_id, shift_date) DO NOTHING;

    RETURN jsonb_build_object(
      'status', 'marked',
      'shift_date', p_target_date
    );
  END IF;

  -- -----------------------------------------------------------------------
  -- CASE B: Consecutive Week-Off -> Escalate to Maker-Checker Task Board
  -- -----------------------------------------------------------------------
  SELECT id INTO v_existing_task_id
  FROM public.tasks
  WHERE (metadata->>'type') IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE')
    AND (metadata->>'employee_id') = v_employee_id::text
    AND (metadata->>'shift_date') = p_target_date::text
  LIMIT 1;

  IF v_existing_task_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'escalated',
      'task_id', v_existing_task_id,
      'duplicate', true,
      'shift_date', p_target_date
    );
  END IF;

  -- Resolve hub name for human-readable task context
  IF v_emp.hub_id IS NOT NULL THEN
    SELECT name INTO v_hub_name FROM public.hubs WHERE id = v_emp.hub_id;
  END IF;

  -- Resolve direct active reporting manager (or fallback Master Admin)
  IF v_emp.manager_id IS NOT NULL THEN
    SELECT id INTO v_manager_emp_id
    FROM public.employees
    WHERE id = v_emp.manager_id AND status = 'Active';
  END IF;

  IF v_manager_emp_id IS NULL THEN
    v_is_orphan_employee := true;
    v_manager_emp_id := public.fn_get_fallback_master_admin_employee(NULL);
  END IF;

  v_description :=
    CASE
      WHEN v_is_orphan_employee THEN
        '⚠️ ORPHAN EMPLOYEE: This employee has no active reporting manager assigned in the system.' || E'\n\n'
      ELSE ''
    END
    || v_emp.full_name
    || COALESCE(' (' || v_emp.emp_code || ')', '')
    || ' requested a consecutive Week-Off for ' || to_char(p_target_date, 'DD Mon YYYY')
    || ' (previous day ' || to_char(p_target_date - 1, 'DD Mon YYYY') || ' was already marked Week-Off).'
    || E'\n\nPlease review and mark the appropriate non-present attendance status for manager approval.';

  v_metadata := jsonb_build_object(
    'type',                'CONSECUTIVE_WEEKOFF_ESCALATION',
    'employee_id',         v_emp.id,
    'employee_name',       v_emp.full_name,
    'emp_code',            COALESCE(v_emp.emp_code, ''),
    'hub_name',            COALESCE(v_hub_name, 'Unassigned Hub'),
    'shift_date',          p_target_date::text,
    'is_orphan_employee',  v_is_orphan_employee,
    'is_orphan_manager',   false,
    'maker_employee_id',   v_manager_emp_id,
    'maker_user_id',       NULL,
    'maker_name',          NULL,
    'suggested_status',    NULL,
    'maker_note',          NULL,
    'submitted_at',        NULL,
    'edit_request_id',     NULL,
    'checker_employee_id', NULL,
    'checker_user_id',     NULL,
    'checker_name',        NULL,
    'reviewed_at',         NULL,
    'review_note',         NULL
  );

  v_task_id := gen_random_uuid();

  -- Race-safe insert: if a concurrent double-tap hits idx_tasks_attendance_closure_unique,
  -- gracefully return the winning task_id instead of throwing a raw 23505 error.
  BEGIN
    INSERT INTO public.tasks (
      id, text, vertical_id, stage_id, priority, description,
      hub_id, function, assigned_to, task_board, metadata,
      user_id, created_by, last_updated_by, created_at, updated_at
    )
    VALUES (
      v_task_id,
      'Consecutive Week-Off: ' || v_emp.full_name || ' (' || to_char(p_target_date, 'DD Mon') || ')',
      'EMPLOYEES',
      'BACKLOG',
      'High',
      v_description,
      v_emp.hub_id,
      'EMP',
      v_manager_emp_id,
      '["Employees"]'::jsonb,
      v_metadata,
      v_caller,
      v_caller,
      v_caller,
      now(),
      now()
    );
  EXCEPTION
    WHEN unique_violation THEN
      SELECT id INTO v_existing_task_id
      FROM public.tasks
      WHERE (metadata->>'type') IN ('CONSECUTIVE_WEEKOFF_ESCALATION', 'UNMARKED_ATTENDANCE')
        AND (metadata->>'employee_id') = v_employee_id::text
        AND (metadata->>'shift_date') = p_target_date::text
      LIMIT 1;

      RETURN jsonb_build_object(
        'status', 'escalated',
        'task_id', v_existing_task_id,
        'duplicate', true,
        'shift_date', p_target_date
      );
  END;

  -- Link assignee, hub, and subject employee in task_context_links
  IF v_manager_emp_id IS NOT NULL THEN
    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (v_task_id, 'task', 'assignee', v_manager_emp_id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
  END IF;

  IF v_emp.hub_id IS NOT NULL THEN
    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (v_task_id, 'task', 'hub', v_emp.hub_id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
  END IF;

  INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
  VALUES (v_task_id, 'task', 'employee', v_emp.id, true)
  ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

  RETURN jsonb_build_object(
    'status', 'escalated',
    'task_id', v_task_id,
    'is_orphan_employee', v_is_orphan_employee,
    'shift_date', p_target_date
  );
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 4: Shared Maker-Checker RPCs (Phase 2 + Phase 3)
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

  -- Authorization: assigned Maker (strict non-null equality), master_admin, or EMPLOYEES admin
  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND public.get_user_permission_level('EMPLOYEES') <> 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned reporting manager or an Employees Admin can submit this attendance mark.';
  END IF;

  v_subject_emp_id := (v_task.metadata->>'employee_id')::uuid;
  v_shift_date     := (v_task.metadata->>'shift_date')::date;
  v_maker_emp_id   := COALESCE(v_caller_profile.employee_id, v_task.assigned_to);
  v_maker_name     := COALESCE(NULLIF(trim(v_caller_profile.name), ''), v_caller_profile.email, 'Manager');

  -- Create linked attendance_edit_requests staging record
  INSERT INTO public.attendance_edit_requests (
    employee_id,
    shift_date,
    suggested_status,
    requested_by,
    request_status,
    maker_note,
    created_at,
    updated_at
  )
  VALUES (
    v_subject_emp_id,
    v_shift_date,
    p_status::public.attendance_status_enum,
    v_caller,
    'pending',
    COALESCE(v_clean_note, 'Submitted via attendance closure task'),
    now(),
    now()
  )
  RETURNING id INTO v_edit_request_id;

  -- Resolve Checker: 1st upward active Editor+ on EMPLOYEES (or Master Admin fallback)
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

  UPDATE public.tasks
  SET
    stage_id        = 'REVIEW',
    assigned_to     = v_checker_rec.checker_employee_id,
    description     = v_new_description,
    metadata        = v_new_metadata,
    last_updated_by = v_caller,
    updated_at      = now()
  WHERE id = p_task_id;

  -- Sync assignee link so the Checker sees the task in Centralised Task Board
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
  v_caller           uuid := auth.uid();
  v_caller_profile   record;
  v_task             public.tasks%ROWTYPE;
  v_task_type        text;
  v_subject_emp_id   uuid;
  v_shift_date       date;
  v_suggested_status text;
  v_maker_user_id    uuid;
  v_edit_request_id  uuid;
  v_existing_status  public.attendance_status_enum;
  v_checker_name     text;
  v_clean_note       text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_rows_affected    integer := 0;
  v_new_metadata     jsonb;
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

  -- Authorization: assigned Checker (strict non-null equality), master_admin/master_editor, or EMPLOYEES editor/admin
  IF (v_caller_profile.employee_id IS NULL OR v_task.assigned_to IS NULL OR v_caller_profile.employee_id <> v_task.assigned_to)
     AND NOT public.is_master_admin()
     AND v_caller_profile.role_id <> 'master_editor'
     AND public.get_user_permission_level('EMPLOYEES') NOT IN ('editor', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned Checker or an Employees Editor/Admin can approve this task.';
  END IF;

  v_maker_user_id := NULLIF(v_task.metadata->>'maker_user_id', '')::uuid;

  -- Block self-approval unless caller is master_admin (orphan fallback deadlock guard)
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

  -- Guard against overwriting an existing 'present' attendance record
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

    UPDATE public.tasks
    SET
      stage_id        = 'COMPLETED',
      metadata        = v_new_metadata,
      last_updated_by = v_caller,
      updated_at      = now()
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'preserved_present',
      'task_id', p_task_id
    );
  END IF;

  -- Write attendance record with Maker + Checker attribution.
  -- Race-safe guard: WHERE daily_attendances.attendance_status <> 'present' guarantees
  -- a concurrent physical check-in arriving between the check above and this upsert
  -- is NEVER overwritten.
  -- (Leave Wallet ledger writes intentionally skipped — Leave Manager is being rebuilt separately)
  INSERT INTO public.daily_attendances (
    employee_id,
    shift_date,
    attendance_status,
    session_logs_data,
    marked_by,
    approved_by,
    marked_source,
    created_at,
    updated_at
  )
  VALUES (
    v_subject_emp_id,
    v_shift_date,
    v_suggested_status::public.attendance_status_enum,
    '[]'::jsonb,
    v_maker_user_id,
    v_caller,
    'unmarked_task',
    now(),
    now()
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
    -- A concurrent physical check-in won the race; preserve it and auto-resolve task.
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

    UPDATE public.tasks
    SET
      stage_id        = 'COMPLETED',
      metadata        = v_new_metadata,
      last_updated_by = v_caller,
      updated_at      = now()
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'preserved_present',
      'task_id', p_task_id
    );
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

  UPDATE public.tasks
  SET
    stage_id        = 'COMPLETED',
    metadata        = v_new_metadata,
    last_updated_by = v_caller,
    updated_at      = now()
  WHERE id = p_task_id;

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
  v_caller          uuid := auth.uid();
  v_caller_profile  record;
  v_task            public.tasks%ROWTYPE;
  v_task_type       text;
  v_maker_emp_id    uuid;
  v_edit_request_id uuid;
  v_checker_name    text;
  v_clean_note      text := NULLIF(trim(COALESCE(p_review_note, '')), '');
  v_new_metadata    jsonb;
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

  -- Authorization: assigned Checker (strict non-null equality), master_admin/master_editor, or EMPLOYEES editor/admin
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

  -- Return task to BACKLOG assigned back to the Maker for re-submission
  UPDATE public.tasks
  SET
    stage_id        = 'BACKLOG',
    assigned_to     = COALESCE(v_maker_emp_id, public.fn_get_fallback_master_admin_employee(NULL)),
    metadata        = v_new_metadata,
    last_updated_by = v_caller,
    updated_at      = now()
  WHERE id = p_task_id;

  -- Sync assignee link back to Maker
  UPDATE public.task_context_links
  SET is_active = false
  WHERE source_type = 'task'
    AND source_id = p_task_id
    AND entity_type = 'assignee';

  IF v_maker_emp_id IS NOT NULL THEN
    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (p_task_id, 'task', 'assignee', v_maker_emp_id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id)
    DO UPDATE SET is_active = true;
  END IF;

  RETURN jsonb_build_object(
    'status', 'rejected',
    'task_id', p_task_id
  );
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 5: Least-Privilege Grants & PostgREST Schema Reload (Mandatory)
-- Internal hierarchy helpers are NOT callable directly via PostgREST.
-- User-facing RPCs are restricted to authenticated callers only (no anon/PUBLIC).
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fn_get_fallback_master_admin_employee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_find_first_editor_in_hierarchy(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rpc_get_unmarked_previous_shift_day() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_claim_yesterday_weekoff(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_approve_attendance_task(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_reject_attendance_task(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_get_unmarked_previous_shift_day() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_claim_yesterday_weekoff(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_attendance_task_choice(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_approve_attendance_task(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_reject_attendance_task(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
