-- =========================================================================
-- POWERPROJECT: Attendance and User Flow Bug Fixes
-- Migration: 20260624150000_attendance_and_user_flow_fixes.sql
--
-- Skill compliance:
--   database-migration-policy §2 (Repair-Safe Idempotency — CREATE OR REPLACE)
--   database-migration-policy §5 (PostgreSQL Kick at end)
--   rbac-security-system §3 (Access validation inside SECURITY DEFINER functions)
--   runtime-stability-and-coding-health (Timezone correctness, trigger conflict awareness)
--
-- ─────────────────────────────────────────────────────────────────────────
-- BUGS FIXED IN THIS MIGRATION
-- ─────────────────────────────────────────────────────────────────────────
--
--  BUG 1 — [Security] Employee hard-delete left linked user fully active
--    Before: The BEFORE DELETE branch in handle_employee_sync() only nulled
--    out user_profiles.employee_id. It did NOT wipe vertical_access,
--    feature_access, or set is_active = false. Hard-deleting an employee
--    therefore left an orphaned, fully-privileged, active user account.
--    Fix: DELETE branch now wipes both access tables and sets is_active = false.
--    NOTE: role_id is intentionally NOT reset here. The check_role_update_authorization()
--    BEFORE UPDATE trigger on user_profiles blocks any role_id change unless
--    auth.uid() is a master_admin. In a trigger context auth.uid() is NULL,
--    so setting role_id would always raise an authorization exception and
--    crash the entire delete. is_active = false is the correct security gate —
--    the role column is irrelevant for a deactivated, unlinked account.
--
--  BUG 2 — [Security] Deactivated users could call check-in / check-out RPCs
--    Before: rpc_employee_checkin and rpc_employee_checkout only validated
--    that employee_id IS NOT NULL. A deactivated employee (is_active = false)
--    with a still-valid Supabase JWT could successfully clock in/out via the
--    SECURITY DEFINER RPC (which bypasses RLS), polluting the attendance system.
--    Fix: Both RPCs now read is_active alongside employee_id in a single query
--    and RAISE EXCEPTION immediately if the account is deactivated.
--
--  BUG 3 — [Attendance] Night shift cross-day overlap corrupted records
--    Before: v_shift_date was hardcoded as CURRENT_DATE (server UTC).
--    Employees checking in post-midnight for a night shift (e.g. 01:00 IST)
--    received shift_date = CURRENT_DATE (UTC), which for IST is yesterday.
--    Worse: a second night-shift check-in on the same calendar day would
--    ON CONFLICT-merge into the earlier post-midnight record, creating a
--    single corrupted record with two logically distinct shifts.
--    Fix: shift_date is now derived from v_current_time AT TIME ZONE
--    'Asia/Kolkata' (IST). For night shifts where IST hour < 8, shift_date
--    is rolled back one day to match the logical shift start.
--    OPERATOR PRECEDENCE FIX: The previous draft used:
--      v_current_time AT TIME ZONE 'UTC' + INTERVAL '5.5 hours'
--    This is wrong — AT TIME ZONE binds tighter than +, so the interval was
--    added to a naive timestamp (not a timestamptz), giving wrong results.
--    Named timezone 'Asia/Kolkata' is used instead.
--
--  BUG 4 — [Attendance] Overzealous multi-session appending
--    Before: rpc_employee_checkin blindly appended a new session on every
--    call with no awareness of existing open sessions. Network retries or
--    accidental double-taps produced multiple open sessions (logout_time=NULL)
--    per day, causing checkout to close all of them simultaneously and
--    artificially inflating calculated work hours.
--    Fix: checkin now reads the existing record for the logical shift_date,
--    auto-closes any open session (marking it auto_closed=true for audit
--    visibility), and then appends the new session. This ensures exactly
--    one open session exists at any point in time.
--    NOTE: auto_closed=true is a diagnostic field in the session JSONB.
--    The frontend should render these sessions with a warning badge so
--    employees know a session was auto-closed on their behalf.
--
-- ─────────────────────────────────────────────────────────────────────────
-- FUNCTIONS REPLACED (body only — existing triggers remain valid)
-- ─────────────────────────────────────────────────────────────────────────
--   • handle_employee_sync()      — triggers trg_sync_employee_to_profile_upsert
--                                   and trg_sync_employee_to_profile_delete
--                                   still point here; no trigger re-creation needed.
--   • rpc_employee_checkin()      — grants already exist; no re-grant needed.
--   • rpc_employee_checkout()     — grants already exist; no re-grant needed.
--
-- =========================================================================


