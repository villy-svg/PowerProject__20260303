-- Core Schema Repair (Explicitly creating missing tables for Staging)
DO $$
BEGIN
    -- 1. Create hub_functions if missing
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

    -- 2. Create tasks if missing
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
        CREATE TABLE public.tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            text TEXT NOT NULL,
            description TEXT,
            verticalid TEXT,
            stageid TEXT,
            priority TEXT,
            hub_id UUID,
            city TEXT,
            function TEXT,
            assigned_to UUID,
            parent_task UUID,
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

-- Note: RLS policies will be enabled by later migrations that already exist.
