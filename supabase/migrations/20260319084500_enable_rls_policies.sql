-- ==========================================
-- ENABLE RLS FOR CLIENT AND HISTORY TABLES
-- ==========================================

-- 1. Helper Function to get permission level for a vertical
-- Use security definer to allow checking user_profiles which might have its own RLS
CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text AS $$
DECLARE
    v_role_id text;
    v_vertical_perms jsonb;
    v_level text;
BEGIN
    -- Fetch the profile for the current authenticated user
    SELECT role_id, vertical_permissions INTO v_role_id, v_vertical_perms
    FROM public.user_profiles
    WHERE id = auth.uid();

    -- Check Master roles first
    IF v_role_id = 'master_admin' THEN RETURN 'admin'; END IF;
    IF v_role_id = 'master_editor' THEN RETURN 'editor'; END IF;
    IF v_role_id = 'master_contributor' THEN RETURN 'contributor'; END IF;
    IF v_role_id = 'master_viewer' THEN RETURN 'viewer'; END IF;

    -- Check Vertical roles
    -- If role_id starts with 'vertical_', check the specific vertical_permissions object
    IF v_role_id LIKE 'vertical_%' THEN
        v_level := v_vertical_perms->>v_id;
        IF v_level IS NOT NULL THEN
            RETURN v_level;
        END IF;
    END IF;

    -- Default fallback
    RETURN 'viewer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. ENABLE RLS FOR TABLES
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;

-- Handle plural/singular naming for billing models
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_billing_models') THEN
        ALTER TABLE public.client_billing_models ENABLE ROW LEVEL SECURITY;
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_billing_model') THEN
        ALTER TABLE public.client_billing_model ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;


-- 3. DEFINE POLICIES

-- ==========================================
-- CLIENTS VERTICAL TABLES
-- ==========================================
-- TABLES: clients, client_categories, client_billing_models

DO $$
DECLARE
    t text;
    tables_to_policy text[] := ARRAY['clients', 'client_categories', 'client_billing_models', 'client_billing_model'];
BEGIN
    FOREACH t IN ARRAY tables_to_policy
    LOOP
        -- Check if table exists before applying
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            
            -- Drop existing policies if any (to avoid conflicts)
            EXECUTE format('DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.%I', t);

            -- SELECT: Viewer, Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit SELECT based on role" ON public.%I FOR SELECT USING (public.get_user_permission_level(''CLIENTS'') IN (''viewer'', ''contributor'', ''editor'', ''admin''))', t);

            -- INSERT: Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit INSERT based on role" ON public.%I FOR INSERT WITH CHECK (public.get_user_permission_level(''CLIENTS'') IN (''contributor'', ''editor'', ''admin''))', t);

            -- UPDATE: Editor, Admin
            EXECUTE format('CREATE POLICY "Permit UPDATE based on role" ON public.%I FOR UPDATE USING (public.get_user_permission_level(''CLIENTS'') IN (''editor'', ''admin'')) WITH CHECK (public.get_user_permission_level(''CLIENTS'') IN (''editor'', ''admin''))', t);

            -- DELETE: Admin ONLY
            EXECUTE format('CREATE POLICY "Permit DELETE based on role" ON public.%I FOR DELETE USING (public.get_user_permission_level(''CLIENTS'') = ''admin'')', t);
            
        END IF;
    END LOOP;
END $$;


-- ==========================================
-- EMPLOYEES VERTICAL TABLES
-- ==========================================
-- TABLE: employee_history (Restricted: No UD for any role)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.employee_history;
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.employee_history;
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.employee_history;
DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.employee_history;

-- SELECT: All roles
CREATE POLICY "Permit SELECT based on role" ON public.employee_history 
FOR SELECT USING (public.get_user_permission_level('EMPLOYEES') IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor, Editor, Admin (Audit logs are created during actions)
CREATE POLICY "Permit INSERT based on role" ON public.employee_history 
FOR INSERT WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('contributor', 'editor', 'admin'));

-- UPDATE: DISABLED (No policy = denied)
-- DELETE: DISABLED (No policy = denied)


-- ==========================================
-- TEST QUERY (Optional: Use to verify)
-- ==========================================
-- SELECT public.get_user_permission_level('CLIENTS');
