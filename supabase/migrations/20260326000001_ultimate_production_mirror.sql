-- =========================================================================
-- POWERPROJECT ABSOLUTE TOTAL UNIFIED MASTER MIGRATION (v2)
-- 100% Production Mirror - Synthesized from Prod Dump & Manual Log
-- Date: 2026-03-25
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. SECURITY & HELPER FUNCTIONS
-- -------------------------------------------------------------------------

-- 0A. Trigger for updated_at column
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 0B. RBAC Helper: Get user permission level for a vertical
-- (Using the most recent version from manual log)
CREATE OR REPLACE FUNCTION public.get_user_permission_level(v_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role_id text;
    v_level text;
BEGIN
    SELECT role_id INTO v_role_id
    FROM public.user_profiles
    WHERE id = auth.uid();

    -- Master Admin overrides
    IF v_role_id = 'master_admin' THEN RETURN 'admin';
    ELSIF v_role_id = 'master_editor' THEN RETURN 'editor';
    ELSIF v_role_id = 'master_contributor' THEN RETURN 'contributor';
    ELSIF v_role_id = 'master_viewer' THEN RETURN 'viewer';
    END IF;

    -- Look up specific vertical access (Normalized Table)
    SELECT access_level INTO v_level
    FROM public.vertical_access
    WHERE user_id = auth.uid() AND vertical_id = v_id;
    
    RETURN COALESCE(v_level, 'viewer');
END;
$$;

-- 0C. Simple role checks
CREATE OR REPLACE FUNCTION is_master_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id = 'master_admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_elevated_role() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id IN ('master_admin', 'vertical_admin'));
$$ LANGUAGE sql SECURITY DEFINER;

-- 0D. TRIGGER: Auth -> profile sync
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

-- Cleanup existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- -------------------------------------------------------------------------
-- 1. BASE TABLES (IDEMPOTENT)
-- -------------------------------------------------------------------------

-- Core Profile
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  name text,
  role_id text DEFAULT 'vertical_viewer'::text,
  assigned_verticals text[] DEFAULT '{}'::text[],
  vertical_permissions jsonb DEFAULT '{}'::jsonb,
  employee_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT now()
);

-- Organization Infra
CREATE TABLE IF NOT EXISTS public.hubs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  city text,
  status text DEFAULT 'active'::text,
  hub_code text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  dept_code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  role_code text UNIQUE,
  seniority_level integer DEFAULT 1,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hub_functions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  function_code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Client Vertical Infra
CREATE TABLE IF NOT EXISTS public.client_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_billing_models (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  code text UNIQUE,
  default_service_code text REFERENCES public.client_services(code),
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 2. DEPENDENT DATA TABLES
-- -------------------------------------------------------------------------

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  gender text,
  dob date,
  hire_date date DEFAULT CURRENT_DATE,
  hub_id uuid REFERENCES public.hubs(id),
  department_id uuid REFERENCES public.departments(id),
  role_id uuid REFERENCES public.employee_roles(id),
  manager_id uuid REFERENCES public.employees(id),
  emp_code character varying UNIQUE,
  badge_id character varying,
  status text DEFAULT 'Active'::text,
  pan_number character varying,
  account_number text,
  ifsc_code text,
  account_name text,
  department text, -- Legacy/Support column
  role text,       -- Legacy/Support column
  doj date,        -- Legacy/Support column
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Employee History (Audit)
CREATE TABLE IF NOT EXISTS public.employee_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  gender text,
  dob date,
  hub_id uuid,
  role_id uuid,
  department_id uuid,
  emp_code character varying,
  badge_id character varying,
  status text,
  hire_date date,
  account_number text,
  ifsc_code text,
  account_name text,
  pan_number character varying,
  changed_by text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  change_type text NOT NULL
);

