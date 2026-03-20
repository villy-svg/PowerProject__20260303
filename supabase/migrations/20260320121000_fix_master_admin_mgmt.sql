-- Fix: Restore canManageRoles for master_admin
UPDATE public.role_permissions
SET permissions = permissions || '{"canManageRoles": true}'::jsonb
WHERE role_id = 'master_admin';