-- =========================================================================
-- SECTION 1: handle_employee_sync() — Fix for BUG 1 (hard-delete leak)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_employee_sync()
RETURNS TRIGGER AS $$
BEGIN

    -- =======================================================================
    -- A. INSERT OR UPDATE (unchanged from 20260523160000 except formatting)
    -- =======================================================================
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN

        -- -------------------------------------------------------------------
        -- A-i. Profile linking
        -- Link the matching user_profiles row whose employee_id is still NULL.
        -- Fires on every INSERT/UPDATE so new employees auto-link to existing
        -- user accounts, and email corrections re-trigger linking.
        -- -------------------------------------------------------------------
        UPDATE public.user_profiles
        SET    employee_id = NEW.id,
               updated_at  = now()
        WHERE  LOWER(email) = LOWER(NEW.email)
          AND  employee_id IS NULL;

        -- -------------------------------------------------------------------
        -- A-ii. Status cascade → user is_active
        -- Only fires on UPDATE when status column actually changes.
        -- -------------------------------------------------------------------
        IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

            IF NEW.status = 'Inactive' THEN
                -- Wipe access grants first (while we can still navigate via employee_id)
                DELETE FROM public.vertical_access
                WHERE  user_id IN (
                           SELECT id FROM public.user_profiles
                           WHERE  employee_id = NEW.id
                       );

                DELETE FROM public.feature_access
                WHERE  user_id IN (
                           SELECT id FROM public.user_profiles
                           WHERE  employee_id = NEW.id
                       );

                -- Deactivate and demote
                UPDATE public.user_profiles
                SET    is_active   = false,
                       role_id     = 'vertical_viewer',
                       updated_at  = now()
                WHERE  employee_id = NEW.id;

            ELSIF NEW.status = 'Active' THEN
                -- Reactivate only — permissions must be re-granted explicitly by admin
                UPDATE public.user_profiles
                SET    is_active  = true,
                       updated_at = now()
                WHERE  employee_id = NEW.id;
            END IF;

        END IF;

        -- -------------------------------------------------------------------
        -- A-iii. Email change → re-wire the profile link
        -- -------------------------------------------------------------------
        IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN

            -- Unlink profile whose email no longer matches the new address
            UPDATE public.user_profiles
            SET    employee_id = NULL,
                   updated_at  = now()
            WHERE  employee_id = NEW.id
              AND  LOWER(email) != LOWER(NEW.email);

            -- Link profile whose email matches the new address (if unlinked)
            UPDATE public.user_profiles
            SET    employee_id = NEW.id,
                   updated_at  = now()
            WHERE  LOWER(email) = LOWER(NEW.email)
              AND  employee_id IS NULL;

        END IF;

        RETURN NEW;
    END IF;

    -- =======================================================================
    -- B. DELETE — BUG FIX (runs BEFORE DELETE to avoid FK constraint failures)
    --
    -- CRITICAL DESIGN NOTE:
    --   We do NOT reset role_id here. The check_role_update_authorization()
    --   BEFORE UPDATE trigger on user_profiles blocks role_id changes unless
    --   auth.uid() resolves to a master_admin. In a DB trigger context,
    --   auth.uid() is NULL → is_master_admin() returns false → the update
    --   raises an exception and the entire DELETE would fail.
    --
    --   is_active = false is the correct and sufficient security gate.
    --   A deactivated account cannot access the app regardless of role_id.
    --   The role_id is intentionally left as-is for audit trail completeness.
    -- =======================================================================
    IF TG_OP = 'DELETE' THEN

        -- Step 1: Wipe all access grants while employee_id is still resolvable
        DELETE FROM public.vertical_access
        WHERE  user_id IN (
                   SELECT id FROM public.user_profiles
                   WHERE  employee_id = OLD.id
               );

        DELETE FROM public.feature_access
        WHERE  user_id IN (
                   SELECT id FROM public.user_profiles
                   WHERE  employee_id = OLD.id
               );

        -- Step 2: Deactivate and unlink.
        -- role_id intentionally NOT changed (see design note above).
        UPDATE public.user_profiles
        SET    employee_id = NULL,
               is_active   = false,
               updated_at  = now()
        WHERE  employee_id = OLD.id;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- =========================================================================