-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category_id uuid REFERENCES public.client_categories(id),
  billing_model_id uuid REFERENCES public.client_billing_models(id),
  poc_name text,
  poc_phone text,
  poc_email text,
  status text DEFAULT 'Active'::text,
  category_matrix jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Core Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  verticalid text NOT NULL,
  stageid text NOT NULL,
  priority text DEFAULT 'Medium',
  description text,
  hub_id uuid REFERENCES public.hubs(id),
  city text,
  function text,
  assigned_to uuid REFERENCES public.employees(id),
  parent_task uuid REFERENCES public.tasks(id),
  user_id uuid DEFAULT auth.uid(),
  created_by uuid REFERENCES public.user_profiles(id),
  last_updated_by uuid REFERENCES public.user_profiles(id),
  createdat timestamp with time zone DEFAULT now(),
  updatedat timestamp with time zone DEFAULT now()
);

-- Daily Tasks module
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  description text,
  priority text DEFAULT 'Medium',
  stage_id text DEFAULT 'BACKLOG',
  vertical_id text NOT NULL,
  hub_id uuid REFERENCES public.hubs(id),
  client_id uuid REFERENCES public.clients(id),
  employee_id uuid REFERENCES public.employees(id),
  assigned_to uuid REFERENCES public.employees(id),
  city text,
  function_name text,
  scheduled_date date DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_updated_by uuid REFERENCES auth.users(id),
  submission_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.daily_task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  vertical_id text NOT NULL DEFAULT 'CHARGING_HUBS'::text,
  hub_id uuid REFERENCES public.hubs(id),
  client_id uuid REFERENCES public.clients(id),
  employee_id uuid REFERENCES public.employees(id),
  assigned_to uuid REFERENCES public.employees(id),
  city text,
  function_name text,
  frequency text NOT NULL DEFAULT 'DAILY'::text,
  frequency_details jsonb,
  time_of_day time without time zone DEFAULT '08:00:00'::time without time zone,
  is_active boolean DEFAULT true,
  upload_link text,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  last_updated_by uuid REFERENCES auth.users(id)
);

-- RBAC Tables (Normalized)
CREATE TABLE IF NOT EXISTS public.vertical_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vertical_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, vertical_id)
);

CREATE TABLE IF NOT EXISTS public.feature_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  vertical_id text NOT NULL,
  feature_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, vertical_id, feature_id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id text NOT NULL PRIMARY KEY,
  permissions jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 3. REPAIR BLOCKS & TRIGGERS (Automated Schema Healing)
-- -------------------------------------------------------------------------

