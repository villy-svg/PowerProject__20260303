-- ============================================================
-- STAGING RESET SCRIPT
-- Run this in the Supabase SQL Editor on your STAGING project
-- (eeoibqxhfkrgbylnluvk) ONLY. NEVER on Production.
-- This drops all public schema objects so that db push
-- can apply all 33 migrations cleanly from scratch.
-- ============================================================

-- 1. Drop all RLS policies on all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 2. Drop all tables in public schema (CASCADE handles FK dependencies)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
END $$;

-- 3. Drop all functions in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.proname, r.args);
    END LOOP;
END $$;

-- 4. Drop all sequences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public'
    LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequence_name);
    END LOOP;
END $$;

-- 5. Drop all types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 6. Clear the migration history so db push starts fresh
DELETE FROM supabase_migrations.schema_migrations;

SELECT 'Staging database reset complete. Run: npx supabase db push' AS status;
