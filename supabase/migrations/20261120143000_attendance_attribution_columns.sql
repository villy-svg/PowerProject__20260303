-- =========================================================================
-- POWERPROJECT: Attendance Closure — Phase 1 (Backend Attribution)
--
-- Scope (Option A1 + B1):
--   1. Add nullable attribution columns to public.daily_attendances:
--        - marked_by     (uuid -> user_profiles.id, ON DELETE SET NULL)
--        - approved_by   (uuid -> user_profiles.id, ON DELETE SET NULL)
--        - marked_source (text with CHECK constraint for the 6 valid sources)
--      + partial indexes for FK delete safety & future audit queries.
--   2. Wire public.rpc_employee_checkin (preserving all Aug 21 multi-session
--      and old-APK compatibility fixes) to record:
--        marked_by = auth.uid(), approved_by = NULL, marked_source = 'self_checkin'
--   3. Wire public.approve_attendance_edit_request (preserving Leave Wallet
--      ledger logic verbatim) to record:
--        marked_by = v_req.requested_by,
--        approved_by = COALESCE(auth.uid(), p_reviewer_id),
--        marked_source = 'edit_request'
--   4. Reload PostgREST schema cache.
--
-- Backward Compatibility:
--   - 100% additive; all new columns allow NULL.
--   - RPC signatures and return types are completely unchanged.
--   - Zero frontend or APK update required.
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Additive Attribution Columns & Constraint on daily_attendances
-- -------------------------------------------------------------------------
ALTER TABLE public.daily_attendances
  ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marked_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_daily_attendances_marked_source'
      AND conrelid = 'public.daily_attendances'::regclass
  ) THEN
    ALTER TABLE public.daily_attendances
      ADD CONSTRAINT chk_daily_attendances_marked_source
      CHECK (
        marked_source IS NULL OR marked_source IN (
          'self_checkin',
          'self_weekoff',
          'unmarked_task',
          'attendance_board',
          'edit_request',
          'schedule_plan'
        )
      );
  END IF;
END $$;

-- Partial indexes: tiny footprint, keeps ON DELETE SET NULL fast, and
-- accelerates future Phase 5 attribution/audit lookups.
CREATE INDEX IF NOT EXISTS idx_daily_attendances_marked_by
  ON public.daily_attendances (marked_by)
  WHERE marked_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_attendances_approved_by
  ON public.daily_attendances (approved_by)
  WHERE approved_by IS NOT NULL;

-- -------------------------------------------------------------------------
-- SECTION 2: Wire rpc_employee_checkin (Self Check-In Attribution)
-- Based verbatim on 20260821105000_fix_multisession_logout_time.sql.
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
  SELECT employee_id, is_active INTO v_employee_id, v_is_active
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'No employee linked to this user account.';
  END IF;

  IF NOT v_is_active THEN
    RAISE EXCEPTION 'Account deactivated. Contact your administrator.';
  END IF;

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

  -- Night Shift logic: rolls back logical date if before 5 AM IST
  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 5 THEN
    v_shift_date := v_shift_date - 1;
  END IF;

  -- Load today's existing completed sessions so we can append the new one.
  SELECT * INTO v_existing_rec
  FROM public.daily_attendances
  WHERE employee_id = v_employee_id AND shift_date = v_shift_date;

  IF FOUND THEN
    v_updated_sessions := v_existing_rec.session_logs_data;
  END IF;

  SELECT lat, lng INTO v_hub_lat, v_hub_lng
  FROM public.hubs
  WHERE id = p_hub_id;

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

  INSERT INTO public.daily_attendances (
    employee_id,
    shift_date,
    attendance_status,
    shift_type,
    first_login_time,
    login_geolocation,
    session_logs_data,
    marked_by,
    approved_by,
    marked_source
  )
  VALUES (
    v_employee_id,
    v_shift_date,
    'present',
    p_shift_type::public.shift_type_enum,
    v_current_time,
    p_geolocation,
    v_updated_sessions,
    v_user_id,
    NULL,
    'self_checkin'
  )
  ON CONFLICT (employee_id, shift_date) DO UPDATE SET
    attendance_status = 'present',
    shift_type        = EXCLUDED.shift_type,
    first_login_time  = COALESCE(daily_attendances.first_login_time, v_current_time),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation),
    session_logs_data = EXCLUDED.session_logs_data,
    marked_by         = v_user_id,
    approved_by       = NULL, -- Clear any prior schedule/edit approver on physical check-in
    marked_source     = 'self_checkin',
    updated_at        = v_current_time,
    logout_time       = NULL  -- Preserved for older APK bundles detecting open second shifts
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_employee_checkin(text, uuid, text, jsonb) TO authenticated;

