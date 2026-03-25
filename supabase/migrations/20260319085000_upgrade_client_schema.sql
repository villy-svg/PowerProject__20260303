/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Upgrade Client Categories to support VEHICLE vs SERVICE types
ALTER TABLE IF EXISTS public.client_categories 
ADD COLUMN IF NOT EXISTS category_type text DEFAULT 'VEHICLE' CHECK (category_type IN ('VEHICLE', 'SERVICE'));

-- Add matrix storage for clients to store selections without a join table temporarily
ALTER TABLE IF EXISTS public.clients
ADD COLUMN IF NOT EXISTS category_matrix jsonb DEFAULT '{}';

-- Seed initial Service Categories
INSERT INTO public.client_categories (name, code, category_type, description) 
VALUES 
    ('Full Maintenance', 'MAINT', 'SERVICE', 'Complete vehicle maintenance service'),
    ('Annual Maintenance Contract', 'AMC', 'SERVICE', 'AMC based servicing'),
    ('Breakdown Support', 'BD', 'SERVICE', 'Emergency breakdown services'),
    ('General Checkup', 'GC', 'SERVICE', 'Routine vehicle checkups')
ON CONFLICT (id) DO NOTHING; -- Assuming id is PK and name/code might not be unique in some schemas, but usually we want to avoid duplicates.
-- Better to use a unique constraint check if we had one.

-- Update RLS (Policies already cover the tables, so no changes needed there if they use get_user_permission_level)

 */
