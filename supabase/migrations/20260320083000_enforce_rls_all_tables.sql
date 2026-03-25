/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- ==========================================
-- ENABLE RLS FOR ALL REMAINING TABLES
-- ==========================================

-- 1. Enable RLS
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hub_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tasks ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to avoid conflicts
DO $$
DECLARE
    t text;
    tables_to_policy text[] := ARRAY['employees', 'employee_roles', 'departments', 'hubs', 'hub_functions', 'tasks'];
BEGIN
    FOREACH t IN ARRAY tables_to_policy
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.%I', t);
        END IF;
    END LOOP;
END $$;


-- 3. Define Policies for EMPLOYEES vertical
-- TABLES: employees, employee_roles, departments

DO $$
DECLARE
    t text;
    tables_to_policy text[] := ARRAY['employees', 'employee_roles', 'departments'];
BEGIN
    FOREACH t IN ARRAY tables_to_policy
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- SELECT: Viewer, Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit SELECT based on role" ON public.%I FOR SELECT USING (public.get_user_permission_level(''EMPLOYEES'') IN (''viewer'', ''contributor'', ''editor'', ''admin''))', t);

            -- INSERT: Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit INSERT based on role" ON public.%I FOR INSERT WITH CHECK (public.get_user_permission_level(''EMPLOYEES'') IN (''contributor'', ''editor'', ''admin''))', t);

            -- UPDATE: Editor, Admin
            EXECUTE format('CREATE POLICY "Permit UPDATE based on role" ON public.%I FOR UPDATE USING (public.get_user_permission_level(''EMPLOYEES'') IN (''editor'', ''admin'')) WITH CHECK (public.get_user_permission_level(''EMPLOYEES'') IN (''editor'', ''admin''))', t);

            -- DELETE: Admin ONLY
            EXECUTE format('CREATE POLICY "Permit DELETE based on role" ON public.%I FOR DELETE USING (public.get_user_permission_level(''EMPLOYEES'') = ''admin'')', t);
        END IF;
    END LOOP;
END $$;


-- 4. Define Policies for CHARGING_HUBS vertical
-- TABLES: hubs, hub_functions

DO $$
DECLARE
    t text;
    tables_to_policy text[] := ARRAY['hubs', 'hub_functions'];
BEGIN
    FOREACH t IN ARRAY tables_to_policy
    LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- SELECT: Viewer, Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit SELECT based on role" ON public.%I FOR SELECT USING (public.get_user_permission_level(''CHARGING_HUBS'') IN (''viewer'', ''contributor'', ''editor'', ''admin''))', t);

            -- INSERT: Contributor, Editor, Admin
            EXECUTE format('CREATE POLICY "Permit INSERT based on role" ON public.%I FOR INSERT WITH CHECK (public.get_user_permission_level(''CHARGING_HUBS'') IN (''contributor'', ''editor'', ''admin''))', t);

            -- UPDATE: Editor, Admin
            EXECUTE format('CREATE POLICY "Permit UPDATE based on role" ON public.%I FOR UPDATE USING (public.get_user_permission_level(''CHARGING_HUBS'') IN (''editor'', ''admin'')) WITH CHECK (public.get_user_permission_level(''CHARGING_HUBS'') IN (''editor'', ''admin''))', t);

            -- DELETE: Admin ONLY
            EXECUTE format('CREATE POLICY "Permit DELETE based on role" ON public.%I FOR DELETE USING (public.get_user_permission_level(''CHARGING_HUBS'') = ''admin'')', t);
        END IF;
    END LOOP;
END $$;


-- 5. Define Policies for TASKS table (Dynamic Vertical)
-- The 'verticalid' column contains the vertical name (e.g., 'CHARGING_HUBS', 'EMPLOYEES', 'CLIENTS')

-- SELECT: Viewer, Contributor, Editor, Admin
CREATE POLICY "Permit SELECT based on role" ON public.tasks 
FOR SELECT USING (public.get_user_permission_level(verticalid) IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor, Editor, Admin
CREATE POLICY "Permit INSERT based on role" ON public.tasks 
FOR INSERT WITH CHECK (public.get_user_permission_level(verticalid) IN ('contributor', 'editor', 'admin'));

-- UPDATE: Editor, Admin
CREATE POLICY "Permit UPDATE based on role" ON public.tasks 
FOR UPDATE USING (public.get_user_permission_level(verticalid) IN ('editor', 'admin'))
WITH CHECK (public.get_user_permission_level(verticalid) IN ('editor', 'admin'));

-- DELETE: Admin ONLY
CREATE POLICY "Permit DELETE based on role" ON public.tasks 
FOR DELETE USING (public.get_user_permission_level(verticalid) = 'admin');

 */
