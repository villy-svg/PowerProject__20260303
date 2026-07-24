-- =========================================================================
-- POWERPROJECT: Attendance — Distance-from-Hub Calculation
-- Migration: 20260724000000_attendance_distance_from_hub.sql
--
-- Skill compliance:
--   database-migration-policy §2 (Repair-Safe Idempotency — CREATE OR REPLACE)
--   database-migration-policy §5 (PostgreSQL Kick at end)
--   database-migration-policy §3 (New file for new feature, never edit baseline)
--
-- ─────────────────────────────────────────────────────────────────────────
-- WHAT THIS MIGRATION ADDS
-- ─────────────────────────────────────────────────────────────────────────
--
--  FEATURE — Distance-from-Hub stored in session_logs_data
--
--    Both rpc_employee_checkin and rpc_employee_checkout now embed a
--    'distance_from_hub_m' field (integer metres, rounded) into each
--    session log entry they write:
--
--      rpc_employee_checkin  → sets 'distance_from_hub_m' on the NEW
--                              session's login_geolocation side.
--
--      rpc_employee_checkout → sets 'distance_from_hub_m' on the open
--                              session's logout_geolocation side.
--
--    The distance is calculated via the Haversine formula using:
--      • Employee's GPS fix  : p_geolocation->>'lat', p_geolocation->>'lng'
--      • Hub's stored coords : hubs.lat, hubs.lng (added 20260723000000)
--
--    If either coordinate set is missing (NULL), distance is stored as NULL
--    so the frontend can gracefully show 'N/A' without crashing.
--
-- ─────────────────────────────────────────────────────────────────────────
-- HELPER: fn_haversine_m(lat1, lng1, lat2, lng2) → float8 (metres)
--
--   Uses the standard Haversine formula with Earth radius = 6371000 m.
--   Returns NULL if any argument is NULL (safe guard).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_haversine_m(
  p_lat1 float8,
  p_lng1 float8,
  p_lat2 float8,
  p_lng2 float8
)
RETURNS float8
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r      float8 := 6371000.0;   -- Earth radius in metres
  v_phi1   float8;
  v_phi2   float8;
  v_dlat   float8;
  v_dlng   float8;
  v_a      float8;
BEGIN
  IF p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN
    RETURN NULL;
  END IF;

  v_phi1 := radians(p_lat1);
  v_phi2 := radians(p_lat2);
  v_dlat := radians(p_lat2 - p_lat1);
  v_dlng := radians(p_lng2 - p_lng1);

  v_a := sin(v_dlat / 2) ^ 2
       + cos(v_phi1) * cos(v_phi2) * sin(v_dlng / 2) ^ 2;

  RETURN v_r * 2.0 * asin(sqrt(v_a));
END;
$$;


-- =========================================================================
-- SECTION 1: rpc_employee_checkin — add distance calculation on login
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_employee_checkin(
  p_shift_type      text,         -- 'day' or 'night'
  p_hub_id          uuid,         -- Selected hub for this shift
  p_device_id       text,         -- Device identifier (from Capacitor)
  p_geolocation     jsonb         -- { lat, lng, accuracy }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER                          -- Bypasses RLS for employee self-service
SET search_path = public, pg_catalog      -- Prevents search_path hijacking (pg_temp excluded)
AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_employee_id      uuid;
  v_is_active        boolean;
  v_shift_date       date;
  v_ist_now          timestamp;             -- Current time in IST (for date + hour extraction)
  v_current_time     timestamp with time zone := now();
  v_existing_rec     public.daily_attendances;
  v_session_entry    jsonb;
  v_result           jsonb;
  v_updated_sessions jsonb := '[]'::jsonb;
  v_session          jsonb;
  v_i                integer;
  -- Distance calculation
  v_hub_lat          float8;
  v_hub_lng          float8;
  v_emp_lat          float8;
  v_emp_lng          float8;
  v_dist_m           float8;
BEGIN
  -- -------------------------------------------------------------------------
  -- STEP 1: Resolve employee identity and active status in a single query.
  -- -------------------------------------------------------------------------
  SELECT employee_id, is_active
  INTO   v_employee_id, v_is_active
  FROM   public.user_profiles
  WHERE  id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Account deactivated. Contact your administrator.';
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 2: Determine logical shift_date in IST.
  -- -------------------------------------------------------------------------
  v_ist_now    := v_current_time AT TIME ZONE 'Asia/Kolkata';
  v_shift_date := v_ist_now::date;

  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 8 THEN
    v_shift_date := v_shift_date - 1;
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 3: Fetch the existing record and auto-close any dangling open sessions.
  -- -------------------------------------------------------------------------
  SELECT *
  INTO   v_existing_rec
  FROM   public.daily_attendances
  WHERE  employee_id = v_employee_id
    AND  shift_date  = v_shift_date;

  IF FOUND THEN
    IF v_existing_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb THEN
      FOR v_i IN 0..jsonb_array_length(v_existing_rec.session_logs_data)-1 LOOP
        v_session := v_existing_rec.session_logs_data->v_i;
        IF (v_session->>'logout_time') IS NULL THEN
          v_session := v_session || jsonb_build_object(
            'logout_time',        v_current_time,
            'logout_geolocation', p_geolocation,
            'auto_closed',        true
          );
        END IF;
        v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
      END LOOP;
    ELSE
      v_updated_sessions := v_existing_rec.session_logs_data;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 4a: Resolve hub coordinates for distance calculation.
  -- If the hub has no coordinates, distance is stored as NULL (not an error).
  -- -------------------------------------------------------------------------
  SELECT lat, lng
  INTO   v_hub_lat, v_hub_lng
  FROM   public.hubs
  WHERE  id = p_hub_id;

  -- Extract employee GPS fix from the geolocation payload
  v_emp_lat := (p_geolocation->>'lat')::float8;
  v_emp_lng := (p_geolocation->>'lng')::float8;

  -- Haversine distance in metres (NULL-safe: returns NULL if any coord missing)
  v_dist_m := public.fn_haversine_m(v_emp_lat, v_emp_lng, v_hub_lat, v_hub_lng);

  -- -------------------------------------------------------------------------
  -- STEP 4b: Build and append the new open session entry.
  -- 'distance_from_hub_m' stores the rounded integer metres (or NULL).
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- STEP 5: Upsert the daily attendance record
  -- -------------------------------------------------------------------------
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
    v_current_time,
    p_geolocation,
    v_updated_sessions
  )
  ON CONFLICT (employee_id, shift_date)
  DO UPDATE SET
    attendance_status = 'present',
    shift_type        = EXCLUDED.shift_type,
    first_login_time  = COALESCE(daily_attendances.first_login_time, v_current_time),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation),
    session_logs_data = EXCLUDED.session_logs_data,
    updated_at        = v_current_time
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;


