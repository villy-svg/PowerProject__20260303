/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Migration: Create Daily Task Templates and Generation Job
-- Date: 2026-03-23

--------------------------------------------------------------------------------
-- 1. Table Creation
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    vertical_id TEXT NOT NULL DEFAULT 'CHARGING_HUBS',
    
    -- Subject Context (Unified per Vertical)
    hub_id UUID REFERENCES public.hubs(id),
    client_id UUID REFERENCES public.clients(id),
    employee_id UUID REFERENCES public.employees(id),
    partner_id UUID, -- If table exists in future
    vendor_id UUID,  -- If table exists in future
    city TEXT,
    function_name TEXT,
    
    -- Frequency Settings
    frequency TEXT NOT NULL DEFAULT 'DAILY', -- 'DAILY', 'WEEKLY', 'MONTHLY'
    frequency_details JSONB, -- For tracking e.g., {"day_of_week": 1}
    time_of_day TIME DEFAULT '08:00:00',
    
    -- Assignments & Meta
    assigned_to UUID REFERENCES public.employees(id),
    is_active BOOLEAN DEFAULT TRUE,
    upload_link TEXT,
    last_run_at TIMESTAMPTZ,
    
    -- Audit Trails
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    last_updated_by UUID REFERENCES auth.users(id)
);

--------------------------------------------------------------------------------
-- 2. Triggers
--------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_daily_task_templates_modtime ON public.daily_task_templates;
CREATE TRIGGER update_daily_task_templates_modtime
    BEFORE UPDATE ON public.daily_task_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

--------------------------------------------------------------------------------
-- 3. Row Level Security policies
--------------------------------------------------------------------------------
ALTER TABLE public.daily_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_task_templates;
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_task_templates;
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_task_templates;
DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_task_templates;

-- Viewer can select
CREATE POLICY "Permit SELECT based on role" ON public.daily_task_templates 
FOR SELECT USING (public.get_user_permission_level('CHARGING_HUBS') IN ('viewer', 'contributor', 'editor', 'admin'));

-- Contributor and above can insert
CREATE POLICY "Permit INSERT based on role" ON public.daily_task_templates 
FOR INSERT WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('contributor', 'editor', 'admin'));

-- Editor and above can update
CREATE POLICY "Permit UPDATE based on role" ON public.daily_task_templates 
FOR UPDATE USING (public.get_user_permission_level('CHARGING_HUBS') IN ('editor', 'admin'))
WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('editor', 'admin'));

-- Admin only can delete
CREATE POLICY "Permit DELETE based on role" ON public.daily_task_templates 
FOR DELETE USING (public.get_user_permission_level('CHARGING_HUBS') = 'admin');

--------------------------------------------------------------------------------
-- 4. Batch Generation Function
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_daily_tasks()
RETURNS integer AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- 5. pg_cron Job (uncomment in Supabase Dashboard if allowed)
--------------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule('generate_daily_tasks_job', '30 2 * * *', 'SELECT public.generate_daily_tasks();');

 */
