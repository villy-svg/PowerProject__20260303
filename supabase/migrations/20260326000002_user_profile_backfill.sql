-- MIGRATION: 20260326000002_user_profile_backfill.sql
-- PURPOSE: Ensure all existing and future auth.users have a corresponding public profile.
-- Mirroring handle_new_user trigger logic for existing historical data.

DO $$
BEGIN
    -- BACKFILL: Ensure every auth.user has a profile (Safety for existing test users)
    INSERT INTO public.user_profiles (id, email, name)
    SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
    FROM auth.users
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'SUCCESS: User profile backfill completed.';
END $$;
