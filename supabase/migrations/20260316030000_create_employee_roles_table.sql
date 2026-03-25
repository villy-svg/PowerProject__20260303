/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Create employee_roles table
CREATE TABLE IF NOT EXISTS public.employee_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    role_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_employee_roles_role_code ON public.employee_roles(role_code);

-- Insert sample data
INSERT INTO public.employee_roles (name, role_code) VALUES
    ('Master Admin', 'ADMIN'),
    ('Vertical Admin', 'VADMIN'),
    ('Hub Manager', 'HMGR'),
    ('Technician', 'TECH'),
    ('Customer Service', 'CS'),
    ('Operations Staff', 'OPS'),
    ('Maintenance Staff', 'MAINT')
ON CONFLICT (role_code) DO NOTHING;

 */
