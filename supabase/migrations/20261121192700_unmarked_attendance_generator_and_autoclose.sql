-- =========================================================================
-- POWERPROJECT: Attendance Closure — Part 3/3: Unmarked Attendance Generator
--               RPC & Auto-Close Safeguard Trigger
-- Migration: 20261121192700_unmarked_attendance_generator_and_autoclose.sql
--
-- Linked Runbooks:
--   docs/runbooks/attendance-closure-phased-rollout/phase-3-unmarked-attendance-pilot.md
--   docs/runbooks/attendance-closure-phased-rollout/phase-4-automated-batch-rollout.md
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped file),
--                             §5 (PostgreSQL Kick: NOTIFY pgrst)
--   database-table-naming-convention (trg_daily_attendances_* / func_daily_attendances_*)
--   rbac-security-system §3 (Least-privilege SECURITY DEFINER + service_role only)
--   production-safeguards (Advisory lock, fault-isolated trigger, circuit breaker, push-storm guard)
--
-- ANTI-FLOOD ARCHITECTURE (7 LAYERS):
--   1. Single-Day Scope: Always sweeps ONE date (logical_today - 2). Never backfills.
--   2. Shift-Agnostic Full-Cycle Cutoff (09:00 AM IST -> T-2): Gives Day, Evening,
--      and Night shifts a full 24h logical day (up to 05:00 AM IST) to self-mark
--      Week-Offs via Phase 2 before any manager task is created.
--   3. 3-Layer Idempotency: Advisory lock + NOT EXISTS + partial unique index + unique_violation catch.
--   4. Master Admin & Exemption Exclusion: Skips active master_admin & attendance_exempt employees.
--   5. Per-Employee Open Cap (default 3): Prevents absconded/ghost active employees
--      from piling up endless daily tasks on a manager's board.
--   6. Batch Circuit Breaker (default 50): If an outage causes >50 eligible employees
--      in one run, aborts cleanly with 0 inserts so the org is never flooded.
--   7. Push-Storm Suppression: Suppresses per-row trg_task_notifications during batch
--      generation & background auto-close; sends at most 1 consolidated summary push
--      per manager per run.
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Unmarked Attendance Task Generator RPC (service_role only)
-- -------------------------------------------------------------------------
-- Drop any earlier 3-arg signature to prevent PostgREST overload ambiguity
DROP FUNCTION IF EXISTS public.rpc_generate_unmarked_attendance_tasks(date, uuid[], boolean);

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
  -- Serialize concurrent generator invocations (cron + manual dispatch) so
  -- circuit-breaker counts and per-employee open caps cannot race.
  PERFORM pg_advisory_xact_lock(hashtext('rpc_generate_unmarked_attendance_tasks'));

  -- Validate non-negative caps (pass NULL explicitly to disable a cap; 0 means cap at 0)
  IF p_max_tasks_per_run IS NOT NULL AND p_max_tasks_per_run < 0 THEN
    RAISE EXCEPTION 'p_max_tasks_per_run must be >= 0 or NULL (got %).', p_max_tasks_per_run;
  END IF;
  IF p_max_open_per_employee IS NOT NULL AND p_max_open_per_employee < 0 THEN
    RAISE EXCEPTION 'p_max_open_per_employee must be >= 0 or NULL (got %).', p_max_open_per_employee;
  END IF;

  -- Compute IST logical today (respecting 05:00 AM IST night-shift rollback)
  v_now_ist := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN v_now_ist::time < time '05:00' THEN (v_now_ist::date - 1)
    ELSE v_now_ist::date
  END;

  -- Default to full-cycle cutoff (logical_today - 2):
  -- e.g., Wednesday 09:00 AM IST -> Monday (all Tuesday Day/Evening/Night shifts closed at 05:00 AM)
  v_target_date := COALESCE(p_target_date, v_logical_today - 2);

  -- Safety guard: never generate unmarked attendance tasks for today or future dates
  IF v_target_date >= v_logical_today THEN
    RAISE EXCEPTION 'Target date (%) must be earlier than logical today (%).', v_target_date, v_logical_today;
  END IF;

  -- Pre-count eligible employees for Circuit Breaker check
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
    -- Exclude active master_admin accounts (executives/founders who don't punch daily hub check-ins)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_profiles up_ma
      WHERE up_ma.employee_id = e.id
        AND up_ma.role_id = 'master_admin'
        AND up_ma.is_active = true
    )
    -- Exclude employees who already have ANY attendance row for target_date
    AND NOT EXISTS (
      SELECT 1
      FROM public.daily_attendances da
      WHERE da.employee_id = e.id
        AND da.shift_date = v_target_date
    )
    -- Exclude employees who already have an attendance-closure task for target_date
    AND NOT EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE (t.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (t.metadata->>'employee_id') = e.id::text
        AND (t.metadata->>'shift_date') = v_target_date::text
    )
    -- Per-employee open-task cap (prevents absconded/ghost employees from flooding boards)
    AND (
      p_max_open_per_employee IS NULL
      OR (
        SELECT count(*)
        FROM public.tasks t_open
        WHERE t_open.vertical_id = 'EMPLOYEES'
          AND (t_open.metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
          AND (t_open.metadata->>'employee_id') = e.id::text
          AND t_open.stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
      ) < p_max_open_per_employee
    );

  -- Circuit Breaker: abort cleanly if an outage or misconfiguration causes an abnormal spike
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

  -- Resolve a valid active master_admin user_profiles.id for created_by / user_id attribution
  SELECT up.id INTO v_master_admin_user_id
  FROM public.user_profiles up
  WHERE up.role_id = 'master_admin'
    AND up.is_active = true
  ORDER BY up.created_at ASC NULLS LAST
  LIMIT 1;

  -- Save & suppress per-row push notifications during batch insert (1 summary push per manager at end)
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
    -- Belt-and-suspenders in-loop cap guard alongside advisory lock
    IF NOT v_dry_run AND p_max_tasks_per_run IS NOT NULL AND v_created_count >= p_max_tasks_per_run THEN
      EXIT;
    END IF;

    -- Enforce per-employee open-task cap
    IF p_max_open_per_employee IS NOT NULL THEN
      SELECT count(*) INTO v_open_emp_tasks
      FROM public.tasks t_open
      WHERE t_open.vertical_id = 'EMPLOYEES'
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

    -- Resolve direct reporting manager. Must be: Active, not the employee themself
    -- (self-reporting data error), and able to actually log in (active user_profile) —
    -- otherwise the task would sit on a board nobody can open. Else fallback Master Admin.
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

    -- Dry-run mode: collect up to 25 sample records without writing anything
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

    -- Race-safe insert against idx_tasks_attendance_closure_unique
    BEGIN
      INSERT INTO public.tasks (
        id, text, vertical_id, stage_id, priority, description,
        hub_id, function, assigned_to, task_board, metadata,
        user_id, created_by, last_updated_by, created_at, updated_at
      )
      VALUES (
        v_task_id,
        'Unmarked Attendance: ' || v_emp.full_name || ' (' || to_char(v_target_date, 'DD Mon') || ')',
        'EMPLOYEES',
        'BACKLOG',
        'High',
        v_description,
        v_emp.hub_id,
        'EMP',
        v_manager_emp_id,
        '["Employees"]'::jsonb,
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

    -- Count orphan / unassigned only after INSERT succeeds
    IF v_is_orphan_employee THEN
      v_orphan_count := v_orphan_count + 1;
    END IF;

    -- Link assignee, hub, and subject employee in task_context_links
    IF v_manager_emp_id IS NOT NULL THEN
      INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
      VALUES (v_task_id, 'task', 'assignee', v_manager_emp_id, true)
      ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;

      -- Track per-manager count for consolidated single push notification
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

  -- Restore prior push-suppression GUC state
  PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.suppress_task_push', COALESCE(NULLIF(v_prev_suppress_push, ''), 'off'), true);
    RAISE;
  END;

  -- Send at most ONE consolidated summary push notification per manager (fault-isolated)
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
-- SECTION 2: Auto-Close Safeguard Trigger on daily_attendances
-- Whenever attendance is inserted or updated via any other path (Attendance
-- Board edit, approved Present edit request, late self-Week-Off, Schedule
-- Plan, check-in — including ON CONFLICT DO UPDATE paths), immediately
-- auto-close any open UNMARKED_ATTENDANCE or CONSECUTIVE_WEEKOFF_ESCALATION
-- task for (employee_id, shift_date).
-- Fault-isolated and push-suppressed so it never blocks attendance writes
-- or spams "Task Status Updated" notifications.
-- Follows database-table-naming-convention: trg_[table]_[action] & func_[table]_[action].
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auto_close_attendance_closure_tasks ON public.daily_attendances;
DROP FUNCTION IF EXISTS public.fn_auto_close_attendance_closure_tasks();

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
  -- Skip when inserted/updated by rpc_approve_attendance_task itself, which
  -- already updates the task to COMPLETED with full Checker metadata.
  IF NEW.marked_source = 'unmarked_task' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when attendance_status actually changed (avoids work on checkout/logout)
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
      WHERE vertical_id = 'EMPLOYEES'
        AND (metadata->>'type') IN ('UNMARKED_ATTENDANCE', 'CONSECUTIVE_WEEKOFF_ESCALATION')
        AND (metadata->>'employee_id') = NEW.employee_id::text
        AND (metadata->>'shift_date') = NEW.shift_date::text
        AND stage_id NOT IN ('COMPLETED', 'DEPRIORITIZED')
      FOR UPDATE SKIP LOCKED
    LOOP
      -- Reject any pending edit request linked to this open task so it doesn't linger
      BEGIN
        v_edit_request_id := NULLIF(v_task.metadata->>'edit_request_id', '')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_edit_request_id := NULL;
      END;

      IF v_edit_request_id IS NOT NULL THEN
        -- attendance_edit_requests has no reviewed_at column (only reviewed_by / review_note /
        -- updated_at); reviewed_by stays NULL because this is a system action, not a human review.
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

DROP TRIGGER IF EXISTS trg_daily_attendances_auto_close_closure_tasks ON public.daily_attendances;
CREATE TRIGGER trg_daily_attendances_auto_close_closure_tasks
  AFTER INSERT OR UPDATE OF attendance_status ON public.daily_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.func_daily_attendances_auto_close_closure_tasks();


-- -------------------------------------------------------------------------
-- SECTION 3: Least-Privilege Grants
-- Generator RPC is service_role ONLY (GitHub Actions / admin automation).
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_generate_unmarked_attendance_tasks(date, uuid[], boolean, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_generate_unmarked_attendance_tasks(date, uuid[], boolean, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.func_daily_attendances_auto_close_closure_tasks() FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- SECTION 4: Evolution Ledger Log & PostgREST Schema Reload (Mandatory)
-- -------------------------------------------------------------------------
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261121192700_unmarked_attendance_generator_and_autoclose',
  'Attendance Closure Part 3/3: rpc_generate_unmarked_attendance_tasks (service_role, advisory lock, T-2 IST sweep, dry_run, circuit breaker, per-employee open cap) and AFTER INSERT OR UPDATE OF attendance_status auto-close trigger (trg_daily_attendances_auto_close_closure_tasks) on daily_attendances.',
  ARRAY['employees', 'tasks', 'daily_attendances', 'attendance_edit_requests']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
