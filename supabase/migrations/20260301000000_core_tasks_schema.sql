-- Core Schema Repair (Unified Base Schema for Staging/Production Alignment)
DO $$
BEGIN
    -- 1. Create hubs if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hubs') THEN
        CREATE TABLE public.hubs (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            hub_code text UNIQUE,
            city text,
            status text DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'SUCCESS: Table public.hubs created.';
    ELSE
        RAISE NOTICE 'INFO: Table public.hubs already exists.';
    END IF;

    -- 2. Create departments if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'departments') THEN
        CREATE TABLE public.departments (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            dept_code text UNIQUE,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'SUCCESS: Table public.departments created.';
    ELSE
        RAISE NOTICE 'INFO: Table public.departments already exists.';
    END IF;

    -- 3. Create employees if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
        CREATE TABLE public.employees (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            full_name text NOT NULL,
            email text,
            phone text,
            gender text CHECK (gender IN ('Male', 'Female', 'Other', 'Prefer not to say')),
            dob date,
            hire_date date,
            hub_id uuid REFERENCES public.hubs(id),
            role_id uuid,
            department_id uuid REFERENCES public.departments(id),
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
        RAISE NOTICE 'SUCCESS: Table public.employees created.';
    ELSE
        RAISE NOTICE 'INFO: Table public.employees already exists.';
    END IF;

    -- 4. Create hub_functions if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hub_functions') THEN
        CREATE TABLE public.hub_functions (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            function_code text UNIQUE,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        RAISE NOTICE 'SUCCESS: Table public.hub_functions created.';
    ELSE
        RAISE NOTICE 'INFO: Table public.hub_functions already exists.';
    END IF;

    -- 5. Create tasks if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        CREATE TABLE public.tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            text TEXT NOT NULL,
            description TEXT,
            verticalid TEXT,
            stageid TEXT,
            priority TEXT,
            hub_id UUID REFERENCES public.hubs(id),
            city TEXT,
            function TEXT,
            assigned_to UUID REFERENCES public.employees(id),
            parent_task UUID REFERENCES public.tasks(id),
            created_by UUID,
            last_updated_by UUID,
            createdat TIMESTAMPTZ DEFAULT now(),
            updatedat TIMESTAMPTZ DEFAULT now()
        );
        RAISE NOTICE 'SUCCESS: Table public.tasks created.';
    ELSE
        RAISE NOTICE 'INFO: Table public.tasks already exists.';
    END IF;
END $$;
