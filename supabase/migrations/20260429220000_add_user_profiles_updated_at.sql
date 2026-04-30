-- Add updated_at to user_profiles to support the sync_user_permissions RPC
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Fix TCL DELETE Policy to allow Editors (Idempotent)
DROP POLICY IF EXISTS "tcl DELETE" ON public.task_context_links;

CREATE POLICY "tcl DELETE" ON public.task_context_links
FOR DELETE USING (
    (source_type = 'task' AND (
        public.get_user_permission_level(public.get_task_vertical_id(source_id)) IN ('editor', 'admin')
        OR public.get_task_assigned_to(source_id) = auth.uid()
    ))
    OR source_type = 'template'
);

-- Trigger schema reload
NOTIFY pgrst, 'reload schema';
