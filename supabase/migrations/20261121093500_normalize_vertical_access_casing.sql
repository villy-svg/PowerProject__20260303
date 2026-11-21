-- =========================================================================
-- POWERPROJECT: Normalize vertical_access.vertical_id Casing & Harden RBAC
--
-- Scope:
--   1. Idempotently merge & normalize all lowercase/mixed-case vertical_id
--      rows in public.vertical_access to UPPER(TRIM(vertical_id)).
--      If a user has both a lowercase and an uppercase row for the same
--      vertical, preserve the MOST RECENTLY UPDATED row's access_level
--      (tie-broken in favor of the existing uppercase row) so a previously
--      downgraded user is never silently re-escalated.
--   2. Add BEFORE INSERT OR UPDATE trigger on public.vertical_access to
--      auto-normalize vertical_id to UPPER(TRIM(vertical_id)), preventing
--      future drift without breaking older APK bundles.
--   3. Update public.get_user_permission_level(v_id text) to match
--      vertical_id = UPPER(TRIM(v_id)) — both 100% case-insensitive AND
--      fully index-backed on UNIQUE(user_id, vertical_id) — while preserving
--      SECURITY DEFINER STABLE and adding SET search_path = public, pg_catalog.
--   4. Reload PostgREST schema cache.
--
-- Backward Compatibility:
--   - 100% safe for older APKs and all existing RPCs/RLS policies regardless
--     of whether callers pass 'employees' or 'EMPLOYEES'.
--   - Zero frontend or APK changes required.
-- =========================================================================

-- -------------------------------------------------------------------------
-- SECTION 1: Idempotent Data Normalization on public.vertical_access
-- -------------------------------------------------------------------------

-- Step 1A: If a user has BOTH a non-uppercase row AND an uppercase row for
-- the same vertical, adopt the non-uppercase row's access_level ONLY when
-- it is strictly newer than the uppercase row (never re-escalating stale rows).
WITH newest_lower AS (
  SELECT DISTINCT ON (va_upper.id)
    va_upper.id           AS upper_id,
    va_lower.access_level AS newer_level,
    COALESCE(va_lower.updated_at, va_lower.created_at) AS lower_ts
  FROM public.vertical_access va_lower
  JOIN public.vertical_access va_upper
    ON va_upper.user_id = va_lower.user_id
   AND va_upper.vertical_id = UPPER(TRIM(va_lower.vertical_id))
  WHERE va_lower.vertical_id <> UPPER(TRIM(va_lower.vertical_id))
    AND COALESCE(va_lower.updated_at, va_lower.created_at)
      > COALESCE(va_upper.updated_at, va_upper.created_at)
  ORDER BY
    va_upper.id,
    COALESCE(va_lower.updated_at, va_lower.created_at) DESC NULLS LAST,
    va_lower.id ASC
)
UPDATE public.vertical_access va
SET
  access_level = nl.newer_level,
  updated_at   = now()
FROM newest_lower nl
WHERE va.id = nl.upper_id
  AND va.access_level IS DISTINCT FROM nl.newer_level;

-- Step 1B: Delete non-uppercase rows that now have an uppercase counterpart.
DELETE FROM public.vertical_access va_lower
USING public.vertical_access va_upper
WHERE va_upper.user_id = va_lower.user_id
  AND va_upper.vertical_id = UPPER(TRIM(va_lower.vertical_id))
  AND va_lower.vertical_id <> UPPER(TRIM(va_lower.vertical_id));

-- Step 1C: If a user had multiple distinct non-uppercase spellings
-- (e.g. 'employees' and 'Employees') with no uppercase row yet, keep only
-- the most recently updated row per (user_id, UPPER(TRIM(vertical_id))).
WITH dedup AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, UPPER(TRIM(vertical_id))
      ORDER BY
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        id ASC
    ) AS rn
  FROM public.vertical_access
  WHERE vertical_id <> UPPER(TRIM(vertical_id))
)
DELETE FROM public.vertical_access va
USING dedup d
WHERE va.id = d.id
  AND d.rn > 1;

-- Step 1D: Normalize all remaining non-uppercase rows in place.
UPDATE public.vertical_access
SET
  vertical_id = UPPER(TRIM(vertical_id)),
  updated_at  = now()
WHERE vertical_id <> UPPER(TRIM(vertical_id));

-- -------------------------------------------------------------------------
-- SECTION 2: Auto-Normalize Future Writes (Old-APK Safe Trigger)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.func_vertical_access_normalize_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.vertical_id IS NOT NULL THEN
    NEW.vertical_id := UPPER(TRIM(NEW.vertical_id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vertical_access_normalize_id ON public.vertical_access;

CREATE TRIGGER trg_vertical_access_normalize_id
  BEFORE INSERT OR UPDATE OF vertical_id
  ON public.vertical_access
  FOR EACH ROW
  EXECUTE FUNCTION public.func_vertical_access_normalize_id();

-- -------------------------------------------------------------------------
-- SECTION 3: Make get_user_permission_level Case-Insensitive & Index-Backed
-- Because Section 1 + Section 2 guarantee vertical_access.vertical_id is
-- always UPPER(TRIM(...)), matching `vertical_id = UPPER(TRIM(v_id))` uses
-- the UNIQUE(user_id, vertical_id) B-tree index directly on every RLS check.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role_id text;
  v_level   text;
BEGIN
  SELECT role_id INTO v_role_id
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF v_role_id = 'master_admin' THEN RETURN 'admin';
  ELSIF v_role_id = 'master_editor' THEN RETURN 'editor';
  ELSIF v_role_id = 'master_contributor' THEN RETURN 'contributor';
  ELSIF v_role_id = 'master_viewer' THEN RETURN 'viewer';
  END IF;

  SELECT access_level INTO v_level
  FROM public.vertical_access
  WHERE user_id = auth.uid()
    AND vertical_id = UPPER(TRIM(v_id));

  RETURN COALESCE(v_level, 'viewer');
END;
$$;

-- -------------------------------------------------------------------------
-- SECTION 4: Reload PostgREST Schema Cache (Mandatory)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
