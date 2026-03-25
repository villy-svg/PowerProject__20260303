-- =========================================================================
-- POWERPROJECT UNIFIED MASTER MIGRATION (Synthesized from Manual SQL LOG)
-- Canonical location: 20260301000000_core_tasks_schema.sql
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. BASE SECURITY FUNCTIONS & PROFILES
-- -------------------------------------------------------------------------

-- PROFILE Table: Core users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    role_id TEXT DEFAULT 'vertical_viewer',
    assigned_verticals TEXT[] DEFAULT '{}',
    vertical_permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    employee_id UUID -- References employees(id) (Added late)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RBAC HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role_id = 'master_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_elevated_role()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND role_id IN ('master_admin', 'vertical_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_global_reader() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role_id IN ('master_admin', 'master_viewer')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master Permission Check (Used across all verticals)
CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text AS $$
DECLARE
    v_role_id text;
    v_vertical_perms jsonb;
    v_level text;
BEGIN
    SELECT role_id, vertical_permissions INTO v_role_id, v_vertical_perms
    FROM public.user_profiles WHERE id = auth.uid();

    IF v_role_id = 'master_admin' THEN RETURN 'admin'; END IF;
    IF v_role_id = 'master_editor' THEN RETURN 'editor'; END IF;
    IF v_role_id = 'master_contributor' THEN RETURN 'contributor'; END IF;
    IF v_role_id = 'master_viewer' THEN RETURN 'viewer'; END IF;

    IF v_role_id LIKE 'vertical_%' THEN
        v_level := v_vertical_perms->>v_id;
        IF v_level IS NOT NULL THEN RETURN v_level; END IF;
    END IF;
    RETURN 'viewer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: Auth -> profile sync
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, name, assigned_verticals)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 
        ARRAY[]::TEXT[]
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- -------------------------------------------------------------------------
-- 2. CORE INFRASTRUCTURE TABLES (NO DEPENDENCIES)
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.hubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    hub_code TEXT UNIQUE,
    city TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    dept_code TEXT UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employee_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    role_code TEXT UNIQUE,
    seniority_level INTEGER DEFAULT 1,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hub_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    function_code TEXT UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.verticals (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    locked BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 3. DEPENDENT DATA TABLES
-- -------------------------------------------------------------------------

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT,
    gender TEXT,
    dob DATE,
    hire_date DATE DEFAULT CURRENT_DATE,
    hub_id UUID REFERENCES public.hubs(id),
    department_id UUID REFERENCES public.departments(id),
    role_id UUID REFERENCES public.employee_roles(id),
    manager_id UUID REFERENCES public.employees(id),
    emp_code VARCHAR(10) UNIQUE,
    badge_id VARCHAR(20),
    status TEXT DEFAULT 'Active',
    pan_number TEXT,
    account_number TEXT,
    ifsc_code TEXT,
    account_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update profiles with employee link backfill
ALTER TABLE public.user_profiles 
  ADD CONSTRAINT fk_user_profile_employee 
  FOREIGN KEY (employee_id) REFERENCES public.employees(id);

-- TASKS (The Master Task Table)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Medium',
    verticalid TEXT DEFAULT 'CHARGING_HUBS',
    stageid TEXT DEFAULT 'BACKLOG',
    hub_id UUID REFERENCES public.hubs(id),
    city TEXT,
    function TEXT,
    assigned_to UUID REFERENCES public.employees(id),
    parent_task UUID REFERENCES public.tasks(id),
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    created_by UUID REFERENCES public.user_profiles(id),
    last_updated_by UUID REFERENCES public.user_profiles(id),
    createdat TIMESTAMPTZ DEFAULT NOW(),
    updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 4. SECURITY & POLICIES (Consolidated)
-- -------------------------------------------------------------------------

-- Hubs RLS
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for auth" ON public.hubs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Hubs managed by master_admin" ON public.hubs FOR ALL USING (is_master_admin());

-- Departments RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select for auth" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Departments managed by master_admin" ON public.departments FOR ALL USING (is_master_admin());

-- Tasks RLS (Dynamic)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permit SELECT based on role" ON public.tasks 
FOR SELECT USING (
  is_master_admin() 
  OR is_global_reader()
  OR (user_id = auth.uid())
  OR (public.get_user_permission_level(verticalid) IN ('viewer', 'contributor', 'editor', 'admin'))
);
CREATE POLICY "Permit INSERT based on role" ON public.tasks 
FOR INSERT WITH CHECK (public.get_user_permission_level(verticalid) IN ('contributor', 'editor', 'admin'));
CREATE POLICY "Permit UPDATE based on role" ON public.tasks 
FOR UPDATE USING (public.get_user_permission_level(verticalid) IN ('editor', 'admin'));
CREATE POLICY "Permit DELETE based on role" ON public.tasks 
FOR DELETE USING (public.get_user_permission_level(verticalid) = 'admin');

-- -------------------------------------------------------------------------
-- 5. SEED DATA
-- -------------------------------------------------------------------------

INSERT INTO public.verticals (id, label, "order", locked)
VALUES 
    ('CHARGING_HUBS', 'Hub Manager', 1, false),
    ('CLIENTS', 'Client Manager', 2, false),
    ('EMPLOYEES', 'Employee Manager', 3, false),
    ('PARTNERS', 'Partner Manager', 4, true),
    ('VENDORS', 'Vendor Manager', 5, true),
    ('DATA_MANAGER', 'Data Manager', 6, true)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

INSERT INTO public.hub_functions (name, function_code) VALUES
    ('Operations', 'OPS'), ('Maintenance', 'MAINT'), ('Customer Service', 'CS')
ON CONFLICT (function_code) DO NOTHING;

RAISE NOTICE 'SUCCESS: Unified Master Schema established Successfully.';
