/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Fix: Restore canManageRoles for master_admin
UPDATE public.role_permissions
SET permissions = permissions || '{"canManageRoles": true}'::jsonb
WHERE role_id = 'master_admin';

 */
