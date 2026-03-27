-- MIGRATION: 20260326000003_user_profile_rls.sql
-- PURPOSE: Grant required RLS access for users to their own profiles.
-- NOTE: INSERT is intentionally omitted here — profile creation is handled exclusively
--       by the handle_new_user() SECURITY DEFINER trigger, which bypasses RLS.

-- 1. Selection (Required for login to load user data)
DROP POLICY IF EXISTS "Users can see their own profile" ON public.user_profiles;
CREATE POLICY "Users can see their own profile" ON public.user_profiles
FOR SELECT USING (auth.uid() = id);

-- 2. Update (Required for profile edits — employee_id link fallback, name changes, etc.)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id);

-- 3. Master Admin full access (uses SECURITY DEFINER function to avoid RLS recursion)
DROP POLICY IF EXISTS "Master admin full access on profiles" ON public.user_profiles;
CREATE POLICY "Master admin full access on profiles" ON public.user_profiles
FOR ALL USING (public.is_master_admin());

-- 4. Insert policy for trigger (service_role only — no direct user inserts)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

DO $$ BEGIN RAISE NOTICE 'SUCCESS: user_profiles RLS policies hardened.'; END $$;
