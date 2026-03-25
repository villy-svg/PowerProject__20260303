-- Core Tasks Schema (Reconstructed from application services)
-- This migration fills the gap for the missing 'tasks' table in the automated setup.

CREATE TABLE IF NOT EXISTS public.tasks (
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

-- Note: RLS policies will be enabled by later migrations that already exist.
