-- =========================================================================
-- POWERPROJECT: Fix Multi-Session Checkout Bug
-- Bug fix for Kunal, Bibash, and Uchirappa's checkout issues.
-- When a user checks in for a second session on the same day, we must reset
-- the top-level logout_time to NULL so that older frontend bundles correctly
-- detect the open shift.
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
    attendance_status = 'present', 
    shift_type = EXCLUDED.shift_type, 
    first_login_time = COALESCE(daily_attendances.first_login_time, v_current_time),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation), 
    session_logs_data = EXCLUDED.session_logs_data, 
    updated_at = v_current_time,
    logout_time = NULL -- FIXED: This resets the logout time for subsequent sessions
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
