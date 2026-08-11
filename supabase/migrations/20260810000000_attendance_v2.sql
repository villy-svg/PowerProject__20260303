-- =========================================================================
-- POWERPROJECT: Attendance V2 — Hardening RPCs for Night Shift & Multi-Hub
-- Bug fixes applied: BUG-1, BUG-2, BUG-4, BUG-5 (SQL layer)
-- BUG-3, BUG-6 fixed in frontend files.
-- BUG-7 fixed by git-restoring 20260807080000_attendance_complete_fix.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 1: Update Check-in RPC
-- Changes vs previous version in 20260806140000_merged_system_fixes.sql:
--   • BUG-5 fix: Open-session guard uses jsonb_array_elements scan and 
--     explicitly excludes auto_closed:true sessions.
--   • Night Shift boundary updated from < 8 AM to < 5 AM.
--   • BUG-1 fix: Dead auto-close block removed. Guard above ensures there
--     is never an open session at this point, so we only carry completed
--     sessions forward (multi-hub support).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkin(
  p_shift_type      text,         -- 'day' or 'night'
  p_hub_id          uuid,         -- Selected hub for this shift
  p_device_id       text,         -- Device identifier (from Capacitor)
  p_geolocation     jsonb         -- { lat, lng, accuracy }
)
RETURNS public.daily_attendances
LANGUAGE plpgsql
SECURITY DEFINER                          
SET search_path = public, pg_catalog      
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_employee_id      uuid;
  v_is_active        boolean;
  v_shift_date       date;
  v_ist_now          timestamp;             
  v_current_time     timestamp with time zone := now();
  v_existing_rec     public.daily_attendances;
  v_session_entry    jsonb;
  v_result           public.daily_attendances;
  v_updated_sessions jsonb := '[]'::jsonb;
  v_hub_lat          float8;
  v_hub_lng          float8;
  v_emp_lat          float8;
  v_emp_lng          float8;
  v_dist_m           float8;
BEGIN
  SELECT employee_id, is_active INTO v_employee_id, v_is_active FROM public.user_profiles WHERE id = v_user_id;
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'No employee linked to this user account.'; END IF;
  IF NOT v_is_active THEN RAISE EXCEPTION 'Account deactivated. Contact your administrator.'; END IF;

  -- GUARD (BUG-5 fix): Block check-in if a real (non-auto-closed) open session
  -- exists in the last 3 days. Uses explicit jsonb_array_elements scan so that
  -- zombie sessions marked auto_closed:true do NOT permanently block the employee.
  IF EXISTS (
    SELECT 1
    FROM public.daily_attendances da,
         jsonb_array_elements(da.session_logs_data) AS s
    WHERE da.employee_id = v_employee_id
      AND da.shift_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 3
      AND (s->>'logout_time') IS NULL
      AND (s->>'auto_closed') IS DISTINCT FROM 'true'
  ) THEN
    RAISE EXCEPTION 'You already have an active shift. Please check out of your previous shift before starting a new one.';
  END IF;

  v_ist_now    := v_current_time AT TIME ZONE 'Asia/Kolkata';
  v_shift_date := v_ist_now::date;
  
  -- Night Shift logic: rolls back logical date if before 5 AM
  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 5 THEN 
    v_shift_date := v_shift_date - 1; 
  END IF;

  -- Load today's existing completed sessions so we can append the new one.
  -- BUG-1 fix: the old auto-close block is removed here because the guard
  -- above ensures no open session can exist at this point. We simply carry
  -- all existing (completed) sessions forward to support multi-hub shifts.
  SELECT * INTO v_existing_rec FROM public.daily_attendances 
  WHERE employee_id = v_employee_id AND shift_date = v_shift_date;
  
  IF FOUND THEN
    v_updated_sessions := v_existing_rec.session_logs_data;
  END IF;

  SELECT lat, lng INTO v_hub_lat, v_hub_lng FROM public.hubs WHERE id = p_hub_id;
  v_emp_lat := (p_geolocation->>'lat')::float8;
  v_emp_lng := (p_geolocation->>'lng')::float8;
  v_dist_m  := public.fn_haversine_m(v_emp_lat, v_emp_lng, v_hub_lat, v_hub_lng);

  v_session_entry := jsonb_build_object(
    'hub_id',              p_hub_id,
    'login_time',          v_current_time,
    'logout_time',         NULL,
    'device_id',           p_device_id,
    'login_geolocation',   p_geolocation,
    'logout_geolocation',  NULL,
    'distance_from_hub_m', CASE WHEN v_dist_m IS NOT NULL THEN round(v_dist_m)::integer ELSE NULL END
  );

  v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session_entry);

  INSERT INTO public.daily_attendances (employee_id, shift_date, attendance_status, shift_type, first_login_time, login_geolocation, session_logs_data)
  VALUES (v_employee_id, v_shift_date, 'present', p_shift_type::public.shift_type_enum, v_current_time, p_geolocation, v_updated_sessions)
  ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    attendance_status = 'present', shift_type = EXCLUDED.shift_type, first_login_time = COALESCE(daily_attendances.first_login_time, v_current_time),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation), session_logs_data = EXCLUDED.session_logs_data, updated_at = v_current_time
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;


