-- =========================================================================
-- POWERPROJECT: Default new users to inactive
-- Migration: 20260528170000_default_users_inactive.sql
-- =========================================================================

-- 1. Alter the default of is_active column on public.user_profiles to false.
--    This ensures that any newly created profile (e.g. from handle_new_user trigger)
--    is set to inactive by default unless explicitly specified otherwise.
ALTER TABLE public.user_profiles
    ALTER COLUMN is_active SET DEFAULT false;

-- 2. Evolution Ledger entry
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260528170000_default_users_inactive',
  'Alters column default of public.user_profiles.is_active to false so that newly registered users are inactive by default.',
  ARRAY['user_profiles']
)
ON CONFLICT DO NOTHING;

-- 3. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
