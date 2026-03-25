-- MIGRATION: 20260326000003_user_profile_rls.sql
-- PURPOSE: Grant required RLS access for users to their own profiles.

-- 1. Selection (Required for login)
DROP POLICY IF EXISTS "Users can see their own profile" ON public.user_profiles;
CREATE POLICY "Users can see their own profile" ON public.user_profiles 
FOR SELECT USING (auth.uid() = id);

-- 2. Update (Required for setting employee_id, etc.)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles 
FOR UPDATE USING (auth.uid() = id);

-- 3. Insert (Required for the frontend auto-healing logic)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles 
FOR INSERT WITH CHECK (auth.uid() = id);

DO $$ BEGIN RAISE NOTICE 'SUCCESS: user_profiles RLS policies established.'; END $$;
