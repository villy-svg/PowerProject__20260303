/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email text,
    phone text,
    gender text CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
    dob date,
    hire_date date,
    hub_id uuid REFERENCES public.hubs(id),
    role_id uuid,
    department_id uuid,
    account_number text,
    ifsc_code text,
    account_name text,
    pan_number text,
    status text DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    emp_code text UNIQUE,
    badge_id text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employees_emp_code ON public.employees(emp_code);
CREATE INDEX IF NOT EXISTS idx_employees_badge_id ON public.employees(badge_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_hub_id ON public.employees(hub_id);

 */
