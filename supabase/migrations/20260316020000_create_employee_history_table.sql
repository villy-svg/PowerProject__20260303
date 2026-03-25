/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Create employee_history table for audit trail
CREATE TABLE IF NOT EXISTS public.employee_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    full_name text,
    email text,
    phone text,
    gender text,
    dob date,
    hub_id uuid,
    role_id uuid,
    department_id uuid,
    emp_code text,
    badge_id text,
    status text DEFAULT 'Active',
    hire_date date,
    account_number text,
    ifsc_code text,
    account_name text,
    pan_number text,
    changed_by text,
    change_type text CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE')),
    created_at timestamptz DEFAULT now()
);

-- Create indexes (with flexible column name handling)
CREATE INDEX IF NOT EXISTS idx_employee_history_employee_id ON public.employee_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_history_change_type ON public.employee_history(change_type);

-- Handle created_at vs createdat column naming
DO $$
BEGIN
    -- Try created_at first
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_history' 
        AND column_name = 'created_at'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_employee_history_created_at ON public.employee_history(created_at);
    -- Try createdat as fallback
    ELSIF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_history' 
        AND column_name = 'createdat'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_employee_history_createdat ON public.employee_history(createdat);
    END IF;
END $$;

 */
