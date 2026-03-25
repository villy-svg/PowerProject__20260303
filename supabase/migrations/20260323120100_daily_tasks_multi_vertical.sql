/* SUPERSEDED BY MASTER MIGRATION (20260315000000_unified_master_init.sql) 
-- Migration: Add vertical_id to daily_tasks and update RLS to be dynamic
-- Date: 2026-03-23

--------------------------------------------------------------------------------
-- 1. Add Column and Populate
--------------------------------------------------------------------------------
ALTER TABLE public.daily_tasks ADD COLUMN IF NOT EXISTS vertical_id TEXT;

-- For existing rows (from our recent testing), default to CHARGING_HUBS
UPDATE public.daily_tasks SET vertical_id = 'CHARGING_HUBS' WHERE vertical_id IS NULL;

-- Make it mandatory for future rows
ALTER TABLE public.daily_tasks ALTER COLUMN vertical_id SET NOT NULL;

--------------------------------------------------------------------------------
-- 2. Update Dynamic Row Level Security (RLS)
--------------------------------------------------------------------------------
-- We drop the static vertical-locked policies and replace them with ones that 
-- look up permissions based on the vertical_id stored IN THE ROW.

DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.daily_tasks;
DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.daily_tasks;

-- SELECT: All roles with access to the vertical specified in the row
CREATE POLICY "Permit SELECT based on role" ON public.daily_tasks 
FOR SELECT USING (public.get_user_permission_level(vertical_id) IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor and above for the vertical being inserted
-- Note: vertical_id must be provided during insert for this check to work.
CREATE POLICY "Permit INSERT based on role" ON public.daily_tasks 
FOR INSERT WITH CHECK (public.get_user_permission_level(vertical_id) IN ('contributor', 'editor', 'admin'));

-- UPDATE: Editor and above
CREATE POLICY "Permit UPDATE based on role" ON public.daily_tasks 
FOR UPDATE USING (public.get_user_permission_level(vertical_id) IN ('editor', 'admin'))
WITH CHECK (public.get_user_permission_level(vertical_id) IN ('editor', 'admin'));

-- DELETE: Admin only
CREATE POLICY "Permit DELETE based on role" ON public.daily_tasks 
FOR DELETE USING (public.get_user_permission_level(vertical_id) = 'admin');

 */
