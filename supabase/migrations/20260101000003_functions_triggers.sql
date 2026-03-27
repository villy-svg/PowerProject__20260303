-- =========================================================================
-- POWERPROJECT: 3/6 — FUNCTIONS & TRIGGERS
-- All business logic functions + auth trigger. Safe to re-run.
-- =========================================================================

-- Trigger helper: auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- RBAC: Get user permission level for a vertical
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

    IF v_role_id = 'master_admin' THEN RETURN 'admin';
    ELSIF v_role_id = 'master_editor' THEN RETURN 'editor';
    ELSIF v_role_id = 'master_contributor' THEN RETURN 'contributor';
    ELSIF v_role_id = 'master_viewer' THEN RETURN 'viewer';
    END IF;

    SELECT access_level INTO v_level
    FROM public.vertical_access
    WHERE user_id = auth.uid() AND vertical_id = v_id;

    RETURN COALESCE(v_level, 'viewer');
END;
$$;

-- RBAC: Simple role checks (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_master_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id = 'master_admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_elevated_role() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id IN ('master_admin', 'vertical_admin'));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_global_reader() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role_id IN ('master_admin', 'master_viewer'));
$$ LANGUAGE sql SECURITY DEFINER;

-- Auth Trigger: Profile sync (HARDENED — case-insensitive, orphan-safe, employee auto-link)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    orphaned_id uuid;
BEGIN
    -- STEP 1: Find any orphaned profile (case-insensitive)
    SELECT id INTO orphaned_id
    FROM public.user_profiles
    WHERE LOWER(email) = LOWER(NEW.email) AND id != NEW.id;

    IF orphaned_id IS NOT NULL THEN
        UPDATE public.tasks SET created_by = NULL WHERE created_by = orphaned_id;
        UPDATE public.tasks SET last_updated_by = NULL WHERE last_updated_by = orphaned_id;
        DELETE FROM public.user_profiles WHERE id = orphaned_id;
    END IF;

    -- STEP 2: Upsert profile (collision-proof on email)
    INSERT INTO public.user_profiles (id, email, name, assigned_verticals)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        ARRAY[]::TEXT[]
    )
    ON CONFLICT (email) DO UPDATE
    SET id = EXCLUDED.id,
        name = COALESCE(EXCLUDED.name, user_profiles.name);

    -- STEP 3: Auto-link employee_id (case-insensitive)
    UPDATE public.user_profiles SET employee_id = e.id
    FROM public.employees e
    WHERE LOWER(e.email) = LOWER(NEW.email)
      AND e.status = 'Active'
      AND user_profiles.id = NEW.id
      AND user_profiles.employee_id IS NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Daily Task Generator
CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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

        IF template.frequency = 'DAILY' THEN
            IF template.last_run_at IS NULL OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                should_run := true;
            END IF;
        ELSIF template.frequency = 'WEEKLY' THEN
            day_of_week := EXTRACT(DOW FROM now() AT TIME ZONE 'UTC');
            IF (template.frequency_details->>'day_of_week') IS NOT NULL AND (template.frequency_details->>'day_of_week')::int = day_of_week THEN
                IF template.last_run_at IS NULL OR date_trunc('day', template.last_run_at AT TIME ZONE 'UTC') < date_trunc('day', now() AT TIME ZONE 'UTC') THEN
                    should_run := true;
                END IF;
            END IF;
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
$$;

-- =========================================================================
-- TRIGGERS
-- =========================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_daily_tasks_modtime') THEN
        CREATE TRIGGER update_daily_tasks_modtime BEFORE UPDATE ON public.daily_tasks
        FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();
    END IF;
END $$;