-- =========================================================================
-- SECTION 2: rpc_employee_checkout — add distance calculation on logout
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_employee_checkout(
  p_device_id       text,
  p_geolocation     jsonb
)
RETURNS jsonb
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
  v_result           jsonb;
  -- Distance calculation
  v_hub_id           uuid;
  v_hub_lat          float8;
  v_hub_lng          float8;
  v_emp_lat          float8;
  v_emp_lng          float8;
  v_dist_m           float8;
BEGIN
  -- -------------------------------------------------------------------------
  -- STEP 1: Resolve employee identity and active status.
  -- -------------------------------------------------------------------------
  SELECT employee_id, is_active
  INTO   v_employee_id, v_is_active
  FROM   public.user_profiles
  WHERE  id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Account deactivated. Contact your administrator.';
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 2: Fetch the most recent attendance record within a 2-day window.
  -- -------------------------------------------------------------------------
  SELECT *
  INTO   v_rec
  FROM   public.daily_attendances
  WHERE  employee_id = v_employee_id
    AND  shift_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - 2
  ORDER BY shift_date DESC, created_at DESC
  LIMIT  1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active shift found within the last 2 days. If your shift started more than 48 hours ago, please contact your manager to correct attendance.';
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 2b: Validate the fetched record has at least one open session.
  -- -------------------------------------------------------------------------
  IF NOT (v_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb) THEN
    RAISE EXCEPTION 'Your most recent shift is already checked out. No open session found.';
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 3: Extract employee GPS fix from checkout geolocation payload.
  -- -------------------------------------------------------------------------
  v_emp_lat := (p_geolocation->>'lat')::float8;
  v_emp_lng := (p_geolocation->>'lng')::float8;

  -- -------------------------------------------------------------------------
  -- STEP 4: Close all open sessions, calculating distance_from_hub_m for each.
  --
  -- We read hub_id from the open session entry to look up hub coordinates.
  -- If the hub has no lat/lng stored, distance is NULL (not a hard error).
  -- -------------------------------------------------------------------------
  v_sessions := v_rec.session_logs_data;

  FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_i;

    IF (v_session->>'logout_time') IS NULL THEN
      -- Resolve hub coordinates for this session's hub_id
      v_hub_id  := (v_session->>'hub_id')::uuid;
      v_hub_lat := NULL;
      v_hub_lng := NULL;

      IF v_hub_id IS NOT NULL THEN
        SELECT lat, lng
        INTO   v_hub_lat, v_hub_lng
        FROM   public.hubs
        WHERE  id = v_hub_id;
      END IF;

      -- Haversine distance at checkout point
      v_dist_m := public.fn_haversine_m(v_emp_lat, v_emp_lng, v_hub_lat, v_hub_lng);

      v_session := v_session || jsonb_build_object(
        'logout_time',         now(),
        'logout_geolocation',  p_geolocation,
        'distance_from_hub_m', CASE WHEN v_dist_m IS NOT NULL THEN round(v_dist_m)::integer ELSE NULL END
      );
    END IF;

    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  -- -------------------------------------------------------------------------
  -- STEP 5: Persist the updated record
  -- -------------------------------------------------------------------------
  UPDATE public.daily_attendances
  SET
    logout_time        = now(),
    logout_geolocation = p_geolocation,
    session_logs_data  = v_updated_sessions,
    updated_at         = now()
  WHERE  id = v_rec.id
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;


-- =========================================================================
-- PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- =========================================================================
NOTIFY pgrst, 'reload schema';


-- =========================================================================
-- Evolution Ledger
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260724000000_attendance_distance_from_hub',
  'Added fn_haversine_m() pure-SQL helper (IMMUTABLE) for Haversine distance in metres. Updated rpc_employee_checkin to look up hub lat/lng from hubs table and embed distance_from_hub_m (integer metres) into the new session log entry. Updated rpc_employee_checkout to similarly embed distance_from_hub_m on the open session at logout time. Distance is NULL-safe: stored as NULL when hub has no coordinates or employee location is unavailable.',
  ARRAY['daily_attendances', 'hubs']
)
ON CONFLICT DO NOTHING;
