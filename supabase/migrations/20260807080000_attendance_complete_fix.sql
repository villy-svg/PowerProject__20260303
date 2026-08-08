-- =========================================================================
-- POWERPROJECT: Attendance Flow — Complete Bug Fix
-- Migration: 20260807080000_attendance_complete_fix.sql
-- Fixes bugs B1, B2, B3 from the attendance flow audit.
-- Skill compliance:
--   database-migration-policy (Idempotency, PG Kick)
-- =========================================================================

-- =========================================================================
-- 1. FIX B1: rpc_employee_checkin (Reset row-level logout_time on re-check-in)
-- =========================================================================
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
  v_session          jsonb;
  v_i                integer;
  v_hub_lat          float8;
  v_hub_lng          float8;
  v_emp_lat          float8;
  v_emp_lng          float8;
  v_dist_m           float8;
BEGIN
  SELECT employee_id, is_active INTO v_employee_id, v_is_active FROM public.user_profiles WHERE id = v_user_id;
  IF v_employee_id IS NULL THEN RAISE EXCEPTION 'No employee linked to this user account.'; END IF;
  IF NOT v_is_active THEN RAISE EXCEPTION 'Account deactivated. Contact your administrator.'; END IF;

  v_ist_now    := v_current_time AT TIME ZONE 'Asia/Kolkata';
  v_shift_date := v_ist_now::date;
  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 8 THEN v_shift_date := v_shift_date - 1; END IF;

  SELECT * INTO v_existing_rec FROM public.daily_attendances WHERE employee_id = v_employee_id AND shift_date = v_shift_date;

  IF FOUND THEN
    IF v_existing_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb THEN
      FOR v_i IN 0..jsonb_array_length(v_existing_rec.session_logs_data)-1 LOOP
        v_session := v_existing_rec.session_logs_data->v_i;
        IF (v_session->>'logout_time') IS NULL THEN
          v_session := v_session || jsonb_build_object('logout_time', v_current_time, 'logout_geolocation', p_geolocation, 'auto_closed', true);
        END IF;
        v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
      END LOOP;
    ELSE
      v_updated_sessions := v_existing_rec.session_logs_data;
    END IF;
  END IF;

  SELECT lat, lng INTO v_hub_lat, v_hub_lng FROM public.hubs WHERE id = p_hub_id;
  v_emp_lat := (p_geolocation->>'lat')::float8;
  v_emp_lng := (p_geolocation->>'lng')::float8;
  v_dist_m := public.fn_haversine_m(v_emp_lat, v_emp_lng, v_hub_lat, v_hub_lng);

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
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation), session_logs_data = EXCLUDED.session_logs_data,
    logout_time = NULL, -- FIX B1
    updated_at = v_current_time
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb) TO authenticated;

-- =========================================================================
-- 2. FIX B3: check_overtime_alerts (Use open session login_time)
-- =========================================================================
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
    UPDATE public.tasks t
    SET stage_id = 'COMPLETED', updated_at = NOW()
    FROM public.daily_attendances da
    WHERE t.vertical_id = 'escalation_tasks' AND t.text LIKE 'Overtime Alert:%' AND t.stage_id != 'COMPLETED' AND (t.metadata->>'attendance_id')::uuid = da.id AND da.logout_time IS NOT NULL;

    SELECT id INTO v_master_admin_id FROM public.user_profiles WHERE role_id = 'master_admin' LIMIT 1;

    FOR rec IN 
        SELECT da.id AS attendance_id, da.employee_id, da.shift_date, e.full_name, e.manager_id, (SELECT id FROM public.user_profiles WHERE employee_id = e.manager_id LIMIT 1) AS auth_manager_id
        FROM public.daily_attendances da
        JOIN public.employees e ON e.id = da.employee_id
        WHERE da.logout_time IS NULL
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(da.session_logs_data) AS s
            WHERE (s->>'logout_time') IS NULL
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

-- =========================================================================
-- 3. FIX B2: rpc_auto_checkout_stale_sessions (Correct session index for logout_time)
-- =========================================================================
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
    v_last_open_login_time timestamp;
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
                v_last_open_login_time := v_login_time;
                v_session := v_session || jsonb_build_object('logout_time', v_login_time + INTERVAL '11 hours', 'auto_closed', true);
            END IF;
            v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
        END LOOP;

        UPDATE public.daily_attendances
        SET session_logs_data = v_updated_sessions, logout_time = v_last_open_login_time + INTERVAL '11 hours', updated_at = NOW()
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

-- =========================================================================
-- 4. INLINE DATA REPAIR
-- =========================================================================
DO $$
BEGIN
  UPDATE public.daily_attendances
  SET    logout_time = NULL, updated_at = NOW()
  WHERE  logout_time IS NOT NULL
    AND  session_logs_data @> '[{"logout_time": null}]'::jsonb;
END $$;

NOTIFY pgrst, 'reload schema';