DO $$ 
BEGIN 
    -- Profiles Repairs
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS role_id TEXT DEFAULT 'vertical_viewer';
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS vertical_permissions JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS employee_id UUID;

    -- Employees Repairs
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_number character varying;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS manager_id UUID;
    ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

    -- Daily Tasks Repairs
    ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS vertical_id TEXT;
    UPDATE public.daily_tasks SET vertical_id = 'CHARGING_HUBS' WHERE vertical_id IS NULL;

    -- Triggers
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_daily_tasks_modtime') THEN
        CREATE TRIGGER update_daily_tasks_modtime BEFORE UPDATE ON public.daily_tasks
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;

    -- Indices
    CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON public.user_profiles(employee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
END $$;

-- -------------------------------------------------------------------------
-- 4. SEED DATA (RBAC & NAVIGATION)
-- -------------------------------------------------------------------------

-- 4A. Role Permissions Seed (from manual log line 865)
INSERT INTO public.role_permissions (role_id, permissions) VALUES
('master_admin', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true, "canAccessConfig": true, "canManageRoles": true, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_editor', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_contributor', '{"canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_viewer', '{"canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false, "canAccessEmployees": true, "canAccessEmployeeTasks": false, "canAccessHubTasks": true}'),
('vertical_admin', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true, "canAccessConfig": true, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_editor', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_contributor', '{"canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_viewer', '{"canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false, "canAccessEmployees": true, "canAccessEmployeeTasks": false, "canAccessHubTasks": true}')
ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- 4B. Verticals Seed
INSERT INTO public.verticals (id, label, "order", locked) VALUES 
('CHARGING_HUBS', 'Hub Manager', 1, false),
('CLIENTS', 'Client Manager', 2, false),
('EMPLOYEES', 'Employee Manager', 3, false),
('PARTNERS', 'Partner Manager', 4, true),
('VENDORS', 'Vendor Manager', 5, true),
('DATA_MANAGER', 'Data Manager', 6, true)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

-- -------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------

-- Enable RLS for ALL tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_billing_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vertical_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 5A. Hubs & Departments (Simple Select)
DROP POLICY IF EXISTS "Allow select for auth" ON public.hubs;
CREATE POLICY "Allow select for auth" ON public.hubs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Hubs managed by master_admin" ON public.hubs;
CREATE POLICY "Hubs managed by master_admin" ON public.hubs FOR ALL USING (is_master_admin());

-- 5B. Dynamic Vertical-Based Policies
DO $$
DECLARE
    t text;
    emp_tables text[] := ARRAY['employees', 'employee_roles', 'departments', 'employee_history'];
    client_tables text[] := ARRAY['clients', 'client_categories', 'client_billing_models', 'client_services'];
    hub_tables text[] := ARRAY['hubs', 'hub_functions'];
BEGIN
    FOREACH t IN ARRAY emp_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Permit SELECT based on role" ON public.%I FOR SELECT USING (public.get_user_permission_level(''EMPLOYEES'') IN (''viewer'', ''contributor'', ''editor'', ''admin''))', t);
            IF t != 'employee_history' THEN
               EXECUTE format('DROP POLICY IF EXISTS "Permit ALL based on role" ON public.%I', t);
               EXECUTE format('CREATE POLICY "Permit ALL based on role" ON public.%I FOR ALL USING (public.get_user_permission_level(''EMPLOYEES'') IN (''contributor'', ''editor'', ''admin''))', t);
            END IF;
        END IF;
    END LOOP;

    FOREACH t IN ARRAY client_tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format('DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Permit SELECT based on role" ON public.%I FOR SELECT USING (public.get_user_permission_level(''CLIENTS'') IN (''viewer'', ''contributor'', ''editor'', ''admin''))', t);
            EXECUTE format('DROP POLICY IF EXISTS "Permit ALL based on role" ON public.%I', t);
            EXECUTE format('CREATE POLICY "Permit ALL based on role" ON public.%I FOR ALL USING (public.get_user_permission_level(''CLIENTS'') IN (''contributor'', ''editor'', ''admin''))', t);
        END IF;
    END LOOP;
END $$;

-- 5C. Tasks & Daily Tasks (Row-based Vertical Access)
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.tasks;
CREATE POLICY "Permit SELECT based on role" ON public.tasks FOR SELECT USING (public.get_user_permission_level(verticalid) IN ('viewer', 'contributor', 'editor', 'admin'));
DROP POLICY IF EXISTS "Permit ALL based on role" ON public.tasks;
CREATE POLICY "Permit ALL based on role" ON public.tasks FOR ALL USING (public.get_user_permission_level(verticalid) IN ('contributor', 'editor', 'admin'));

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_tasks;
CREATE POLICY "Permit SELECT based on role" ON public.daily_tasks FOR SELECT USING (public.get_user_permission_level(vertical_id) IN ('viewer', 'contributor', 'editor', 'admin'));
DROP POLICY IF EXISTS "Permit ALL based on role" ON public.daily_tasks;
CREATE POLICY "Permit ALL based on role" ON public.daily_tasks FOR ALL USING (public.get_user_permission_level(vertical_id) IN ('contributor', 'editor', 'admin'));

-- -------------------------------------------------------------------------
-- 6. DATA CONSOLIDATION LOGIC
-- -------------------------------------------------------------------------

DO $$ 
BEGIN 
    -- Link profiles to employees by email
    UPDATE public.user_profiles up SET employee_id = e.id FROM public.employees e WHERE LOWER(up.email) = LOWER(e.email) AND up.employee_id IS NULL;
    
    -- Final Success Notice
    RAISE NOTICE 'SUCCESS: PowerProject Absolute Master Schema Established Successfully.';
END $$;
