-- Migration: Create daily_tasks table with audit trails and RLS
-- Date: 2026-03-23

--------------------------------------------------------------------------------
-- 1. Helper Function (Ensuring it exists)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

--------------------------------------------------------------------------------
-- 2. Table Definition (Idempotent)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Medium',
    stage_id TEXT DEFAULT 'BACKLOG',
    hub_id UUID REFERENCES public.hubs(id),
    city TEXT,
    function_name TEXT,
    assigned_to UUID REFERENCES public.employees(id),
    scheduled_date DATE DEFAULT CURRENT_DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    
    -- Audit Trails
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    last_updated_by UUID REFERENCES auth.users(id),
    submission_by UUID REFERENCES auth.users(id)
);

--------------------------------------------------------------------------------
-- 3. Triggers & Labels
--------------------------------------------------------------------------------
-- Automatically update 'updated_at' on every edit (Idempotent Trigger)
DROP TRIGGER IF EXISTS update_daily_tasks_modtime ON public.daily_tasks;
CREATE TRIGGER update_daily_tasks_modtime
    BEFORE UPDATE ON public.daily_tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

--------------------------------------------------------------------------------
-- 4. Row Level Security (RLS) - Idempotent Policy Creation
--------------------------------------------------------------------------------
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist before creating
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_tasks;

-- SELECT: All roles with vertical access
CREATE POLICY "Permit SELECT based on role" ON public.daily_tasks 
FOR SELECT USING (public.get_user_permission_level('CHARGING_HUBS') IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor and above
CREATE POLICY "Permit INSERT based on role" ON public.daily_tasks 
FOR INSERT WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('contributor', 'editor', 'admin'));

-- UPDATE: Editor and above
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks 
FOR UPDATE USING (public.get_user_permission_level('CHARGING_HUBS') IN ('editor', 'admin'))
WITH CHECK (public.get_user_permission_level('CHARGING_HUBS') IN ('editor', 'admin'));

-- DELETE: Admin only
CREATE POLICY "Permit DELETE based on role" ON public.daily_tasks 
FOR DELETE USING (public.get_user_permission_level('CHARGING_HUBS') = 'admin');
