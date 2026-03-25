-- Core Schema (Reconstructed from application services)
-- This migration fills the gaps in the automated setup for tables with broken timelines.

CREATE TABLE IF NOT EXISTS public.hub_functions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    function_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    description TEXT,
    verticalid TEXT,
    stageid TEXT,
    priority TEXT,
    hub_id UUID, -- References hubs(id)
    city TEXT,
    function TEXT,
    assigned_to UUID, -- References employees(id)
    parent_task UUID, -- References tasks(id)
    created_by UUID,
    last_updated_by UUID,
    createdat TIMESTAMPTZ DEFAULT now(),
    updatedat TIMESTAMPTZ DEFAULT now()
);

-- Note: RLS policies will be enabled by later migrations that already exist.
