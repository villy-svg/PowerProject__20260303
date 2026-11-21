-- =========================================================================
-- POWERPROJECT: Attendance Closure — Part 1/3: Employee Attendance Exemption
--               & Phase 2 Week-Off RPC Alignment
-- Migration: 20261121192500_employee_attendance_exempt.sql
--
-- Linked Runbooks:
--   docs/runbooks/attendance-closure-phased-rollout/phase-3-unmarked-attendance-pilot.md
--   docs/runbooks/attendance-closure-phased-rollout/phase-4-automated-batch-rollout.md
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped file),
--                             §5 (PostgreSQL Kick: NOTIFY pgrst)
--   rbac-security-system §3 (Least-privilege SECURITY DEFINER + is_active checks)
--   production-safeguards (INSERT + UPDATE guard, security_audit_logs trail)
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 0: Employee Attendance Exemption Column & Admin-Only Toggle RPC
-- Allows exempting non-punching active staff (HQ/office/execs/test accounts)
-- from both Phase 2 Week-Off prompts and Phase 3/4 Unmarked Attendance tasks.
-- -------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS attendance_exempt boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.attendance_exempt IS
  'When true, employee is excluded from Phase 2 self-service Week-Off prompts and Phase 3/4 automated Unmarked Attendance manager tasks.';

