-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.client_billing_models (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_billing_models_pkey PRIMARY KEY (id)
);
CREATE TABLE public.client_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  default_service_code text,
  CONSTRAINT client_categories_pkey PRIMARY KEY (id),
  CONSTRAINT fk_default_service_code FOREIGN KEY (default_service_code) REFERENCES public.client_services(code)
);
CREATE TABLE public.client_services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_services_pkey PRIMARY KEY (id)
);
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid,
  billing_model_id uuid,
  poc_name text,
  poc_phone text,
  poc_email text,
  status text DEFAULT 'Active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  category_matrix jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT clients_pkey PRIMARY KEY (id),
  CONSTRAINT clients_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.client_categories(id),
  CONSTRAINT clients_billing_model_id_fkey FOREIGN KEY (billing_model_id) REFERENCES public.client_billing_models(id)
);
CREATE TABLE public.daily_task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  vertical_id text NOT NULL DEFAULT 'CHARGING_HUBS'::text,
  hub_id uuid,
  client_id uuid,
  employee_id uuid,
  partner_id uuid,
  vendor_id uuid,
  city text,
  function_name text,
  frequency text NOT NULL DEFAULT 'DAILY'::text,
  frequency_details jsonb,
  time_of_day time without time zone DEFAULT '08:00:00'::time without time zone,
  assigned_to uuid,
  is_active boolean DEFAULT true,
  upload_link text,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_updated_by uuid,
  CONSTRAINT daily_task_templates_pkey PRIMARY KEY (id),
  CONSTRAINT daily_task_templates_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id),
  CONSTRAINT daily_task_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT daily_task_templates_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT daily_task_templates_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id),
  CONSTRAINT daily_task_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT daily_task_templates_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id)
);
CREATE TABLE public.daily_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  text text NOT NULL,
  description text,
  priority text DEFAULT 'Medium'::text,
  stage_id text DEFAULT 'BACKLOG'::text,
  hub_id uuid,
  city text,
  function_name text,
  assigned_to uuid,
  scheduled_date date DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  last_updated_by uuid,
  submission_by uuid,
  vertical_id text NOT NULL,
  client_id uuid,
  employee_id uuid,
  partner_id uuid,
  vendor_id uuid,
  CONSTRAINT daily_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT daily_tasks_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id),
  CONSTRAINT daily_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id),
  CONSTRAINT daily_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT daily_tasks_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES auth.users(id),
  CONSTRAINT daily_tasks_submission_by_fkey FOREIGN KEY (submission_by) REFERENCES auth.users(id),
  CONSTRAINT daily_tasks_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT daily_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  dept_code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employee_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  changed_by text NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  change_type text NOT NULL,
  pan_number character varying DEFAULT NULL::character varying,
  CONSTRAINT employee_history_pkey PRIMARY KEY (id),
  CONSTRAINT employee_history_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id),
  CONSTRAINT employee_history_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id),
  CONSTRAINT employee_history_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.employee_roles(id),
  CONSTRAINT employee_history_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id)
);
CREATE TABLE public.employee_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  role_code text UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  seniority_level integer DEFAULT 1,
  CONSTRAINT employee_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.employees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text UNIQUE,
  phone text,
  department_id uuid,
  role_id uuid,
  hire_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'Active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  gender text,
  dob date,
  doj date,
  hub_id uuid,
  department text,
  role text,
  account_number text,
  ifsc_code text,
  account_name text,
  emp_code character varying UNIQUE,
  badge_id character varying,
  pan_number character varying DEFAULT NULL::character varying,
  manager_id uuid,
  CONSTRAINT employees_pkey PRIMARY KEY (id),
  CONSTRAINT employees_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT employees_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.employee_roles(id),
  CONSTRAINT employees_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id),
  CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id)
);
CREATE TABLE public.feature_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vertical_id text NOT NULL,
  feature_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT feature_access_pkey PRIMARY KEY (id),
  CONSTRAINT feature_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.hub_functions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  function_code text UNIQUE,
  CONSTRAINT hub_functions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hubs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  status text DEFAULT 'active'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  hub_code text UNIQUE,
  CONSTRAINT hubs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.role_permissions (
  role_id text NOT NULL,
  permissions jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id)
);
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  text text NOT NULL,
  verticalid text NOT NULL,
  stageid text NOT NULL,
  createdat timestamp with time zone DEFAULT now(),
  updatedat timestamp with time zone DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  priority text,
  description text,
  hub_id uuid,
  city text,
  function text,
  assigned_to uuid,
  created_by uuid,
  last_updated_by uuid,
  parent_task uuid,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_hub_id_fkey FOREIGN KEY (hub_id) REFERENCES public.hubs(id),
  CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id),
  CONSTRAINT tasks_last_updated_by_fkey FOREIGN KEY (last_updated_by) REFERENCES public.user_profiles(id),
  CONSTRAINT tasks_parent_task_fkey FOREIGN KEY (parent_task) REFERENCES public.tasks(id)
);
CREATE TABLE public.test_table (
  id integer NOT NULL DEFAULT nextval('test_table_id_seq'::regclass),
  message text DEFAULT 'Connection Successful'::text,
  CONSTRAINT test_table_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  name text,
  role_id text DEFAULT 'vertical_viewer'::text CHECK (role_id = ANY (ARRAY['master_admin'::text, 'master_editor'::text, 'master_contributor'::text, 'master_viewer'::text, 'vertical_admin'::text, 'vertical_editor'::text, 'vertical_contributor'::text, 'vertical_viewer'::text])),
  assigned_verticals ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  vertical_permissions jsonb DEFAULT '{}'::jsonb,
  employee_id uuid,
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT user_profiles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);
CREATE TABLE public.vertical_access (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  vertical_id text NOT NULL,
  access_level text NOT NULL DEFAULT 'viewer'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT vertical_access_pkey PRIMARY KEY (id),
  CONSTRAINT vertical_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
);
CREATE TABLE public.verticals (
  id text NOT NULL,
  label text NOT NULL,
  locked boolean DEFAULT false,
  order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verticals_pkey PRIMARY KEY (id)
);