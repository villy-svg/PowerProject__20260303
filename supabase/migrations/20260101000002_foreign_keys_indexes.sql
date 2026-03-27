-- =========================================================================
-- POWERPROJECT: 2/6 — FOREIGN KEYS, CONSTRAINTS & INDEXES
-- Added after all tables exist. Idempotent via pg_constraint checks.
-- =========================================================================

DO $$
BEGIN
  -- client_categories -> client_services
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_default_service_code') THEN
    ALTER TABLE public.client_categories ADD CONSTRAINT fk_default_service_code
      FOREIGN KEY (default_service_code) REFERENCES public.client_services(code)
      ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
  END IF;

  -- employees FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_hub_id_fkey') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_hub_id_fkey
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_manager_id_fkey') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_manager_id_fkey
      FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL NOT VALID;
  END IF;

  -- employee_history FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_history_employee_id_fkey') THEN
    ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_history_department_id_fkey') THEN
    ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_history_hub_id_fkey') THEN
    ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_hub_id_fkey
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_history_role_id_fkey') THEN
    ALTER TABLE public.employee_history ADD CONSTRAINT employee_history_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES public.employee_roles(id) ON DELETE SET NULL NOT VALID;
  END IF;

  -- clients FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_category_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.client_categories(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_billing_model_id_fkey') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_billing_model_id_fkey
      FOREIGN KEY (billing_model_id) REFERENCES public.client_billing_models(id) ON DELETE SET NULL NOT VALID;
  END IF;

  -- tasks FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_hub_id_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_hub_id_fkey
      FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assigned_to_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.employees(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_parent_task_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_parent_task_fkey
      FOREIGN KEY (parent_task) REFERENCES public.tasks(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_last_updated_by_fkey') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_last_updated_by_fkey
      FOREIGN KEY (last_updated_by) REFERENCES public.user_profiles(id) NOT VALID;
  END IF;

  -- daily_tasks FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_tasks_created_by_fkey') THEN
    ALTER TABLE public.daily_tasks ADD CONSTRAINT daily_tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_tasks_last_updated_by_fkey') THEN
    ALTER TABLE public.daily_tasks ADD CONSTRAINT daily_tasks_last_updated_by_fkey
      FOREIGN KEY (last_updated_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_tasks_submission_by_fkey') THEN
    ALTER TABLE public.daily_tasks ADD CONSTRAINT daily_tasks_submission_by_fkey
      FOREIGN KEY (submission_by) REFERENCES auth.users(id) NOT VALID;
  END IF;

  -- daily_task_templates FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_task_templates_created_by_fkey') THEN
    ALTER TABLE public.daily_task_templates ADD CONSTRAINT daily_task_templates_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_task_templates_last_updated_by_fkey') THEN
    ALTER TABLE public.daily_task_templates ADD CONSTRAINT daily_task_templates_last_updated_by_fkey
      FOREIGN KEY (last_updated_by) REFERENCES auth.users(id) NOT VALID;
  END IF;

  -- RBAC table FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vertical_access_user_id_fkey') THEN
    ALTER TABLE public.vertical_access ADD CONSTRAINT vertical_access_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'feature_access_user_id_fkey') THEN
    ALTER TABLE public.feature_access ADD CONSTRAINT feature_access_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  -- user_profiles -> employees
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_employee_id_fkey') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) NOT VALID;
  END IF;

  -- user_profiles role_id check
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_valid_role_id') THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT chk_valid_role_id
      CHECK (role_id = ANY (ARRAY['master_admin','master_editor','master_contributor','master_viewer','vertical_admin','vertical_editor','vertical_contributor','vertical_viewer'])) NOT VALID;
  END IF;
END $$;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS client_services_code_unique ON public.client_services USING btree (code);
CREATE INDEX IF NOT EXISTS idx_employee_history_employee_id ON public.employee_history USING btree (employee_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_badge_id ON public.employees USING btree (badge_id);
CREATE INDEX IF NOT EXISTS idx_employees_emp_code ON public.employees USING btree (emp_code);
CREATE INDEX IF NOT EXISTS idx_employees_hub_id ON public.employees USING btree (hub_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees USING btree (status);
CREATE INDEX IF NOT EXISTS idx_hub_functions_function_code ON public.hub_functions USING btree (function_code);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks USING btree (assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_profiles_employee_id ON public.user_profiles USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks USING btree (created_by);
