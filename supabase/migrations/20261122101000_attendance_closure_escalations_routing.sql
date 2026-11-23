-- =========================================================================
-- POWERPROJECT: Attendance Closure → Escalations Board (Part 1/3: Routing)
-- Migration: 20261122101000_attendance_closure_escalations_routing.sql
--
-- Purpose:
--   Moves UNMARKED_ATTENDANCE and CONSECUTIVE_WEEKOFF_ESCALATION tasks out of
--   Employees -> Remarks Manager (EMPLOYEES / ["Employees"]) and into
--   Charging Hubs -> Escalations Task Board (CHARGING_HUBS / ["Escalations"]).
--
-- Scope:
--   1. Idempotent, push-suppressed backfill of any existing attendance closure tasks.
--   2. Update rpc_generate_unmarked_attendance_tasks to insert CHARGING_HUBS / ["Escalations"]
--      and count open-task caps across ('CHARGING_HUBS', 'EMPLOYEES').
--   3. Update rpc_claim_yesterday_weekoff to insert CHARGING_HUBS / ["Escalations"].
--   4. Update func_daily_attendances_auto_close_closure_tasks to match ('CHARGING_HUBS', 'EMPLOYEES').
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped), §5 (NOTIFY pgrst)
--   production-safeguards (Push-storm suppression during backfill)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Idempotent Backfill (Push-Suppressed)
-- -------------------------------------------------------------------------
DO $$
DECLARE
  v_prev_suppress_push text := current_setting('app.suppress_task_push', true);
  v_prev_bypass_guard  text := current_setting('app.bypass_task_column_guard', true);
