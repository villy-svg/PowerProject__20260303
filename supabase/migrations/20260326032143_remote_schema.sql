-- 1. Nuke any existing policies to allow remote_schema to be the "source of truth"
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

drop extension if exists "pg_net";

create sequence "public"."test_table_id_seq";

alter table "public"."client_categories" drop constraint if exists "client_categories_default_service_code_fkey";

alter table "public"."client_services" drop constraint "client_services_code_key";

alter table "public"."clients" drop constraint "clients_billing_model_id_fkey";

alter table "public"."clients" drop constraint "clients_category_id_fkey";

alter table "public"."employees" drop constraint "employees_hub_id_fkey";

alter table "public"."employees" drop constraint "employees_manager_id_fkey";

alter table "public"."tasks" drop constraint "tasks_assigned_to_fkey";

alter table "public"."tasks" drop constraint "tasks_hub_id_fkey";

alter table "public"."tasks" drop constraint "tasks_parent_task_fkey";

drop index if exists "public"."client_services_code_key";


  create table "public"."test_table" (
    "id" integer not null default nextval('public.test_table_id_seq'::regclass),
    "message" text default 'Connection Successful'::text
      );


alter table "public"."test_table" enable row level security;

alter table "public"."daily_task_templates" add column "partner_id" uuid;

alter table "public"."daily_task_templates" add column "vendor_id" uuid;

alter table "public"."daily_tasks" add column "partner_id" uuid;

alter table "public"."daily_tasks" add column "vendor_id" uuid;

alter table "public"."employee_history" alter column "badge_id" set data type character varying(20) using "badge_id"::character varying(20);

alter table "public"."employee_history" alter column "emp_code" set data type character varying(6) using "emp_code"::character varying(6);

alter table "public"."employee_history" alter column "pan_number" set default NULL::character varying;

alter table "public"."employee_history" alter column "pan_number" set data type character varying(20) using "pan_number"::character varying(20);

alter table "public"."employees" alter column "badge_id" set data type character varying(20) using "badge_id"::character varying(20);

alter table "public"."employees" alter column "emp_code" set data type character varying(6) using "emp_code"::character varying(6);

alter table "public"."employees" alter column "pan_number" set default NULL::character varying;

alter table "public"."employees" alter column "pan_number" set data type character varying(20) using "pan_number"::character varying(20);

alter table "public"."tasks" alter column "priority" drop default;

alter table "public"."user_profiles" drop column "updated_at";

alter table "public"."verticals" drop column "updated_at";

alter sequence "public"."test_table_id_seq" owned by "public"."test_table"."id";

CREATE UNIQUE INDEX client_services_code_unique ON public.client_services USING btree (code);

CREATE INDEX idx_employee_history_employee_id ON public.employee_history USING btree (employee_id, changed_at DESC);

CREATE INDEX idx_employees_badge_id ON public.employees USING btree (badge_id);

CREATE INDEX idx_employees_emp_code ON public.employees USING btree (emp_code);

CREATE INDEX idx_employees_hub_id ON public.employees USING btree (hub_id);

CREATE INDEX idx_employees_status ON public.employees USING btree (status);

CREATE INDEX idx_hub_functions_function_code ON public.hub_functions USING btree (function_code);

CREATE INDEX idx_tasks_assigned_to ON public.tasks USING btree (assigned_to);

CREATE UNIQUE INDEX test_table_pkey ON public.test_table USING btree (id);

alter table "public"."test_table" add constraint "test_table_pkey" PRIMARY KEY using index "test_table_pkey";

alter table "public"."client_categories" add constraint "fk_default_service_code" FOREIGN KEY (default_service_code) REFERENCES public.client_services(code) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."client_categories" validate constraint "fk_default_service_code";

alter table "public"."client_services" add constraint "client_services_code_unique" UNIQUE using index "client_services_code_unique";

alter table "public"."employee_history" add constraint "employee_history_department_id_fkey" FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL not valid;

alter table "public"."employee_history" validate constraint "employee_history_department_id_fkey";

alter table "public"."employee_history" add constraint "employee_history_hub_id_fkey" FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL not valid;

alter table "public"."employee_history" validate constraint "employee_history_hub_id_fkey";

alter table "public"."employee_history" add constraint "employee_history_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.employee_roles(id) ON DELETE SET NULL not valid;

alter table "public"."employee_history" validate constraint "employee_history_role_id_fkey";

alter table "public"."user_profiles" add constraint "chk_valid_role_id" CHECK ((role_id = ANY (ARRAY['master_admin'::text, 'master_editor'::text, 'master_contributor'::text, 'master_viewer'::text, 'vertical_admin'::text, 'vertical_editor'::text, 'vertical_contributor'::text, 'vertical_viewer'::text]))) not valid;