-- -------------------------------------------------------------------------
-- SECTION 3: Wire approve_attendance_edit_request (Edit Request Attribution)
-- Based verbatim on 20260709000001_leave_wallet_admin_rpc.sql.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_attendance_edit_request(
  p_request_id  UUID,
  p_reviewer_id UUID   -- user_profiles.id of the approver (fallback when auth.uid() is NULL)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_req             RECORD;
  v_old_status      public.attendance_status_enum;
  v_approver_id     UUID := COALESCE(auth.uid(), p_reviewer_id);
  v_reviewer_emp_id UUID;  -- employees.id of the approver (FK-safe for ledger insert)
BEGIN
  -- Resolve the reviewer's employees.id from their user_profiles row.
  -- employee_leave_ledgers.created_by references employees(id), NOT user_profiles(id).
  -- If the reviewer has no linked employee record, v_reviewer_emp_id stays NULL
  -- (safe because created_by is ON DELETE SET NULL).
  SELECT employee_id INTO v_reviewer_emp_id
  FROM public.user_profiles
  WHERE id = v_approver_id;

  -- Lock the edit request
  SELECT * INTO v_req
  FROM public.attendance_edit_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RAISE EXCEPTION 'Attendance edit request not found.';
  END IF;

  IF v_req.request_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending requests can be approved.';
  END IF;

  -- Find the current status in daily_attendances (if any)
  SELECT attendance_status INTO v_old_status
  FROM public.daily_attendances
  WHERE employee_id = v_req.employee_id AND shift_date = v_req.shift_date;

  -- Update the edit request
  UPDATE public.attendance_edit_requests
  SET
    request_status = 'approved',
    reviewed_by    = v_approver_id,
    updated_at     = NOW()
  WHERE id = p_request_id;

  -- Upsert into daily_attendances with Maker (requested_by) & Checker (v_approver_id)
  INSERT INTO public.daily_attendances (
    employee_id,
    shift_date,
    attendance_status,
    shift_type,
    first_login_time,
    logout_time,
    marked_by,
    approved_by,
    marked_source,
    created_at,
    updated_at
  ) VALUES (
    v_req.employee_id,
    v_req.shift_date,
    v_req.suggested_status,
    v_req.suggested_shift_type,
    v_req.suggested_first_login_time,
    v_req.suggested_logout_time,
    v_req.requested_by,
    v_approver_id,
    'edit_request',
    NOW(),
    NOW()
  )
  ON CONFLICT (employee_id, shift_date)
  DO UPDATE SET
    attendance_status = EXCLUDED.attendance_status,
    shift_type        = EXCLUDED.shift_type,
    first_login_time  = EXCLUDED.first_login_time,
    logout_time       = EXCLUDED.logout_time,
    marked_by         = EXCLUDED.marked_by,
    approved_by       = EXCLUDED.approved_by,
    marked_source     = EXCLUDED.marked_source,
    updated_at        = NOW();

  -- Wallet Math:
  -- Scenario A: Was NOT a leave, now IS a leave -> Deduct 1 day
  IF COALESCE(v_old_status::text, '') != 'leave' AND v_req.suggested_status = 'leave' THEN
    INSERT INTO public.employee_leave_ledgers (
      employee_id, transaction_type, amount, description, reference_edit_request_id, created_by, effective_date, leave_type
    ) VALUES (
      v_req.employee_id, 'LEAVE_TAKEN', -1,
      COALESCE(v_req.maker_note, 'Leave approved via Attendance Board'),
      p_request_id, v_reviewer_emp_id, v_req.shift_date, COALESCE(v_req.suggested_leave_type, 'SL')
    );
  END IF;

  -- Scenario B: WAS a leave, now is SOMETHING ELSE (Revoke/Refund) -> Refund 1 day
  IF COALESCE(v_old_status::text, '') = 'leave' AND v_req.suggested_status != 'leave' THEN
    INSERT INTO public.employee_leave_ledgers (
      employee_id, transaction_type, amount, description, reference_edit_request_id, created_by, effective_date, leave_type
    ) VALUES (
      v_req.employee_id, 'LEAVE_REFUND', 1,
      'Leave revoked/changed via Attendance Board',
      p_request_id, v_reviewer_emp_id, v_req.shift_date, COALESCE(v_req.suggested_leave_type, 'SL')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_attendance_edit_request(UUID, UUID) TO authenticated;

-- -------------------------------------------------------------------------
-- SECTION 4: Reload PostgREST Schema Cache (Mandatory)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