-- -------------------------------------------------------------------------
-- STEP 2: Update Checkout RPC
-- Guarantees we find the row with the open session, regardless of shift_date.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkout(
  p_device_id       text,
  p_geolocation     jsonb
)
RETURNS public.daily_attendances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_employee_id      uuid;
  v_is_active        boolean;
  v_rec              public.daily_attendances;
  v_sessions         jsonb;
  v_updated_sessions jsonb := '[]'::jsonb;
  v_session          jsonb;
  v_i                integer;
  v_result           public.daily_attendances;
  v_hub_id           uuid;
  v_hub_lat          float8;
  v_hub_lng          float8;
  v_emp_lat          float8;
  v_emp_lng          float8;
  v_dist_m           float8;
BEGIN
  SELECT employee_id, is_active INTO v_employee_id, v_is_active FROM public.user_profiles WHERE id = v_user_id;
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'No employee linked to this user account.'; END IF;
  IF NOT v_is_active THEN RAISE EXCEPTION 'Account deactivated. Contact your administrator.'; END IF;

  -- Select the specific row that has an OPEN session within the last 3 days.
  -- This is resilient to night shifts crossing midnight and multi-hub scenarios.
  SELECT * INTO v_rec FROM public.daily_attendances 
  WHERE employee_id = v_employee_id 
    AND shift_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 3 
    AND session_logs_data @> '[{"logout_time": null}]'::jsonb
  ORDER BY shift_date DESC, created_at DESC LIMIT 1;
  
  IF NOT FOUND THEN RAISE EXCEPTION 'No active shift found. Your most recent shift is already checked out, or it was auto-closed.'; END IF;

  v_emp_lat := (p_geolocation->>'lat')::float8;
  v_emp_lng := (p_geolocation->>'lng')::float8;
  v_sessions := v_rec.session_logs_data;

  FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_i;
    IF (v_session->>'logout_time') IS NULL THEN
      v_hub_id  := (v_session->>'hub_id')::uuid;
      v_hub_lat := NULL; v_hub_lng := NULL;
      IF v_hub_id IS NOT NULL THEN SELECT lat, lng INTO v_hub_lat, v_hub_lng FROM public.hubs WHERE id = v_hub_id; END IF;
      v_dist_m := public.fn_haversine_m(v_emp_lat, v_emp_lng, v_hub_lat, v_hub_lng);
      v_session := v_session || jsonb_build_object(
        'logout_time', now(),
        'logout_geolocation', p_geolocation,
        'distance_from_hub_m', CASE WHEN v_dist_m IS NOT NULL THEN round(v_dist_m)::integer ELSE NULL END
      );
    END IF;
    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  UPDATE public.daily_attendances 
  SET logout_time = now(), logout_geolocation = p_geolocation, session_logs_data = v_updated_sessions, updated_at = now() 
  WHERE id = v_rec.id 
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkout(text, jsonb) TO authenticated;