alter table "public"."user_profiles" validate constraint "chk_valid_role_id";

alter table "public"."user_profiles" add constraint "user_profiles_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) not valid;

alter table "public"."user_profiles" validate constraint "user_profiles_employee_id_fkey";

alter table "public"."clients" add constraint "clients_billing_model_id_fkey" FOREIGN KEY (billing_model_id) REFERENCES public.client_billing_models(id) ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_billing_model_id_fkey";

alter table "public"."clients" add constraint "clients_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.client_categories(id) ON DELETE SET NULL not valid;

alter table "public"."clients" validate constraint "clients_category_id_fkey";

alter table "public"."employees" add constraint "employees_hub_id_fkey" FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL not valid;

alter table "public"."employees" validate constraint "employees_hub_id_fkey";

alter table "public"."employees" add constraint "employees_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."employees" validate constraint "employees_manager_id_fkey";

alter table "public"."tasks" add constraint "tasks_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_assigned_to_fkey";

alter table "public"."tasks" add constraint "tasks_hub_id_fkey" FOREIGN KEY (hub_id) REFERENCES public.hubs(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_hub_id_fkey";

alter table "public"."tasks" add constraint "tasks_parent_task_fkey" FOREIGN KEY (parent_task) REFERENCES public.tasks(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_parent_task_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    template RECORD;
    tasks_created integer := 0;
    should_run boolean;
    day_of_week integer;
BEGIN
    FOR template IN 
        SELECT * FROM public.daily_task_templates 
        WHERE is_active = true
    LOOP
        should_run := false;
        
        -- DAILY Check: Hasn't run today (using local time logic or UTC, currently UTC based)
        IF template.frequency = 'DAILY' THEN
            IF template.last_run_at IS NULL OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                should_run := true;
            END IF;
            
        -- WEEKLY Check (e.g., runs if today is Monday and hasn't run today)
        ELSIF template.frequency = 'WEEKLY' THEN
            -- Extract day of week (0=Sun, 1=Mon, ..., 6=Sat)
            day_of_week := EXTRACT(DOW FROM now() AT TIME ZONE 'UTC');
            -- Assuming frequency_details contains {"day_of_week": 1}
            IF (template.frequency_details->>'day_of_week') IS NOT NULL AND (template.frequency_details->>'day_of_week')::int = day_of_week THEN
                IF template.last_run_at IS NULL OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    should_run := true;
                END IF;
            END IF;

        -- MONTHLY Check
        ELSIF template.frequency = 'MONTHLY' THEN
            IF (template.frequency_details->>'day_of_month') IS NOT NULL AND (template.frequency_details->>'day_of_month')::int = EXTRACT(DAY FROM now() AT TIME ZONE 'UTC') THEN
                IF template.last_run_at IS NULL OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    should_run := true;
                END IF;
            END IF;
        END IF;

        IF should_run THEN
            INSERT INTO public.daily_tasks (
                text, description, priority, stage_id,
                vertical_id, hub_id, client_id, employee_id, city, function_name,
                assigned_to, scheduled_date, is_recurring, created_by, last_updated_by
            ) VALUES (
                template.title, template.description, 'Medium', 'TODO',
                template.vertical_id, template.hub_id, template.client_id, template.employee_id, template.city, template.function_name,
                template.assigned_to, CURRENT_DATE, TRUE, template.created_by, template.created_by
            );
            
            UPDATE public.daily_task_templates 
            SET last_run_at = now() 
            WHERE id = template.id;
            
            tasks_created := tasks_created + 1;
        END IF;

    END LOOP;
    
    RETURN tasks_created;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_global_reader()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() 
    AND role_id IN ('master_admin', 'master_viewer')
  );
END;
$function$
;

grant delete on table "public"."test_table" to "anon";

grant insert on table "public"."test_table" to "anon";

grant references on table "public"."test_table" to "anon";

grant select on table "public"."test_table" to "anon";

grant trigger on table "public"."test_table" to "anon";

grant truncate on table "public"."test_table" to "anon";

grant update on table "public"."test_table" to "anon";

grant delete on table "public"."test_table" to "authenticated";

grant insert on table "public"."test_table" to "authenticated";

grant references on table "public"."test_table" to "authenticated";

grant select on table "public"."test_table" to "authenticated";

grant trigger on table "public"."test_table" to "authenticated";

grant truncate on table "public"."test_table" to "authenticated";

grant update on table "public"."test_table" to "authenticated";

grant delete on table "public"."test_table" to "service_role";

grant insert on table "public"."test_table" to "service_role";

grant references on table "public"."test_table" to "service_role";

grant select on table "public"."test_table" to "service_role";

grant trigger on table "public"."test_table" to "service_role";

grant truncate on table "public"."test_table" to "service_role";

grant update on table "public"."test_table" to "service_role";


  create policy "Permit DELETE based on role"
  on "public"."client_billing_models"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."client_billing_models"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."client_billing_models"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit DELETE based on role"
  on "public"."client_categories"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."client_categories"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."client_categories"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit DELETE based on role"
  on "public"."client_services"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."client_services"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."client_services"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit DELETE based on role"
  on "public"."clients"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."clients"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."clients"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CLIENTS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit DELETE based on role"
  on "public"."daily_task_templates"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."daily_task_templates"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit SELECT based on role"
  on "public"."daily_task_templates"
  as permissive
  for select
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['viewer'::text, 'contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."daily_task_templates"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit DELETE based on role"
  on "public"."daily_tasks"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level(vertical_id) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."daily_tasks"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level(vertical_id) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."daily_tasks"
  as permissive
  for update
  to public
using ((public.get_user_permission_level(vertical_id) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level(vertical_id) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Departments managed by master_admin"
  on "public"."departments"
  as permissive
  for all
  to public
using (public.is_master_admin())
with check (public.is_master_admin());



  create policy "Departments viewable by authenticated"
  on "public"."departments"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Permit DELETE based on role"
  on "public"."departments"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."departments"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."departments"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit INSERT based on role"
  on "public"."employee_history"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Employee roles managed by master_admin"
  on "public"."employee_roles"
  as permissive
  for all
  to public
using (public.is_master_admin())
with check (public.is_master_admin());



  create policy "Employee roles viewable by authenticated"
  on "public"."employee_roles"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Permit DELETE based on role"
  on "public"."employee_roles"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."employee_roles"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."employee_roles"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Employees managed by master_admin"
  on "public"."employees"
  as permissive
  for all
  to public
using (public.is_master_admin())
with check (public.is_master_admin());



  create policy "Employees viewable by authenticated"
  on "public"."employees"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Permit DELETE based on role"
  on "public"."employees"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."employees"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."employees"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('EMPLOYEES'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit ALL for master_admin"
  on "public"."feature_access"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role_id = 'master_admin'::text)))));



  create policy "Permit SELECT for all users"
  on "public"."feature_access"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Hub functions are viewable by authenticated users."
  on "public"."hub_functions"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Hub functions can be managed by master_admin."
  on "public"."hub_functions"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role_id = 'master_admin'::text)))));



  create policy "Permit DELETE based on role"
  on "public"."hub_functions"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."hub_functions"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit SELECT based on role"
  on "public"."hub_functions"
  as permissive
  for select
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['viewer'::text, 'contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."hub_functions"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Hubs are viewable by authenticated users."
  on "public"."hubs"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Hubs can be managed by master_admin."
  on "public"."hubs"
  as permissive
  for all
  to public
using (public.is_master_admin())
with check (public.is_master_admin());



  create policy "Permit DELETE based on role"
  on "public"."hubs"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."hubs"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit SELECT based on role"
  on "public"."hubs"
  as permissive
  for select
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['viewer'::text, 'contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."hubs"
  as permissive
  for update
  to public
using ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level('CHARGING_HUBS'::text) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Permit ALL for master_admin"
  on "public"."role_permissions"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.role_id = 'master_admin'::text)))));



  create policy "Permit SELECT for all users"
  on "public"."role_permissions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Permit DELETE based on role"
  on "public"."tasks"
  as permissive
  for delete
  to public
