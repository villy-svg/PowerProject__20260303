-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    dept_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_departments_dept_code ON public.departments(dept_code);

-- Insert sample data
INSERT INTO public.departments (name, dept_code) VALUES
    ('Engineering', 'ENG'),
    ('Operations', 'OPS'),
    ('Maintenance', 'MAINT'),
    ('Customer Service', 'CS'),
    ('Human Resources', 'HR'),
    ('Finance', 'FIN'),
    ('Technical Support', 'TECH')
ON CONFLICT (dept_code) DO NOTHING;