-- -------------------------------------------------------------------------
-- STEP 3: Repair Background Cron Functions
-- Overrides the flawed versions from 20260807080000_attendance_complete_fix.sql.
-- BUG-2 fix: check_overtime_alerts now scans session_logs_data for the actual
--   open session login_time instead of using the top-level first_login_time and
--   logout_time columns, which may be out of sync.
-- BUG-4 fix: rpc_auto_checkout_stale_sessions now uses v_last_open_login_time
--   (the open session's login time) for the top-level logout_time column,
--   rather than v_sessions->0 (the first session, which may already be closed
--   for multi-hub employees who have more than one session in a day).
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_overtime_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_master_admin_id uuid;
    v_task_title text;
    v_target_id uuid;
BEGIN
    -- Auto-resolve overtime tasks for employees whose open session was now closed.
    -- BUG-2 fix: resolution now checks session_logs_data for open sessions,
    -- not the top-level logout_time column.
    UPDATE public.tasks t
    SET stage_id = 'COMPLETED', updated_at = NOW()
    FROM public.daily_attendances da
    WHERE t.vertical_id = 'escalation_tasks'
      AND t.text LIKE 'Overtime Alert:%'
      AND t.stage_id != 'COMPLETED'
      AND (t.metadata->>'attendance_id')::uuid = da.id
      AND NOT (da.session_logs_data @> '[{"logout_time": null}]'::jsonb);

    SELECT id INTO v_master_admin_id FROM public.user_profiles WHERE role_id = 'master_admin' LIMIT 1;

    -- BUG-2 fix: detect overtime by scanning for open sessions whose login_time
    -- was more than 11 hours ago (instead of using top-level first_login_time).
    FOR rec IN 
        SELECT da.id AS attendance_id, da.employee_id, da.shift_date,
               e.full_name, e.manager_id,
               (SELECT id FROM public.user_profiles WHERE employee_id = e.manager_id LIMIT 1) AS auth_manager_id
        FROM public.daily_attendances da
        JOIN public.employees e ON e.id = da.employee_id
        WHERE EXISTS (
          SELECT 1
          FROM jsonb_array_elements(da.session_logs_data) AS s
          WHERE (s->>'logout_time') IS NULL
            AND (s->>'auto_closed') IS DISTINCT FROM 'true'
            AND (s->>'login_time')::timestamptz < NOW() - INTERVAL '11 hours'
        )
    LOOP
        v_task_title := 'Overtime Alert: ' || rec.full_name || ' on ' || TO_CHAR(rec.shift_date, 'YYYY-MM-DD');
        IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE vertical_id = 'escalation_tasks' AND (metadata->>'attendance_id')::uuid = rec.attendance_id AND text = v_task_title) THEN
            v_target_id := COALESCE(rec.auth_manager_id, v_master_admin_id);
            IF v_target_id IS NOT NULL THEN
                INSERT INTO public.tasks (text, description, vertical_id, stage_id, priority, assigned_to, created_by, metadata) 
                VALUES (v_task_title, 'Employee ' || rec.full_name || ' has been active for more than 11 hours without checking out.', 'escalation_tasks', 'BACKLOG', 'High', v_target_id, COALESCE(v_master_admin_id, v_target_id), jsonb_build_object('type', 'overtime_alert', 'employee_id', rec.employee_id, 'attendance_id', rec.attendance_id, 'shift_date', rec.shift_date));
            END IF;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_auto_checkout_stale_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    v_sessions jsonb;
    v_updated_sessions jsonb;
    v_session jsonb;
    v_i integer;
    v_task_assigned_to uuid;
    v_login_time timestamp;
    v_last_open_login_time timestamp; -- BUG-4 fix: tracks the actual open session's login time
BEGIN
    FOR rec IN 
        SELECT da.id, da.employee_id, da.shift_date, da.session_logs_data,
               e.full_name, e.manager_id, e.hub_id
        FROM public.daily_attendances da
        JOIN public.employees e ON e.id = da.employee_id
        WHERE da.session_logs_data @> '[{"logout_time": null}]'::jsonb
          AND da.shift_date < (NOW() AT TIME ZONE 'Asia/Kolkata')::date - 3
    LOOP
        v_sessions := rec.session_logs_data;
        v_updated_sessions := '[]'::jsonb;
        v_last_open_login_time := NULL;
        
        FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
            v_session := v_sessions->v_i;
            IF (v_session->>'logout_time') IS NULL THEN
                v_login_time := (v_session->>'login_time')::timestamp;
                v_last_open_login_time := v_login_time; -- capture for UPDATE below
                v_session := v_session || jsonb_build_object('logout_time', v_login_time + INTERVAL '11 hours', 'auto_closed', true);
            END IF;
            v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
        END LOOP;

        -- BUG-4 fix: use v_last_open_login_time not v_sessions->0->>'login_time'
        -- so that multi-hub employees get the correct analytical logout_time
        UPDATE public.daily_attendances
        SET session_logs_data = v_updated_sessions,
            logout_time       = v_last_open_login_time + INTERVAL '11 hours',
            updated_at        = NOW()
        WHERE id = rec.id;

        SELECT id INTO v_task_assigned_to FROM public.user_profiles WHERE employee_id = rec.manager_id LIMIT 1;
        IF v_task_assigned_to IS NULL THEN
            SELECT id INTO v_task_assigned_to FROM public.user_profiles WHERE role_id = 'master_admin' LIMIT 1;
        END IF;

        IF v_task_assigned_to IS NOT NULL THEN
            INSERT INTO public.tasks (vertical_id, stage_id, priority, text, description, assigned_to, hub_id, created_by) 
            VALUES ('escalation_tasks', 'BACKLOG', 'High', 'Forced Checkout: ' || rec.full_name, 'Employee failed to checkout for shift on ' || rec.shift_date || '. The system automatically closed their session after 3 days with an 11-hour fallback.', v_task_assigned_to, rec.hub_id, v_task_assigned_to);
        END IF;
    END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_auto_checkout_stale_sessions() TO authenticated;

-- -------------------------------------------------------------------------
-- STEP 4: PostgreSQL Kick
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
