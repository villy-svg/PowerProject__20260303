-- =========================================================================
-- POWERPROJECT: Attendance V2 — Hardening RPCs for Night Shift & Multi-Hub
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 1: Update Check-in RPC
-- Adds strict guard to prevent concurrent open shifts across the last 3 days.
-- Changes Night Shift threshold from < 8 AM to < 5 AM.
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

  -- GUARD: Prevent check-in if there is ANY open session in the last 3 days
  PERFORM 1 FROM public.daily_attendances 
  WHERE employee_id = v_employee_id 
    AND shift_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 3
    AND session_logs_data @> '[{"logout_time": null}]'::jsonb;
    
  IF FOUND THEN
    RAISE EXCEPTION 'You already have an active shift. Please check out of your previous shift before starting a new one.';
  END IF;

  v_ist_now    := v_current_time AT TIME ZONE 'Asia/Kolkata';
  v_shift_date := v_ist_now::date;
  
  -- Night Shift logic: rolls back logical date if before 5 AM
  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 5 THEN 
    v_shift_date := v_shift_date - 1; 
  END IF;

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

  -- Select the specific row that has an OPEN session (logout_time: null) within the last 3 days
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

-- -------------------------------------------------------------------------
-- STEP 3: PostgreSQL Kick
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