using ((public.get_user_permission_level(verticalid) = 'admin'::text));



  create policy "Permit INSERT based on role"
  on "public"."tasks"
  as permissive
  for insert
  to public
with check ((public.get_user_permission_level(verticalid) = ANY (ARRAY['contributor'::text, 'editor'::text, 'admin'::text])));



  create policy "Permit UPDATE based on role"
  on "public"."tasks"
  as permissive
  for update
  to public
using ((public.get_user_permission_level(verticalid) = ANY (ARRAY['editor'::text, 'admin'::text])))
with check ((public.get_user_permission_level(verticalid) = ANY (ARRAY['editor'::text, 'admin'::text])));



  create policy "Tasks are viewable by owner, admin, or vertical_admin."
  on "public"."tasks"
  as permissive
  for select
  to public
using (((auth.uid() = user_id) OR public.is_elevated_role() OR (user_id IS NULL)));



  create policy "Tasks can be modified by owner, admin, or vertical_admin."
  on "public"."tasks"
  as permissive
  for all
  to public
using (((auth.uid() = user_id) OR public.is_elevated_role()))
with check (((auth.uid() = user_id) OR public.is_elevated_role()));



  create policy "Users can update their own profile"
  on "public"."user_profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Verticals are viewable by authenticated users."
  on "public"."verticals"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Verticals can be managed by master_admin."
  on "public"."verticals"
  as permissive
  for all
  to public
using (public.is_master_admin())
with check (public.is_master_admin());
