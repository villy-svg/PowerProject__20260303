-- =========================================================================
-- POWERPROJECT: Attendance Board — Phase 2.1: RPC Functions
--
-- These RPC functions allow employees to check in/out to their own
-- attendance records without needing 'editor' RLS access on daily_attendances.
-- They run as SECURITY DEFINER (elevated) but validate the caller's identity.
--
-- Skill compliance:
--   database-migration-policy §5 (PostgreSQL Kick)
--   rbac-security-system §3 (Access validation inside function)
-- =========================================================================

-- -------------------------------------------------------------------------
-- RPC: rpc_employee_checkin
--
-- Called when an employee taps "Start Shift".
-- Behavior:
--   1. Look up the calling user's employee_id from user_profiles.
--   2. Check if a daily_attendances record exists for today.
--   3. If none: insert with status='present', first_login_time=now().
--   4. If exists with status 'week-off' or 'leave': override to 'present'.
--   5. Append a new session object to session_logs_data JSONB array.
--   6. Return the upserted record.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkin(
  p_shift_type      text,         -- 'day' or 'night'
  p_hub_id          uuid,         -- Selected hub for this shift
  p_device_id       text,         -- Device identifier (from Capacitor)
  p_geolocation     jsonb         -- { lat, lng, accuracy }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as the function owner, bypassing RLS for self-service
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_employee_id   uuid;
  v_shift_date    date := CURRENT_DATE;
  v_existing_rec  public.daily_attendances;
  v_session_entry jsonb;
  v_result        jsonb;
BEGIN
  -- 1. Resolve employee_id from user_profiles
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  -- 2. Build the new session log entry
  v_session_entry := jsonb_build_object(
    'hub_id',              p_hub_id,
    'login_time',          now(),
    'logout_time',         NULL,
    'device_id',           p_device_id,
    'login_geolocation',   p_geolocation,
    'logout_geolocation',  NULL
  );

  -- 3. Upsert the daily attendance record
  INSERT INTO public.daily_attendances (
    employee_id,
    shift_date,
    attendance_status,
    shift_type,
    first_login_time,
    login_geolocation,
    session_logs_data
  )
  VALUES (
    v_employee_id,
    v_shift_date,
    'present',
    p_shift_type::public.shift_type_enum,
    now(),
    p_geolocation,
    jsonb_build_array(v_session_entry)  -- Init array with first session
  )
  ON CONFLICT (employee_id, shift_date)
  DO UPDATE SET
    -- Override 'week-off'/'leave'/'absent' to 'present' on physical check-in
    attendance_status = 'present',
    shift_type        = EXCLUDED.shift_type,
    -- Preserve first_login_time if already set (don't overwrite with re-login)
    first_login_time  = COALESCE(daily_attendances.first_login_time, now()),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation),
    -- Append new session to the JSONB array
    session_logs_data = daily_attendances.session_logs_data || jsonb_build_array(v_session_entry),
    updated_at        = now()
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- -------------------------------------------------------------------------
-- RPC: rpc_employee_checkout
--
-- Called when an employee taps "End Shift".
-- Behavior:
--   1. Resolve employee_id from user_profiles.
--   2. Find the open (active) session in session_logs_data (logout_time IS NULL).
--   3. Set main logout_time and update the open session object in JSONB.
--   4. Return the updated record.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_employee_checkout(
  p_device_id       text,
  p_geolocation     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id       uuid := auth.uid();
  v_employee_id   uuid;
  v_shift_date    date := CURRENT_DATE;
  v_rec           public.daily_attendances;
  v_sessions      jsonb;
  v_updated_sessions jsonb;
  v_session       jsonb;
  v_i             integer;
  v_result        jsonb;
BEGIN
  -- 1. Resolve employee_id
  SELECT employee_id INTO v_employee_id
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  -- 2. Fetch the existing record for today
  SELECT * INTO v_rec
  FROM public.daily_attendances
  WHERE employee_id = v_employee_id
    AND shift_date = v_shift_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active attendance record found for today.';
  END IF;

  -- 3. Find the open session (logout_time IS NULL) and close it
  v_sessions := v_rec.session_logs_data;
  v_updated_sessions := '[]'::jsonb;

  FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_i;
    -- Close the most recent open session
    IF (v_session->>'logout_time') IS NULL THEN
      v_session := v_session
        || jsonb_build_object(
             'logout_time',        now(),
             'logout_geolocation', p_geolocation
           );
    END IF;
    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  -- 4. Update the record
  UPDATE public.daily_attendances
  SET
    logout_time          = now(),
    logout_geolocation   = p_geolocation,
    session_logs_data    = v_updated_sessions,
    updated_at           = now()
  WHERE employee_id = v_employee_id
    AND shift_date = v_shift_date
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users so they can call via supabase.rpc()
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_employee_checkout(text, jsonb)
  TO authenticated;

-- -------------------------------------------------------------------------
-- PostgreSQL Kick
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
