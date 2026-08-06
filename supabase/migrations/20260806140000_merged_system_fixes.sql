-- =========================================================================
-- POWERPROJECT: Merged System Fixes & RPCs
-- Migration: 20260806140000_merged_system_fixes.sql
-- Merges employee inactivity cron, overtime alert cron, attendance RPC types,
-- and adds new atomic schedule approval and ghost session cleanup RPCs.
-- =========================================================================

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =========================================================================
-- 1. EMPLOYEE INACTIVITY CRON
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_employee_inactivity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp RECORD;
    v_manager_auth_id uuid;
    v_master_admin_auth_id uuid;
    v_parent_task_id uuid;
BEGIN
    SELECT id INTO v_master_admin_auth_id
    FROM public.user_profiles
    WHERE role_id = 'master_admin'
    LIMIT 1;

    FOR emp IN 
        SELECT 
            e.id AS employee_id,
            e.full_name,
            e.manager_id,
            e.hub_id,
            u.last_sign_in_at,
            u.created_at AS account_created_at
        FROM public.employees e
        JOIN public.user_profiles up ON e.id = up.employee_id
        JOIN auth.users u ON up.id = u.id
        WHERE e.status = 'Active'
          AND (
              (u.last_sign_in_at IS NOT NULL AND u.last_sign_in_at < NOW() - INTERVAL '3 days')
              OR 
              (u.last_sign_in_at IS NULL AND u.created_at < NOW() - INTERVAL '3 days')
          )
    LOOP
        v_manager_auth_id := NULL;
        IF emp.manager_id IS NOT NULL THEN
            SELECT id INTO v_manager_auth_id 
            FROM public.user_profiles 
            WHERE employee_id = emp.manager_id 
            LIMIT 1;
        END IF;

        IF v_manager_auth_id IS NULL THEN
            v_manager_auth_id := v_master_admin_auth_id;
        END IF;

        IF EXISTS (
            SELECT 1 
            FROM public.tasks
            WHERE vertical_id = 'escalation_tasks'
              AND text = 'Employee Inactivity Alert: ' || emp.full_name
              AND created_at > NOW() - INTERVAL '3 days'
        ) THEN
            CONTINUE;
        END IF;

        v_parent_task_id := NULL;
        SELECT id INTO v_parent_task_id
        FROM public.tasks
        WHERE vertical_id = 'escalation_tasks'
          AND text = 'Employee Inactivity Alert: ' || emp.full_name
          AND stage_id != 'COMPLETED'
          AND parent_task_id IS NULL
        ORDER BY created_at DESC
        LIMIT 1;

        INSERT INTO public.tasks (
            text, vertical_id, stage_id, priority, description, assigned_to, hub_id, parent_task_id, created_by
        ) VALUES (
            'Employee Inactivity Alert: ' || emp.full_name,
            'escalation_tasks', 'BACKLOG', 'High',
            'Employee has not logged in for over 3 days.' || 
            CASE 
                WHEN emp.last_sign_in_at IS NOT NULL THEN ' Last login was: ' || TO_CHAR(emp.last_sign_in_at, 'YYYY-MM-DD HH24:MI:SS')
                ELSE ' Employee has never logged in since account creation.'
            END,
            v_manager_auth_id, emp.hub_id, v_parent_task_id, v_manager_auth_id
        );
    END LOOP;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily_employee_inactivity_check');
  END IF;
EXCEPTION WHEN OTHERS THEN
END $$;

SELECT cron.schedule('daily_employee_inactivity_check', '0 0 * * *', 'SELECT public.check_employee_inactivity()');

-- =========================================================================
-- 2. UPDATE ATTENDANCE RPC RETURN TYPE
-- =========================================================================
DROP FUNCTION IF EXISTS public.rpc_employee_checkin(text, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.rpc_employee_checkout(text, jsonb);

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
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation), session_logs_data = EXCLUDED.session_logs_data, updated_at = v_current_time
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

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

  SELECT * INTO v_rec FROM public.daily_attendances WHERE employee_id = v_employee_id AND shift_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 2 ORDER BY shift_date DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active shift found within the last 2 days. If your shift started more than 48 hours ago, please contact your manager to correct attendance.'; END IF;
  IF NOT (v_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb) THEN RAISE EXCEPTION 'Your most recent shift is already checked out. No open session found.'; END IF;

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
      v_session := v_session || jsonb_build_object('logout_time', now(), 'logout_geolocation', p_geolocation, 'distance_from_hub_m', CASE WHEN v_dist_m IS NOT NULL THEN round(v_dist_m)::integer ELSE NULL END);
    END IF;
    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  UPDATE public.daily_attendances SET logout_time = now(), logout_geolocation = p_geolocation, session_logs_data = v_updated_sessions, updated_at = now() WHERE id = v_rec.id RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkout(text, jsonb) TO authenticated;

-- =========================================================================
-- 3. OVERTIME ALERTS CRON
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
        WHERE da.first_login_time < (NOW() - INTERVAL '11 hours') AND da.logout_time IS NULL
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

DO $$ BEGIN PERFORM cron.unschedule('check_overtime_alerts_cron'); EXCEPTION WHEN others THEN END $$;
SELECT cron.schedule('check_overtime_alerts_cron', '0 */6 * * *', $$SELECT public.check_overtime_alerts()$$);

-- =========================================================================
-- 4. NEW RPC: AUTO CHECKOUT STALE SESSIONS
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
        
        FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
            v_session := v_sessions->v_i;
            IF (v_session->>'logout_time') IS NULL THEN
                v_login_time := (v_session->>'login_time')::timestamp;
                v_session := v_session || jsonb_build_object('logout_time', v_login_time + INTERVAL '11 hours', 'auto_closed', true);
            END IF;
            v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
        END LOOP;

        UPDATE public.daily_attendances
        SET session_logs_data = v_updated_sessions, logout_time = (v_sessions->0->>'login_time')::timestamp + INTERVAL '11 hours', updated_at = NOW()
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
-- 5. NEW RPC: ATOMIC APPROVE SCHEDULE PLAN
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_approve_schedule_plan(
    p_plan_id uuid,
    p_reviewer_id uuid,
    p_week_offs jsonb,
    p_non_week_offs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.employee_schedule_plans
    SET status = 'approved',
        reviewed_by = p_reviewer_id,
        updated_at = NOW()
    WHERE id = p_plan_id;

    IF jsonb_array_length(p_week_offs) > 0 THEN
        PERFORM public.rpc_upsert_schedule_attendances(p_week_offs);
    END IF;

    IF jsonb_array_length(p_non_week_offs) > 0 THEN
        PERFORM public.rpc_clear_ghost_attendances(p_non_week_offs);
    END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.rpc_approve_schedule_plan(uuid, uuid, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