-- SECTION 2: rpc_employee_checkin() — Fixes for BUGs 2, 3, 4
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
BEGIN
  -- -------------------------------------------------------------------------
  -- STEP 1: Resolve employee identity and active status in a single query.
  -- BUG 2 FIX: We now also read is_active and immediately block deactivated
  -- accounts before any attendance modification is attempted.
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
  --
  -- BUG 3 FIX (timezone): CURRENT_DATE resolves using the DB server's UTC
  -- timezone, not IST. For an employee in India, midnight IST = 18:30 UTC
  -- of the previous day. We must derive the date from IST wall-clock time.
  --
  -- BUG 3 FIX (operator precedence): The previous draft used:
  --   v_current_time AT TIME ZONE 'UTC' + INTERVAL '5.5 hours'
  -- AT TIME ZONE binds tighter than +, producing a naive timestamp then
  -- adding 5.5h — which is wrong. Using 'Asia/Kolkata' directly is correct.
  --
  -- Night shift rule: if the IST hour is before 08:00, the employee is
  -- completing a shift that logically started yesterday. Roll back one day.
  -- -------------------------------------------------------------------------
  v_ist_now    := v_current_time AT TIME ZONE 'Asia/Kolkata';
  v_shift_date := v_ist_now::date;

  IF p_shift_type = 'night' AND extract(hour FROM v_ist_now) < 8 THEN
    v_shift_date := v_shift_date - 1;
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 3: Fetch the existing record for this logical shift_date (if any)
  -- and pre-close any dangling open sessions before appending a new one.
  --
  -- BUG 4 FIX: Without this guard, double-taps or network retries create
  -- multiple open sessions per day. Checkout then closes all of them
  -- simultaneously, inflating reported work hours.
  --
  -- Sessions auto-closed here are marked auto_closed=true for audit
  -- visibility. The frontend should render these with a warning badge.
  -- -------------------------------------------------------------------------
  SELECT *
  INTO   v_existing_rec
  FROM   public.daily_attendances
  WHERE  employee_id = v_employee_id
    AND  shift_date  = v_shift_date;

  IF FOUND THEN
    IF v_existing_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb THEN
      -- There is at least one open session — auto-close it before adding the new one
      FOR v_i IN 0..jsonb_array_length(v_existing_rec.session_logs_data)-1 LOOP
        v_session := v_existing_rec.session_logs_data->v_i;
        IF (v_session->>'logout_time') IS NULL THEN
          v_session := v_session || jsonb_build_object(
            'logout_time',        v_current_time,
            'logout_geolocation', p_geolocation,
            'auto_closed',        true   -- Diagnostic flag for frontend display
          );
        END IF;
        v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
      END LOOP;
    ELSE
      -- All sessions already closed — carry them forward untouched
      v_updated_sessions := v_existing_rec.session_logs_data;
    END IF;
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 4: Build and append the new open session entry
  -- -------------------------------------------------------------------------
  v_session_entry := jsonb_build_object(
    'hub_id',             p_hub_id,
    'login_time',         v_current_time,
    'logout_time',        NULL,
    'device_id',          p_device_id,
    'login_geolocation',  p_geolocation,
    'logout_geolocation', NULL
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
    -- Preserve first_login_time — don't overwrite with a later re-login time
    first_login_time  = COALESCE(daily_attendances.first_login_time, v_current_time),
    login_geolocation = COALESCE(daily_attendances.login_geolocation, p_geolocation),
    -- Replace session_logs_data with the pre-processed version (open sessions closed)
    session_logs_data = EXCLUDED.session_logs_data,
    updated_at        = v_current_time
  RETURNING to_jsonb(daily_attendances.*) INTO v_result;

  RETURN v_result;
END;
$$;


-- =========================================================================
-- SECTION 3: rpc_employee_checkout() — Fix for BUG 2 (deactivated user gate)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_employee_checkout(
  p_device_id       text,
  p_geolocation     jsonb
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
  v_rec              public.daily_attendances;
  v_sessions         jsonb;
  v_updated_sessions jsonb := '[]'::jsonb;
  v_session          jsonb;
  v_i                integer;
  v_result           jsonb;
BEGIN
  -- -------------------------------------------------------------------------
  -- STEP 1: Resolve employee identity and active status.
  -- BUG 2 FIX: Block deactivated accounts from checking out.
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
  -- The ±2 day guard prevents accidentally closing a zombie/stale record.
  -- No real shift exceeds 36 hours.
  --
  -- IST FIX: We derive the cutoff date from IST wall-clock time, matching
  -- the same logic used in rpc_employee_checkin to write shift_date.
  -- Using CURRENT_DATE (UTC) here would be inconsistent: at 01:00 IST
  -- (19:30 UTC yesterday), CURRENT_DATE is "yesterday" UTC, making the
  -- window start 2 days earlier than intended from the employee's perspective.
  -- While the 2-day buffer usually absorbs this, being explicit is safer.
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
  -- This catches the case where the most recent record is already fully
  -- checked out (e.g. user double-taps the checkout button).
  -- -------------------------------------------------------------------------
  IF NOT (v_rec.session_logs_data @> '[{"logout_time": null}]'::jsonb) THEN
    RAISE EXCEPTION 'Your most recent shift is already checked out. No open session found.';
  END IF;

  -- -------------------------------------------------------------------------
  -- STEP 3: Close all open sessions.
  -- In the normal case there is exactly one open session. If there are
  -- anomalous open sessions (from a pre-fix deployment), all are closed
  -- with the same timestamp to preserve data integrity.
  -- -------------------------------------------------------------------------
  v_sessions := v_rec.session_logs_data;

  FOR v_i IN 0..jsonb_array_length(v_sessions)-1 LOOP
    v_session := v_sessions->v_i;
    IF (v_session->>'logout_time') IS NULL THEN
      v_session := v_session || jsonb_build_object(
        'logout_time',        now(),
        'logout_geolocation', p_geolocation
      );
    END IF;
    v_updated_sessions := v_updated_sessions || jsonb_build_array(v_session);
  END LOOP;

  -- -------------------------------------------------------------------------
  -- STEP 4: Persist the updated record
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
  '20260624150000_attendance_and_user_flow_fixes',
  'Four bug fixes: (1) handle_employee_sync DELETE branch now wipes vertical_access/feature_access and sets is_active=false on hard-delete — role_id intentionally NOT reset to avoid trg_protect_role_id trigger conflict in NULL auth context; (2) rpc_employee_checkin and rpc_employee_checkout now read is_active alongside employee_id and block deactivated accounts; (3) shift_date derivation now uses Asia/Kolkata timezone correctly (fixes UTC midnight bug and operator precedence trap in AT TIME ZONE arithmetic); (4) rpc_employee_checkin now auto-closes existing open sessions before appending a new one, preventing duplicate-session hour inflation.',
  ARRAY['employees', 'user_profiles', 'vertical_access', 'feature_access', 'daily_attendances']
)
ON CONFLICT DO NOTHING;
