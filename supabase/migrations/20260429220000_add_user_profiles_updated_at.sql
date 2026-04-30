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

-- 3. FIX SECURITY AUDIT LOG CONSTRAINTS (Idempotent Repair)
-- Relaxes target_id and actor_id foreign keys to reference public.user_profiles instead of auth.users.
-- This prevents 409 Conflict sync failures when user records are slightly out of sync.
ALTER TABLE public.security_audit_logs 
    DROP CONSTRAINT IF EXISTS security_audit_logs_actor_id_fkey,
    DROP CONSTRAINT IF EXISTS security_audit_logs_target_id_fkey;

ALTER TABLE public.security_audit_logs
    ADD CONSTRAINT security_audit_logs_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.security_audit_logs
    ADD CONSTRAINT security_audit_logs_target_id_fkey 
    FOREIGN KEY (target_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Trigger schema reload
NOTIFY pgrst, 'reload schema';