BEGIN
  PERFORM set_config('app.suppress_task_push', 'on', true);
  PERFORM set_config('app.bypass_task_column_guard', 'on', true);

  UPDATE public.tasks
  SET
    vertical_id = 'CHARGING_HUBS',
    task_board  = '["Escalations"]'::jsonb,
    updated_at  = now()
  WHERE (metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
    AND (
      vertical_id IS DISTINCT FROM 'CHARGING_HUBS'
      OR task_board IS NULL
      OR NOT (task_board @> '["Escalations"]'::jsonb)
      OR (task_board @> '["Employees"]'::jsonb)
    );

  PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
  PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
  PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
  RAISE;
END $$;


-- -------------------------------------------------------------------------
-- SECTION 2: Update rpc_generate_unmarked_attendance_tasks (service_role only)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_generate_unmarked_attendance_tasks(
  p_target_date           date    DEFAULT NULL,
  p_hub_ids               uuid[]  DEFAULT NULL,
  p_dry_run               boolean DEFAULT false,
  p_max_tasks_per_run     integer DEFAULT 50,
  p_max_open_per_employee integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dry_run               boolean := COALESCE(p_dry_run, false);
  v_now_ist               timestamp;
  v_logical_today         date;
  v_target_date           date;
  v_master_admin_user_id  uuid;
  v_emp                   record;
  v_hub_name              text;
  v_manager_emp_id        uuid;
  v_is_orphan_employee    boolean;
  v_task_id               uuid;
  v_description           text;
  v_metadata              jsonb;
  v_open_emp_tasks        integer;
  v_eligible_count        integer := 0;
  v_created_count         integer := 0;
  v_skipped_dup_count     integer := 0;
  v_skipped_cap_count     integer := 0;
  v_orphan_count          integer := 0;
  v_unassigned_count      integer := 0;
  v_sample_employees      jsonb   := '[]'::jsonb;
  v_manager_counts        jsonb   := '{}'::jsonb;
  v_mgr_key               text;
  v_mgr_count             integer;
  v_mgr_user_id           uuid;
  v_push_attempted_count  integer := 0;
  v_prev_suppress_push    text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('rpc_generate_unmarked_attendance_tasks'));

  IF p_max_tasks_per_run IS NOT NULL AND p_max_tasks_per_run < 0 THEN
    RAISE EXCEPTION 'p_max_tasks_per_run must be >= 0 or NULL (got %).', p_max_tasks_per_run;
  END IF;
  IF p_max_open_per_employee IS NOT NULL AND p_max_open_per_employee < 0 THEN
    RAISE EXCEPTION 'p_max_open_per_employee must be >= 0 or NULL (got %).', p_max_open_per_employee;
  END IF;

  v_now_ist := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN v_now_ist::time < time '05:00' THEN (v_now_ist::date - 1)
    ELSE v_now_ist::date
  END;

  v_target_date := COALESCE(p_target_date, v_logical_today - 2);

  IF v_target_date >= v_logical_today THEN
    RAISE EXCEPTION 'Target date (%) must be earlier than logical today (%).', v_target_date, v_logical_today;
  END IF;

  SELECT count(*) INTO v_eligible_count
  FROM public.employees e
  WHERE e.status = 'Active'
    AND COALESCE(e.attendance_exempt, false) = false
    AND COALESCE(e.hire_date, e.doj, (e.created_at AT TIME ZONE 'Asia/Kolkata')::date) <= v_target_date
    AND (
      p_hub_ids IS NULL
      OR cardinality(p_hub_ids) = 0
      OR e.hub_id = ANY(p_hub_ids)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up_ma
      WHERE up_ma.employee_id = e.id
        AND up_ma.role_id = 'master_admin'
        AND up_ma.is_active = true
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_attendances da
      WHERE da.employee_id = e.id
        AND da.shift_date = v_target_date
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE (t.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (t.metadata->>'employee_id') = e.id::text
        AND (t.metadata->>'shift_date') = v_target_date::text
    )
    AND (
      p_max_open_per_employee IS NULL
      OR (
        SELECT count(*)
        FROM public.tasks t_open
        WHERE t_open.vertical_id IN ('CHARGING_HUBS', 'EMPLOYEES')
          AND (t_open.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
          AND (t_open.metadata->>'employee_id') = e.id::text
          AND t_open.stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
      ) < p_max_open_per_employee
    );

  IF NOT v_dry_run
     AND p_max_tasks_per_run IS NOT NULL
     AND v_eligible_count > p_max_tasks_per_run THEN
    RETURN jsonb_build_object(
      'status',              'aborted_circuit_breaker',
      'dry_run',             false,
      'target_date',         v_target_date,
      'logical_today_ist',   v_logical_today,
      'eligible_count',      v_eligible_count,
      'max_tasks_per_run',   p_max_tasks_per_run,
      'created_count',       0,
      'message',             'Circuit breaker tripped: eligible count (' || v_eligible_count || ') exceeds max_tasks_per_run (' || p_max_tasks_per_run || '). Run dry_run=true to inspect before overriding.'
    );
  END IF;

  SELECT up.id INTO v_master_admin_user_id
  FROM public.user_profiles up
  WHERE up.role_id = 'master_admin'
    AND up.is_active = true
  ORDER BY up.created_at ASC NULLS LAST
  LIMIT 1;

  v_prev_suppress_push := current_setting('app.suppress_task_push', true);
  BEGIN
  PERFORM set_config('app.suppress_task_push', 'on', true);

  FOR v_emp IN
    SELECT
      e.id,
      e.full_name,
      e.emp_code,
      e.hub_id,
      e.manager_id
    FROM public.employees e
    WHERE e.status = 'Active'
      AND COALESCE(e.attendance_exempt, false) = false
      AND COALESCE(e.hire_date, e.doj, (e.created_at AT TIME ZONE 'Asia/Kolkata')::date) <= v_target_date
      AND (
        p_hub_ids IS NULL
        OR cardinality(p_hub_ids) = 0
        OR e.hub_id = ANY(p_hub_ids)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_profiles up_ma
        WHERE up_ma.employee_id = e.id
          AND up_ma.role_id = 'master_admin'
          AND up_ma.is_active = true
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.daily_attendances da
        WHERE da.employee_id = e.id
          AND da.shift_date = v_target_date
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.tasks t
        WHERE (t.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
          AND (t.metadata->>'employee_id') = e.id::text
          AND (t.metadata->>'shift_date') = v_target_date::text
      )
    ORDER BY e.full_name ASC
  LOOP
    IF NOT v_dry_run AND p_max_tasks_per_run IS NOT NULL AND v_created_count >= p_max_tasks_per_run THEN
      EXIT;
    END IF;

    IF p_max_open_per_employee IS NOT NULL THEN
      SELECT count(*) INTO v_open_emp_tasks
      FROM public.tasks t_open
      WHERE t_open.vertical_id IN ('CHARGING_HUBS', 'EMPLOYEES')
        AND (t_open.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (t_open.metadata->>'employee_id') = v_emp.id::text
        AND t_open.stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED');

      IF v_open_emp_tasks >= p_max_open_per_employee THEN
        v_skipped_cap_count := v_skipped_cap_count + 1;
        CONTINUE;
      END IF;
    END IF;

    v_hub_name           := NULL;
    v_manager_emp_id     := NULL;
    v_is_orphan_employee := false;

    IF v_emp.hub_id IS NOT NULL THEN
      SELECT h.name INTO v_hub_name FROM public.hubs h WHERE h.id = v_emp.hub_id;
    END IF;

    IF v_emp.manager_id IS NOT NULL AND v_emp.manager_id <> v_emp.id THEN
      SELECT m.id INTO v_manager_emp_id
      FROM public.employees m
      WHERE m.id = v_emp.manager_id
        AND m.status = 'Active'
        AND EXISTS (
          SELECT 1
          FROM public.user_profiles up_m
          WHERE up_m.employee_id = m.id
            AND up_m.is_active = true
        );
    END IF;

    IF v_manager_emp_id IS NULL THEN
      v_is_orphan_employee := true;
      v_manager_emp_id := public.fn_get_fallback_master_admin_employee(NULL);
    END IF;

    IF v_dry_run THEN
      IF v_is_orphan_employee THEN
        v_orphan_count := v_orphan_count + 1;
      END IF;
      IF v_manager_emp_id IS NULL THEN
        v_unassigned_count := v_unassigned_count + 1;
      END IF;
      IF jsonb_array_length(v_sample_employees) < 25 THEN
        v_sample_employees := v_sample_employees || jsonb_build_array(
          jsonb_build_object(
            'employee_id',        v_emp.id,
            'employee_name',      v_emp.full_name,
            'emp_code',           COALESCE(v_emp.emp_code, ''),
            'hub_name',           COALESCE(v_hub_name, 'Unassigned Hub'),
            'assigned_to',        v_manager_emp_id,
            'is_orphan_employee', v_is_orphan_employee
          )
        );
      END IF;
      CONTINUE;
    END IF;

    v_description :=
      CASE
        WHEN v_is_orphan_employee THEN
          '⚠️ ORPHAN EMPLOYEE: This employee has no active reporting manager (with app access) assigned in the system.' || E'\n\n'
        ELSE ''
      END
      || v_emp.full_name
      || COALESCE(' (' || NULLIF(trim(v_emp.emp_code), '') || ')', '')
      || ' has no attendance recorded for ' || to_char(v_target_date, 'DD Mon YYYY') || '.'
      || E'\n\nPlease select the appropriate non-present attendance status for manager approval. '
      || 'If the employee was actually Present, submit an Attendance Edit Request on the Attendance Board instead (this task will auto-close upon approval).';

    v_metadata := jsonb_build_object(
      'type',                'UNMARKED_ATTENDANCE',
      'employee_id',         v_emp.id,
      'employee_name',       v_emp.full_name,
      'emp_code',            COALESCE(v_emp.emp_code, ''),
      'hub_name',            COALESCE(v_hub_name, 'Unassigned Hub'),
      'shift_date',          v_target_date::text,
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

    BEGIN
      INSERT INTO public.tasks (
        id, text, vertical_id, stage_id, priority, description,
        hub_id, function, assigned_to, task_board, metadata,
        user_id, created_by, last_updated_by, created_at, updated_at
      )
      VALUES (
        v_task_id,
        'Unmarked Attendance: ' || v_emp.full_name || ' (' || to_char(v_target_date, 'DD Mon') || ')',
        'CHARGING_HUBS',
        'BACKLOG',
        'High',
        v_description,
        v_emp.hub_id,
        'EMP',
        v_manager_emp_id,
        '["Escalations"]'::jsonb,
        v_metadata,
        v_master_admin_user_id,
        v_master_admin_user_id,
        v_master_admin_user_id,
        now(),
        now()
      );
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped_dup_count := v_skipped_dup_count + 1;
        CONTINUE;
    END;

    IF v_is_orphan_employee THEN
      v_orphan_count := v_orphan_count + 1;
    END IF;

    IF v_manager_emp_id IS NOT NULL THEN
      INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
      VALUES (v_task_id, 'task', 'assignee', v_manager_emp_id, true)
      ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

      v_mgr_key := v_manager_emp_id::text;
      v_mgr_count := COALESCE((v_manager_counts->>v_mgr_key)::integer, 0) + 1;
      v_manager_counts := jsonb_set(v_manager_counts, ARRAY[v_mgr_key], to_jsonb(v_mgr_count));
    ELSE
      v_unassigned_count := v_unassigned_count + 1;
      RAISE WARNING '[rpc_generate_unmarked_attendance_tasks] Task % for employee % created unassigned (no active fallback master_admin employee linked).',
        v_task_id, v_emp.id;
    END IF;

    IF v_emp.hub_id IS NOT NULL THEN
      INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
      VALUES (v_task_id, 'task', 'hub', v_emp.hub_id, true)
      ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
    END IF;

    INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
    VALUES (v_task_id, 'task', 'employee', v_emp.id, true)
    ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

    v_created_count := v_created_count + 1;
  END LOOP;

  PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
    RAISE;
  END;

  IF NOT v_dry_run AND v_created_count > 0 THEN
    FOR v_mgr_key, v_mgr_count IN
      SELECT key, value::integer
      FROM jsonb_each_text(v_manager_counts)
    LOOP
      BEGIN
        SELECT up.id INTO v_mgr_user_id
        FROM public.user_profiles up
        WHERE up.employee_id = v_mgr_key::uuid
          AND up.is_active = true
        ORDER BY up.created_at ASC NULLS LAST
        LIMIT 1;

        IF v_mgr_user_id IS NOT NULL THEN
          PERFORM public.trigger_push_notification(
            jsonb_build_object(
              'user_id',     v_mgr_user_id,
              'title',       'Unmarked Attendance Summary',
              'body',        v_mgr_count || ' unmarked attendance ' || CASE WHEN v_mgr_count = 1 THEN 'task' ELSE 'tasks' END
                             || ' for ' || to_char(v_target_date, 'DD Mon') || ' need your review.',
              'type',        'task_assigned',
              'entity_type', 'task'
            )
          );
          v_push_attempted_count := v_push_attempted_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[rpc_generate_unmarked_attendance_tasks] Non-fatal push summary error for manager %: %', v_mgr_key, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'status',                       'ok',
    'dry_run',                      v_dry_run,
    'target_date',                  v_target_date,
    'logical_today_ist',            v_logical_today,
    'hub_filter_count',             COALESCE(cardinality(p_hub_ids), 0),
    'max_tasks_per_run',            p_max_tasks_per_run,
    'max_open_per_employee',        p_max_open_per_employee,
    'eligible_count',               v_eligible_count,
    'created_count',                v_created_count,
    'skipped_duplicate_count',      v_skipped_dup_count,
    'skipped_cap_count',            v_skipped_cap_count,
    'orphan_employee_count',        v_orphan_count,
    'unassigned_task_count',        v_unassigned_count,
    'manager_push_attempted_count', v_push_attempted_count,
    'sample_employees',             CASE WHEN v_dry_run THEN v_sample_employees ELSE '[]'::jsonb END
  );
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 3: Update rpc_claim_yesterday_weekoff
-- -------------------------------------------------------------------------
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
  v_join_date            date;
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

  IF COALESCE(v_emp.attendance_exempt, false) THEN
    RAISE EXCEPTION 'Attendance-exempt employees cannot claim self-service Week-Off.';
  END IF;

  v_ist_now := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN extract(hour FROM v_ist_now) < 5 THEN v_ist_now::date - 1
    ELSE v_ist_now::date
  END;
  v_expected_date := v_logical_today - 1;

  IF p_target_date IS DISTINCT FROM v_expected_date THEN
    RAISE EXCEPTION 'Self-service Week-Off can only be claimed for the previous shift day (%).', v_expected_date;
  END IF;

  v_join_date := COALESCE(v_emp.hire_date, v_emp.doj);
  IF v_join_date IS NOT NULL AND v_join_date > p_target_date THEN
    RAISE EXCEPTION 'Target date precedes employee joining date.';
  END IF;

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

  SELECT EXISTS (
    SELECT 1
    FROM public.daily_attendances
    WHERE employee_id = v_employee_id
      AND shift_date = (p_target_date - 1)
      AND attendance_status = 'week-off'
  ) INTO v_prev_was_weekoff;

  IF NOT v_prev_was_weekoff THEN
    INSERT INTO public.daily_attendances (
      employee_id, shift_date, attendance_status, session_logs_data,
      marked_by, approved_by, marked_source, created_at, updated_at
    )
    VALUES (
      v_employee_id, p_target_date, 'week-off', '[]'::jsonb,
      v_caller, NULL, 'self_weekoff', now(), now()
    )
    ON CONFLICT (employee_id, shift_date) DO NOTHING;

    RETURN jsonb_build_object(
      'status', 'marked',
      'shift_date', p_target_date
    );
  END IF;

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

  IF v_emp.hub_id IS NOT NULL THEN
    SELECT name INTO v_hub_name FROM public.hubs WHERE id = v_emp.hub_id;
  END IF;

  IF v_emp.manager_id IS NOT NULL AND v_emp.manager_id <> v_emp.id THEN
    SELECT m.id INTO v_manager_emp_id
    FROM public.employees m
    WHERE m.id = v_emp.manager_id
      AND m.status = 'Active'
      AND EXISTS (
        SELECT 1
        FROM public.user_profiles up_m
        WHERE up_m.employee_id = m.id
          AND up_m.is_active = true
      );
  END IF;

  IF v_manager_emp_id IS NULL THEN
    v_is_orphan_employee := true;
    v_manager_emp_id := public.fn_get_fallback_master_admin_employee(NULL);
  END IF;

  v_description :=
    CASE
      WHEN v_is_orphan_employee THEN
        '⚠️ ORPHAN EMPLOYEE: This employee has no active reporting manager (with app access) assigned in the system.' || E'\n\n'
      ELSE ''
    END
    || v_emp.full_name
    || COALESCE(' (' || NULLIF(trim(v_emp.emp_code), '') || ')', '')
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

  BEGIN
    INSERT INTO public.tasks (
      id, text, vertical_id, stage_id, priority, description,
      hub_id, function, assigned_to, task_board, metadata,
      user_id, created_by, last_updated_by, created_at, updated_at
    )
    VALUES (
      v_task_id,
      'Consecutive Week-Off: ' || v_emp.full_name || ' (' || to_char(p_target_date, 'DD Mon') || ')',
      'CHARGING_HUBS', 'BACKLOG', 'High', v_description,
      v_emp.hub_id, 'EMP', v_manager_emp_id, '["Escalations"]'::jsonb, v_metadata,
      v_caller, v_caller, v_caller, now(), now()
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
-- SECTION 4: Update Auto-Close Trigger Function on daily_attendances
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.func_daily_attendances_auto_close_closure_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task               record;
  v_edit_request_id    uuid;
  v_source_label       text;
  v_prev_suppress_push text;
  v_prev_bypass_guard  text;
BEGIN
  IF NEW.marked_source = 'unmarked_task' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.attendance_status IS NOT DISTINCT FROM NEW.attendance_status THEN
    RETURN NEW;
  END IF;

  v_source_label       := COALESCE(NEW.marked_source, 'attendance_board');
  v_prev_suppress_push := current_setting('app.suppress_task_push', true);
  v_prev_bypass_guard  := current_setting('app.bypass_task_column_guard', true);

  BEGIN
    PERFORM set_config('app.suppress_task_push', 'on', true);
    PERFORM set_config('app.bypass_task_column_guard', 'on', true);

    FOR v_task IN
      SELECT id, metadata
      FROM public.tasks
      WHERE vertical_id IN ('CHARGING_HUBS', 'EMPLOYEES')
        AND (metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (metadata->>'employee_id') = NEW.employee_id::text
        AND (metadata->>'shift_date') = NEW.shift_date::text
        AND stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
      FOR UPDATE SKIP LOCKED
    LOOP
      BEGIN
        v_edit_request_id := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_edit_request_id := NULL;
      END;

      IF v_edit_request_id IS NOT NULL THEN
        UPDATE public.attendance_edit_requests
        SET
          request_status = 'rejected',
          review_note    = 'Auto-closed: attendance marked as ' || COALESCE(NEW.attendance_status::text, 'recorded') || ' via ' || v_source_label,
          updated_at     = now()
        WHERE id = v_edit_request_id
          AND request_status = 'pending';
      END IF;

      UPDATE public.tasks
      SET
        stage_id        = 'COMPLETED',
        metadata        = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'auto_resolved',        true,
          'auto_resolved_at',     now(),
          'auto_resolved_status', NEW.attendance_status::text,
          'auto_resolved_source', v_source_label,
          'review_note',          'Auto-closed: attendance marked as ' || COALESCE(NEW.attendance_status::text, 'recorded') || ' via ' || v_source_label || '.'
        ),
        last_updated_by = COALESCE(auth.uid(), NEW.marked_by, last_updated_by),
        updated_at      = now()
      WHERE id = v_task.id
        AND stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED');
    END LOOP;

    PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
    PERFORM set_config('app.bypass_task_column_guard', COALESCE(NULLIF(v_prev_bypass_guard, ''), 'off'), true);
    RAISE WARNING '[func_daily_attendances_auto_close_closure_tasks] Non-fatal cleanup error for employee %, date %: %',
      NEW.employee_id, NEW.shift_date, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


-- -------------------------------------------------------------------------
-- SECTION 5: Grants, Evolution Ledger & Schema Reload
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_generate_unmarked_attendance_tasks(date, uuid[], boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_unmarked_attendance_tasks(date, uuid[], boolean, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.rpc_claim_yesterday_weekoff(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_claim_yesterday_weekoff(date) TO authenticated;

REVOKE ALL ON FUNCTION public.func_daily_attendances_auto_close_closure_tasks() FROM PUBLIC, anon, authenticated;

INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261122101000_attendance_closure_escalations_routing',
  'Attendance Closure Part 1/3: Backfill and route UNMARKED_ATTENDANCE & CONSECUTIVE_WEEKOFF_ESCALATION tasks to CHARGING_HUBS/["Escalations"] (generator, week-off claim RPC, and auto-close trigger).',
  ARRAY['tasks', 'daily_attendances']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
