-- Create hub_functions table
CREATE TABLE IF NOT EXISTS public.hub_functions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    function_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_hub_functions_function_code ON public.hub_functions(function_code);

-- Insert sample data
INSERT INTO public.hub_functions (name, function_code) VALUES
    ('Operations', 'OPS'),
    ('Maintenance', 'MAINT'),
    ('Customer Service', 'CS'),
    ('Technical Support', 'TECH'),
    ('Facility Management', 'FAC')
ON CONFLICT (function_code) DO NOTHING;
