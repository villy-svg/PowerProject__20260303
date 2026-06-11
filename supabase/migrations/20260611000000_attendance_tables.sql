-- =========================================================================
-- POWERPROJECT: Attendance Board — Phase 1: Schema
-- Creates daily_attendances and attendance_edit_requests tables.
-- 
-- Skill compliance:
--   database-migration-policy §3 (Iterative Evolution - new timestamped file)
--   database-migration-policy §5 (PostgreSQL Kick at end)
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 1: Create ENUM types (idempotent with DO block)
-- -------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.attendance_status_enum AS ENUM (
    'present', 'week-off', 'leave', 'absent'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.shift_type_enum AS ENUM (
    'day', 'night'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.edit_request_status_enum AS ENUM (
    'pending', 'approved', 'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------------------------
-- STEP 2: daily_attendances (Source of Truth)
-- 
-- Design notes:
--   - shift_date is a DATE (not timestamp) representing the logical working
--     day. For night shifts, this is the date the shift STARTED.
--   - session_logs_data is JSONB (array) to provision for future multi-hub
--     auto-checkout without schema migration. Default is empty array [].
--   - Composite UNIQUE on (employee_id, shift_date) enforces one record
--     per employee per logical day.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_attendances (
  id                    uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id           uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date            date NOT NULL,
  attendance_status     public.attendance_status_enum NOT NULL DEFAULT 'absent',
  shift_type            public.shift_type_enum,
  first_login_time      timestamp with time zone,
  login_geolocation     jsonb,
  logout_time           timestamp with time zone,
  logout_geolocation    jsonb,
  -- JSONB array of session objects. Each object shape:
  -- { hub_id, login_time, logout_time, device_id, login_geolocation, logout_geolocation }
  -- This provisions for future multi-hub auto-checkout without migration.
  session_logs_data     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamp with time zone NOT NULL DEFAULT now(),
  updated_at            timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_attendances_employee_date_unique UNIQUE (employee_id, shift_date)
);

-- -------------------------------------------------------------------------
-- STEP 3: attendance_edit_requests (Staging Area / Maker-Checker)
--
-- Design notes:
--   - daily_attendance_id is NULLABLE so contributors can suggest a record
--     for a FUTURE date that doesn't have a daily_attendances row yet.
--   - requested_by = the contributor (maker). reviewed_by = the editor (checker).
--   - This table is APPEND-ONLY from the contributor side. Editors only
--     update request_status and reviewed_by.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_edit_requests (
  id                          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Nullable: allows suggestions for future dates with no existing record
  daily_attendance_id         uuid REFERENCES public.daily_attendances(id) ON DELETE SET NULL,
  employee_id                 uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_date                  date NOT NULL,
  suggested_status            public.attendance_status_enum NOT NULL,
  suggested_shift_type        public.shift_type_enum,
  suggested_first_login_time  timestamp with time zone,
  suggested_logout_time       timestamp with time zone,
  -- The user who submitted the request (contributor / maker)
  requested_by                uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- Default 'pending'; updated by editor/admin
  request_status              public.edit_request_status_enum NOT NULL DEFAULT 'pending',
  -- The user who reviewed (editor / checker). Null until reviewed.
  reviewed_by                 uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  review_note                 text,
  created_at                  timestamp with time zone NOT NULL DEFAULT now(),
  updated_at                  timestamp with time zone NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- STEP 4: Performance Indexes
-- -------------------------------------------------------------------------

-- Most frequent query: all records for a date range (Manager Board)
CREATE INDEX IF NOT EXISTS idx_daily_attendances_shift_date
  ON public.daily_attendances(shift_date);

-- Lookup by employee (Employee self-service screen)
CREATE INDEX IF NOT EXISTS idx_daily_attendances_employee_id
  ON public.daily_attendances(employee_id);

-- Compound: editor fetches pending requests across the org
CREATE INDEX IF NOT EXISTS idx_attendance_edit_requests_status
  ON public.attendance_edit_requests(request_status);

-- Compound: lookup pending requests for a specific attendance record (badge indicator)
CREATE INDEX IF NOT EXISTS idx_attendance_edit_requests_attendance_id
  ON public.attendance_edit_requests(daily_attendance_id, request_status);

-- -------------------------------------------------------------------------
-- STEP 5: Auto-update updated_at trigger
-- -------------------------------------------------------------------------

-- Reuse the existing trigger function if it exists, or create a simple one
CREATE OR REPLACE FUNCTION public.update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_daily_attendances_updated_at
  BEFORE UPDATE ON public.daily_attendances
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();

CREATE OR REPLACE TRIGGER trg_attendance_edit_requests_updated_at
  BEFORE UPDATE ON public.attendance_edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_attendance_updated_at();

-- -------------------------------------------------------------------------
-- STEP 6: PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
