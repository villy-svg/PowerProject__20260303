-- =========================================================================
-- POWERPROJECT: 4/6 — ROW LEVEL SECURITY (RLS)
-- Enable RLS + all ~60 policies. Safe to re-run (DROP IF EXISTS + CREATE).
-- =========================================================================

-- Enable RLS on ALL tables
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
ALTER TABLE public.verticals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_table ENABLE ROW LEVEL SECURITY;

-- ─── USER_PROFILES ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can see their own profile" ON public.user_profiles;
CREATE POLICY "Users can see their own profile" ON public.user_profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
CREATE POLICY "Users can update their own profile" ON public.user_profiles
FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
CREATE POLICY "Users can insert their own profile" ON public.user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Master admin full access on profiles" ON public.user_profiles;
CREATE POLICY "Master admin full access on profiles" ON public.user_profiles
FOR ALL USING (public.is_master_admin());

-- ─── TASKS ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tasks are viewable by owner, admin, or vertical_admin." ON public.tasks;
CREATE POLICY "Tasks are viewable by owner, admin, or vertical_admin." ON public.tasks
FOR SELECT USING (
  (auth.uid() = user_id) OR public.is_elevated_role() OR (user_id IS NULL)
);

DROP POLICY IF EXISTS "Tasks can be modified by owner, admin, or vertical_admin." ON public.tasks;
CREATE POLICY "Tasks can be modified by owner, admin, or vertical_admin." ON public.tasks
FOR ALL USING (
  (auth.uid() = user_id) OR public.is_elevated_role()
) WITH CHECK (
  (auth.uid() = user_id) OR public.is_elevated_role()
);

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.tasks;
CREATE POLICY "Permit SELECT based on role" ON public.tasks
FOR SELECT USING (public.get_user_permission_level(verticalid) IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.tasks;
CREATE POLICY "Permit INSERT based on role" ON public.tasks
FOR INSERT WITH CHECK (public.get_user_permission_level(verticalid) IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.tasks
FOR UPDATE
USING (public.get_user_permission_level(verticalid) IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level(verticalid) IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.tasks;
CREATE POLICY "Permit DELETE based on role" ON public.tasks
FOR DELETE USING (public.get_user_permission_level(verticalid) = 'admin');

-- ─── DAILY_TASKS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_tasks;
CREATE POLICY "Permit SELECT based on role" ON public.daily_tasks
FOR SELECT USING (public.get_user_permission_level(vertical_id) IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_tasks;
CREATE POLICY "Permit INSERT based on role" ON public.daily_tasks
FOR INSERT WITH CHECK (public.get_user_permission_level(vertical_id) IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks
FOR UPDATE
USING (public.get_user_permission_level(vertical_id) IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level(vertical_id) IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_tasks;
CREATE POLICY "Permit DELETE based on role" ON public.daily_tasks
FOR DELETE USING (public.get_user_permission_level(vertical_id) = 'admin');

-- ─── DAILY_TASK_TEMPLATES ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_task_templates;
CREATE POLICY "Permit SELECT based on role" ON public.daily_task_templates
FOR SELECT USING (public.get_user_permission_level('CHARGING_HUBS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_task_templates;
CREATE POLICY "Permit INSERT based on role" ON public.daily_task_templates
FOR INSERT WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_task_templates;
CREATE POLICY "Permit UPDATE based on role" ON public.daily_task_templates
FOR UPDATE
USING (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_task_templates;
CREATE POLICY "Permit DELETE based on role" ON public.daily_task_templates
FOR DELETE USING (public.get_user_permission_level('CHARGING_HUBS') = 'admin');

-- ─── EMPLOYEES ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Employees viewable by authenticated" ON public.employees;
CREATE POLICY "Employees viewable by authenticated" ON public.employees
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Employees managed by master_admin" ON public.employees;
CREATE POLICY "Employees managed by master_admin" ON public.employees
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.employees;
CREATE POLICY "Permit INSERT based on role" ON public.employees
FOR INSERT WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.employees;
CREATE POLICY "Permit UPDATE based on role" ON public.employees
FOR UPDATE
USING (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.employees;
CREATE POLICY "Permit DELETE based on role" ON public.employees
FOR DELETE USING (public.get_user_permission_level('EMPLOYEES') = 'admin');

-- ─── EMPLOYEE_HISTORY ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.employee_history;
CREATE POLICY "Permit SELECT based on role" ON public.employee_history
FOR SELECT USING (public.get_user_permission_level('EMPLOYEES') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.employee_history;
CREATE POLICY "Permit INSERT based on role" ON public.employee_history
FOR INSERT WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('contributor','editor','admin'));

-- ─── EMPLOYEE_ROLES ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Employee roles viewable by authenticated" ON public.employee_roles;
CREATE POLICY "Employee roles viewable by authenticated" ON public.employee_roles
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Employee roles managed by master_admin" ON public.employee_roles;
CREATE POLICY "Employee roles managed by master_admin" ON public.employee_roles
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.employee_roles;
CREATE POLICY "Permit INSERT based on role" ON public.employee_roles
FOR INSERT WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.employee_roles;
CREATE POLICY "Permit UPDATE based on role" ON public.employee_roles
FOR UPDATE
USING (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.employee_roles;
CREATE POLICY "Permit DELETE based on role" ON public.employee_roles
FOR DELETE USING (public.get_user_permission_level('EMPLOYEES') = 'admin');

-- ─── DEPARTMENTS ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Departments viewable by authenticated" ON public.departments;
CREATE POLICY "Departments viewable by authenticated" ON public.departments
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Departments managed by master_admin" ON public.departments;
CREATE POLICY "Departments managed by master_admin" ON public.departments
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.departments;
CREATE POLICY "Permit INSERT based on role" ON public.departments
FOR INSERT WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.departments;
CREATE POLICY "Permit UPDATE based on role" ON public.departments
FOR UPDATE
USING (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.departments;
CREATE POLICY "Permit DELETE based on role" ON public.departments
FOR DELETE USING (public.get_user_permission_level('EMPLOYEES') = 'admin');

-- ─── CLIENTS ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.clients;
CREATE POLICY "Permit SELECT based on role" ON public.clients
FOR SELECT USING (public.get_user_permission_level('CLIENTS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.clients;
CREATE POLICY "Permit INSERT based on role" ON public.clients
FOR INSERT WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.clients;
CREATE POLICY "Permit UPDATE based on role" ON public.clients
FOR UPDATE
USING (public.get_user_permission_level('CLIENTS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.clients;
CREATE POLICY "Permit DELETE based on role" ON public.clients
FOR DELETE USING (public.get_user_permission_level('CLIENTS') = 'admin');

-- ─── CLIENT_CATEGORIES ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.client_categories;
CREATE POLICY "Permit SELECT based on role" ON public.client_categories
FOR SELECT USING (public.get_user_permission_level('CLIENTS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.client_categories;
CREATE POLICY "Permit INSERT based on role" ON public.client_categories
FOR INSERT WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.client_categories;
CREATE POLICY "Permit UPDATE based on role" ON public.client_categories
FOR UPDATE
USING (public.get_user_permission_level('CLIENTS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.client_categories;
CREATE POLICY "Permit DELETE based on role" ON public.client_categories
FOR DELETE USING (public.get_user_permission_level('CLIENTS') = 'admin');

-- ─── CLIENT_BILLING_MODELS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.client_billing_models;
CREATE POLICY "Permit SELECT based on role" ON public.client_billing_models
FOR SELECT USING (public.get_user_permission_level('CLIENTS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.client_billing_models;
CREATE POLICY "Permit INSERT based on role" ON public.client_billing_models
FOR INSERT WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.client_billing_models;
CREATE POLICY "Permit UPDATE based on role" ON public.client_billing_models
FOR UPDATE
USING (public.get_user_permission_level('CLIENTS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.client_billing_models;
CREATE POLICY "Permit DELETE based on role" ON public.client_billing_models
FOR DELETE USING (public.get_user_permission_level('CLIENTS') = 'admin');

-- ─── CLIENT_SERVICES ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.client_services;
CREATE POLICY "Permit SELECT based on role" ON public.client_services
FOR SELECT USING (public.get_user_permission_level('CLIENTS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.client_services;
CREATE POLICY "Permit INSERT based on role" ON public.client_services
FOR INSERT WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.client_services;
CREATE POLICY "Permit UPDATE based on role" ON public.client_services
FOR UPDATE
USING (public.get_user_permission_level('CLIENTS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.client_services;
CREATE POLICY "Permit DELETE based on role" ON public.client_services
FOR DELETE USING (public.get_user_permission_level('CLIENTS') = 'admin');

-- ─── HUBS ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hubs are viewable by authenticated users." ON public.hubs;
CREATE POLICY "Hubs are viewable by authenticated users." ON public.hubs
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Hubs can be managed by master_admin." ON public.hubs;
CREATE POLICY "Hubs can be managed by master_admin." ON public.hubs
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.hubs;
CREATE POLICY "Permit SELECT based on role" ON public.hubs
FOR SELECT USING (public.get_user_permission_level('CHARGING_HUBS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.hubs;
CREATE POLICY "Permit INSERT based on role" ON public.hubs
FOR INSERT WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.hubs;
CREATE POLICY "Permit UPDATE based on role" ON public.hubs
FOR UPDATE
USING (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.hubs;
CREATE POLICY "Permit DELETE based on role" ON public.hubs
FOR DELETE USING (public.get_user_permission_level('CHARGING_HUBS') = 'admin');

-- ─── HUB_FUNCTIONS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Hub functions are viewable by authenticated users." ON public.hub_functions;
CREATE POLICY "Hub functions are viewable by authenticated users." ON public.hub_functions
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Hub functions can be managed by master_admin." ON public.hub_functions;
CREATE POLICY "Hub functions can be managed by master_admin." ON public.hub_functions
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.hub_functions;
CREATE POLICY "Permit SELECT based on role" ON public.hub_functions
FOR SELECT USING (public.get_user_permission_level('CHARGING_HUBS') IN ('viewer','contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.hub_functions;
CREATE POLICY "Permit INSERT based on role" ON public.hub_functions
FOR INSERT WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('contributor','editor','admin'));

DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.hub_functions;
CREATE POLICY "Permit UPDATE based on role" ON public.hub_functions
FOR UPDATE
USING (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'))
WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('editor','admin'));

DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.hub_functions;
CREATE POLICY "Permit DELETE based on role" ON public.hub_functions
FOR DELETE USING (public.get_user_permission_level('CHARGING_HUBS') = 'admin');

-- ─── VERTICAL_ACCESS (uses is_master_admin() to avoid recursion) ────────────
DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.vertical_access;
CREATE POLICY "Permit SELECT for all users" ON public.vertical_access
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.vertical_access;
CREATE POLICY "Permit ALL for master_admin" ON public.vertical_access
FOR ALL TO authenticated USING (public.is_master_admin());

-- ─── FEATURE_ACCESS ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.feature_access;
CREATE POLICY "Permit SELECT for all users" ON public.feature_access
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.feature_access;
CREATE POLICY "Permit ALL for master_admin" ON public.feature_access
FOR ALL TO authenticated USING (public.is_master_admin());

-- ─── ROLE_PERMISSIONS ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.role_permissions;
CREATE POLICY "Permit SELECT for all users" ON public.role_permissions
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.role_permissions;
CREATE POLICY "Permit ALL for master_admin" ON public.role_permissions
FOR ALL TO authenticated USING (public.is_master_admin());

-- ─── VERTICALS ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Verticals are viewable by authenticated users." ON public.verticals;
CREATE POLICY "Verticals are viewable by authenticated users." ON public.verticals
FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Verticals can be managed by master_admin." ON public.verticals;
CREATE POLICY "Verticals can be managed by master_admin." ON public.verticals
FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());
