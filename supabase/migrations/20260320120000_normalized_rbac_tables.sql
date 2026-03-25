/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Migration: Normalized RBAC Tables
-- Description: Creates vertical_access and feature_access tables and migrates data out of user_profiles JSONB.

-- 1. Create vertical_access table
CREATE TABLE IF NOT EXISTS public.vertical_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    vertical_id text NOT NULL,
    access_level text NOT NULL DEFAULT 'viewer',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, vertical_id)
);

-- 2. Create feature_access table
CREATE TABLE IF NOT EXISTS public.feature_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    vertical_id text NOT NULL,
    feature_id text NOT NULL,
    access_level text NOT NULL DEFAULT 'viewer',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, vertical_id, feature_id)
);

-- 3. Enable RLS
ALTER TABLE public.vertical_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.vertical_access;
CREATE POLICY "Permit SELECT for all users" ON public.vertical_access
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.vertical_access;
CREATE POLICY "Permit ALL for master_admin" ON public.vertical_access
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id = 'master_admin')
);

DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.feature_access;
CREATE POLICY "Permit SELECT for all users" ON public.feature_access
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.feature_access;
CREATE POLICY "Permit ALL for master_admin" ON public.feature_access
FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id = 'master_admin')
);

-- 5. Data Migration (Copy from user_profiles to new tables)
DO $$
DECLARE
    r RECORD;
    v_id text;
    v_level_data jsonb;
    v_feature_id text;
    v_feature_level text;
BEGIN
    FOR r IN SELECT id, vertical_permissions FROM public.user_profiles WHERE vertical_permissions IS NOT NULL LOOP
        FOR v_id, v_level_data IN SELECT * FROM jsonb_each(r.vertical_permissions) LOOP
            -- Insert Vertical Access
            INSERT INTO public.vertical_access (user_id, vertical_id, access_level)
            VALUES (r.id, v_id, COALESCE(v_level_data->>'level', v_level_data#>>'{}'))
            ON CONFLICT (user_id, vertical_id) DO UPDATE SET access_level = EXCLUDED.access_level;

            -- Insert Feature Access (if it's an object with features)
            IF jsonb_typeof(v_level_data) = 'object' AND v_level_data ? 'features' THEN
                FOR v_feature_id, v_feature_level IN SELECT * FROM jsonb_each_text(v_level_data->'features') LOOP
                    INSERT INTO public.feature_access (user_id, vertical_id, feature_id, access_level)
                    VALUES (r.id, v_id, v_feature_id, v_feature_level)
                    ON CONFLICT (user_id, vertical_id, feature_id) DO UPDATE SET access_level = EXCLUDED.access_level;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- 6. Simplify role_permissions
-- Remove navigation/feature flags from global role templates
UPDATE public.role_permissions
SET permissions = permissions - '{canAccessClients,canAccessClientTasks,canAccessLeadsFunnel,canAccessEmployees,canAccessEmployeeTasks,canAccessHubTasks,canManageRoles}'::text[];

 */
