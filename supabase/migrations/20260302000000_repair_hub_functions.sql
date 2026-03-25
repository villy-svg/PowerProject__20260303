/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Repair Hub Functions (Splitting from tasks to ensure it runs now)
DO $$
BEGIN
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
END $$;

 */
