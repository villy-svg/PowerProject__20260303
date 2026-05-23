-- =========================================================================
-- POWERPROJECT: Fix User Profiles RLS Infinite Recursion
-- Migration: 20260523170000_fix_user_profiles_rls_recursion.sql
-- ─────────────────────────────────────────────────────────────────────────
-- This migration resolves the infinite recursion error in the row-level
-- security (RLS) policies on user_profiles.
--
-- Why recursion occurs:
--   The policy "Block inactive user self-read" executed a SELECT query on
--   public.user_profiles inside its USING clause, causing PostgreSQL to
--   recurse endlessly evaluating RLS on the inner query.
--
-- Solution:
--   We define a SECURITY DEFINER helper function `public.is_active_user()`
--   that queries the current user's profile active state bypassing RLS.
--   We then update all dependent RLS policies to use this function.
-- =========================================================================

-- 1. Create a security definer helper function to fetch active status bypassing RLS.
--    This function declares SET search_path = public to avoid injection vectors.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_active FROM public.user_profiles WHERE id = auth.uid()),
    false
  );
$$;

-- 2. Drop and recreate the RLS policy on public.user_profiles using the helper.
DROP POLICY IF EXISTS "Block inactive user self-read" ON public.user_profiles;
CREATE POLICY "Block inactive user self-read" ON public.user_profiles
    FOR SELECT
    USING (
        public.is_master_admin()
        OR
        public.is_active_user()
        OR
        (auth.uid() = id)
    );

-- 3. Drop and recreate the RLS policy on public.tasks using the helper.
--    This ensures optimal performance and consistency for task queries.
DROP POLICY IF EXISTS "Block inactive users on tasks" ON public.tasks;
CREATE POLICY "Block inactive users on tasks" ON public.tasks
    FOR ALL
    USING (
        public.is_active_user()
    );

-- 4. Evolution Ledger Log
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260523170000_fix_user_profiles_rls_recursion',
  'Fix infinite recursion in user_profiles RLS policies: (1) Added public.is_active_user() SECURITY DEFINER function to bypass RLS checks; (2) Updated RLS policies on user_profiles and tasks to use is_active_user() helper.',
  ARRAY['user_profiles', 'tasks']
)
ON CONFLICT DO NOTHING;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