-- Admin-only RPC for future UI / service usage (blocks self-exemption by Editors/Contributors)
CREATE OR REPLACE FUNCTION public.rpc_set_employee_attendance_exempt(
  p_employee_id uuid,
  p_exempt      boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller          uuid := auth.uid();
  v_is_service_role boolean := (COALESCE(auth.role(), '') = 'service_role' OR current_setting('role', true) = 'service_role');
  v_caller_active   boolean;
  v_old_exempt      boolean;
  v_target_user_id  uuid;
  v_emp             record;
  v_prev_exempt     text;
BEGIN
  IF NOT v_is_service_role THEN
    IF v_caller IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: authentication required.';
    END IF;

    SELECT is_active INTO v_caller_active
    FROM public.user_profiles
    WHERE id = v_caller;

    IF NOT COALESCE(v_caller_active, false) THEN
      RAISE EXCEPTION 'Unauthorized: inactive user profile.';
    END IF;

    IF NOT (
      public.is_master_admin()
      OR public.get_user_permission_level('EMPLOYEES') = 'admin'
    ) THEN
      RAISE EXCEPTION 'Forbidden: only Master Admin or Employees Admin can change attendance exemption.';
    END IF;
  END IF;

  SELECT attendance_exempt INTO v_old_exempt
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found: %', p_employee_id;
  END IF;

  v_prev_exempt := current_setting('app.attendance_exempt_update', true);
  BEGIN
    PERFORM set_config('app.attendance_exempt_update', 'on', true);

    UPDATE public.employees
    SET
      attendance_exempt = COALESCE(p_exempt, false),
      updated_at        = now()
    WHERE id = p_employee_id
    RETURNING id, full_name, emp_code, attendance_exempt
    INTO v_emp;

    -- NOTE: PERFORM resets FOUND, so existence was already verified with FOR UPDATE above.
    PERFORM set_config('app.attendance_exempt_update', COALESCE(NULLIF(v_prev_exempt, ''), 'off'), true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.attendance_exempt_update', COALESCE(NULLIF(v_prev_exempt, ''), 'off'), true);
    RAISE;
  END;

  IF v_old_exempt IS DISTINCT FROM v_emp.attendance_exempt THEN
    SELECT id INTO v_target_user_id
    FROM public.user_profiles
    WHERE employee_id = p_employee_id
      AND is_active = true
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;

    INSERT INTO public.security_audit_logs (actor_id, target_id, action, old_payload, new_payload)
    VALUES (
      v_caller,
      v_target_user_id,
      'EMPLOYEE_ATTENDANCE_EXEMPT_UPDATED',
      jsonb_build_object('employee_id', p_employee_id, 'attendance_exempt', v_old_exempt),
      jsonb_build_object('employee_id', p_employee_id, 'attendance_exempt', v_emp.attendance_exempt)
    );
  END IF;

  RETURN jsonb_build_object(
    'id',                v_emp.id,
    'full_name',         v_emp.full_name,
    'emp_code',          COALESCE(v_emp.emp_code, ''),
    'attendance_exempt', v_emp.attendance_exempt
  );
END;
$$;

-- Guard attendance_exempt inside protect_employee_sensitive_updates() on BOTH INSERT and UPDATE
-- so non-admin Editors/Contributors cannot self-exempt or exempt teammates via direct table writes.
CREATE OR REPLACE FUNCTION public.protect_employee_sensitive_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller        uuid := auth.uid();
    v_caller_active boolean := false;
BEGIN
    IF v_caller IS NOT NULL THEN
        SELECT COALESCE(is_active, false) INTO v_caller_active
        FROM public.user_profiles
        WHERE id = v_caller;
        v_caller_active := COALESCE(v_caller_active, false);
    END IF;

    -- Active Master Admins may insert/update directly (unchanged intent from 20261118190000)
    IF public.is_master_admin() AND (v_caller IS NULL OR v_caller_active) THEN
        RETURN NEW;
    END IF;

    -- INSERT Guard: prevent Contributors/Editors from inserting attendance_exempt = true directly
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.attendance_exempt, false) = true
           AND v_caller IS NOT NULL
           AND (NOT COALESCE(v_caller_active, false) OR public.get_user_permission_level('EMPLOYEES') <> 'admin')
           AND COALESCE(current_setting('app.attendance_exempt_update', true), 'off') <> 'on' THEN
            RAISE EXCEPTION 'Forbidden: only Master Admin or Employees Admin can set attendance_exempt.';
        END IF;
        RETURN NEW;
    END IF;

    -- Guard 1: Deactivation (Active -> Inactive) must go through approve_employee_deactivation()
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'Inactive'
       AND COALESCE(current_setting('app.employee_deactivation', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Direct employee deactivation is restricted. Please submit a Deactivation Request for approval.';
    END IF;

    -- Guard 2: Bank details changes on existing employees must go through approve_employee_bank_update()
    IF (
         COALESCE(OLD.account_number, '') IS DISTINCT FROM COALESCE(NEW.account_number, '')
         OR COALESCE(OLD.ifsc_code, '')   IS DISTINCT FROM COALESCE(NEW.ifsc_code, '')
         OR COALESCE(OLD.account_name, '') IS DISTINCT FROM COALESCE(NEW.account_name, '')
         OR COALESCE(OLD.pan_number, '')  IS DISTINCT FROM COALESCE(NEW.pan_number, '')
       )
       AND COALESCE(current_setting('app.employee_bank_approval', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Direct bank detail updates are restricted. Please submit a Bank Details Update request for approval.';
    END IF;

    -- Guard 3: attendance_exempt can only be changed by active Master Admin / Employees Admin.
    -- auth.uid() IS NULL = trusted server-side context (Supabase Table Editor / SQL Editor /
    -- service_role); end-user API calls always carry a JWT uid and are checked below.
    -- Guards 1 & 2 intentionally keep their original (stricter) behaviour for NULL uid.
    IF OLD.attendance_exempt IS DISTINCT FROM NEW.attendance_exempt
       AND v_caller IS NOT NULL
       AND (NOT COALESCE(v_caller_active, false) OR public.get_user_permission_level('EMPLOYEES') <> 'admin')
       AND COALESCE(current_setting('app.attendance_exempt_update', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'Forbidden: only Master Admin or Employees Admin can change attendance_exempt.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_employee_sensitive_updates ON public.employees;
CREATE TRIGGER trg_protect_employee_sensitive_updates
    BEFORE INSERT OR UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.protect_employee_sensitive_updates();

-- Update Phase 2 Week-Off prompt helper so attendance_exempt & master_admin employees are never nagged
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
  v_role_id              text;
  v_emp                  public.employees%ROWTYPE;
  v_ist_now              timestamp;
  v_logical_today        date;
  v_target_date          date;
  v_join_date            date;
  v_has_attendance       boolean;
  v_already_escalated    boolean;
  v_prev_was_weekoff     boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  SELECT employee_id, is_active, role_id
  INTO v_employee_id, v_is_active, v_role_id
  FROM public.user_profiles
  WHERE id = v_caller;

  IF v_employee_id IS NULL OR NOT COALESCE(v_is_active, false) OR v_role_id = 'master_admin' THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = v_employee_id AND status = 'Active';

  IF NOT FOUND OR COALESCE(v_emp.attendance_exempt, false) THEN
    RETURN jsonb_build_object('is_unmarked', false);
  END IF;

  -- Compute logical shift date in IST (05:00 AM night-shift boundary)
  v_ist_now := now() AT TIME ZONE 'Asia/Kolkata';
  v_logical_today := CASE
    WHEN extract(hour FROM v_ist_now) < 5 THEN v_ist_now::date - 1
    ELSE v_ist_now::date
  END;
  v_target_date := v_logical_today - 1;

  -- Prefer actively maintained hire_date over legacy doj column
  v_join_date := COALESCE(v_emp.hire_date, v_emp.doj);

  -- Skip if employee joined after the target date
  IF v_join_date IS NOT NULL AND v_join_date > v_target_date THEN
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

-- Update Phase 2 self-service Week-Off claim RPC to enforce attendance_exempt and hire_date parity
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

  v_join_date := COALESCE(v_emp.hire_date, v_emp.doj);
  IF v_join_date IS NOT NULL AND v_join_date > p_target_date THEN
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

  -- CASE A: Non-Consecutive Week-Off -> Auto-save immediately
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

  -- CASE B: Consecutive Week-Off -> Escalate to Maker-Checker Task Board
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
      'EMPLOYEES', 'BACKLOG', 'High', v_description,
      v_emp.hub_id, 'EMP', v_manager_emp_id, '["Employees"]'::jsonb, v_metadata,
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
-- SECTION 1: Least-Privilege Grants
-- -------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_set_employee_attendance_exempt(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_set_employee_attendance_exempt(uuid, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_get_unmarked_previous_shift_day() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_unmarked_previous_shift_day() TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_claim_yesterday_weekoff(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_claim_yesterday_weekoff(date) TO authenticated;

-- -------------------------------------------------------------------------
-- SECTION 2: Evolution Ledger Log & PostgREST Schema Reload (Mandatory)
-- -------------------------------------------------------------------------
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261121192500_employee_attendance_exempt',
  'Attendance Closure Part 1/3: employees.attendance_exempt column, audited rpc_set_employee_attendance_exempt (active admin + service_role), BEFORE INSERT OR UPDATE guard in protect_employee_sensitive_updates, and attendance_exempt + hire_date alignment in Phase 2 Week-Off RPCs.',
  ARRAY['employees', 'security_audit_logs']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
