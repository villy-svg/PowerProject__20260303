/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Migration script for hubs table
-- Run this in Supabase SQL editor if table doesn't exist

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'hubs'
    ) THEN
        CREATE TABLE public.hubs (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            name text NOT NULL,
            hub_code text UNIQUE,
            city text,
            status text DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz DEFAULT now()
        );
        
        CREATE INDEX idx_hubs_hub_code ON public.hubs(hub_code);
        CREATE INDEX idx_hubs_status ON public.hubs(status);
        
        INSERT INTO public.hubs (name, hub_code, city, status) VALUES
            ('Downtown Fast Chargers', 'DTN-01', '123 Main St, NY', 'active'),
            ('Suburban Hub', 'SUB-02', '456 Oak Ave, NJ', 'maintenance'),
            ('Airport Station', 'AIR-01', 'JFK International, NY', 'active')
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Hubs table created successfully';
    ELSE
        RAISE NOTICE 'Hubs table already exists';
    END IF;
END $$;

 */
