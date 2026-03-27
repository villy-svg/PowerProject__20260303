-- =========================================================================
-- POWERPROJECT: 1/6 — TABLE DEFINITIONS
-- All tables, idempotent (CREATE TABLE IF NOT EXISTS)
-- =========================================================================

-- 1.1 User Profiles (Auth-linked)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  name text,
  role_id text DEFAULT 'vertical_viewer'::text,
  assigned_verticals text[] DEFAULT '{}'::text[],
  vertical_permissions jsonb DEFAULT '{}'::jsonb,
  employee_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 1.2 Organization Infrastructure
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

-- 1.3 Client Vertical Infrastructure
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
  default_service_code text,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 1.4 Organization Verticals
CREATE TABLE IF NOT EXISTS public.verticals (
  id text NOT NULL PRIMARY KEY,
  label text NOT NULL,
  "order" integer DEFAULT 0,
  locked boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- 1.5 Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  gender text,
  dob date,
  hire_date date DEFAULT CURRENT_DATE,
  hub_id uuid,
  department_id uuid,
  role_id uuid,
  manager_id uuid,
  emp_code character varying UNIQUE,
  badge_id character varying,
  status text DEFAULT 'Active'::text,
  pan_number character varying,
  account_number text,
  ifsc_code text,
  account_name text,
  department text,
  role text,
  doj date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 1.6 Employee History (Audit)
CREATE TABLE IF NOT EXISTS public.employee_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL,
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

-- 1.7 Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  category_id uuid,
  billing_model_id uuid,
  poc_name text,
  poc_phone text,
  poc_email text,
  status text DEFAULT 'Active'::text,
  category_matrix jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 1.8 Core Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  verticalid text NOT NULL,
  stageid text NOT NULL,
  priority text DEFAULT 'Medium',
  description text,
  hub_id uuid,
  city text,
  function text,
  assigned_to uuid,
  parent_task uuid,
  user_id uuid DEFAULT auth.uid(),
  created_by uuid,
  last_updated_by uuid,
  createdat timestamp with time zone DEFAULT now(),
  updatedat timestamp with time zone DEFAULT now()
);

-- 1.9 Daily Tasks
CREATE TABLE IF NOT EXISTS public.daily_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  text text NOT NULL,
  description text,
  priority text DEFAULT 'Medium',
  stage_id text DEFAULT 'BACKLOG',
  vertical_id text NOT NULL,
  hub_id uuid,
  client_id uuid,
  employee_id uuid,
  assigned_to uuid,
  city text,
  function_name text,
  scheduled_date date DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  partner_id uuid,
  vendor_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_updated_by uuid,
  submission_by uuid
);

-- 1.10 Daily Task Templates
CREATE TABLE IF NOT EXISTS public.daily_task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  vertical_id text NOT NULL DEFAULT 'CHARGING_HUBS'::text,
  hub_id uuid,
  client_id uuid,
  employee_id uuid,
  assigned_to uuid,
  city text,
  function_name text,
  frequency text NOT NULL DEFAULT 'DAILY'::text,
  frequency_details jsonb,
  time_of_day time without time zone DEFAULT '08:00:00'::time without time zone,
  is_active boolean DEFAULT true,
  upload_link text,
  last_run_at timestamp with time zone,
  partner_id uuid,
  vendor_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_updated_by uuid
);

-- 1.11 RBAC Tables (Normalized)
CREATE TABLE IF NOT EXISTS public.vertical_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  vertical_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, vertical_id)
);

CREATE TABLE IF NOT EXISTS public.feature_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
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

-- 1.12 Test Table (Connectivity Check)
CREATE SEQUENCE IF NOT EXISTS public.test_table_id_seq;
CREATE TABLE IF NOT EXISTS public.test_table (
  id integer NOT NULL DEFAULT nextval('public.test_table_id_seq'::regclass) PRIMARY KEY,
  message text DEFAULT 'Connection Successful'::text
);
ALTER SEQUENCE public.test_table_id_seq OWNED BY public.test_table.id;

-- 1.13 REPAIR: Ensure all columns from old migrations exist (Safe on re-run)
DO $$
BEGIN
    -- employee_roles.seniority_level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employee_roles' AND column_name='seniority_level') THEN
        ALTER TABLE public.employee_roles ADD COLUMN seniority_level integer DEFAULT 1;
    END IF;

    -- daily_tasks.partner_id / vendor_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='partner_id') THEN
        ALTER TABLE public.daily_tasks ADD COLUMN partner_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='vendor_id') THEN
        ALTER TABLE public.daily_tasks ADD COLUMN vendor_id uuid;
    END IF;

    -- daily_task_templates.partner_id / vendor_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='partner_id') THEN
        ALTER TABLE public.daily_task_templates ADD COLUMN partner_id uuid;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_task_templates' AND column_name='vendor_id') THEN
        ALTER TABLE public.daily_task_templates ADD COLUMN vendor_id uuid;
    END IF;

    -- user_profiles (ensure employee_id exists)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='employee_id') THEN
        ALTER TABLE public.user_profiles ADD COLUMN employee_id uuid;
    END IF;
END $$;
