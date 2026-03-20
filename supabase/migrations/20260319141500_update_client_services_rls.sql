-- ==========================================
-- ENABLE RLS FOR CLIENT SERVICES TABLE
-- ==========================================

-- 1. Enable RLS
ALTER TABLE public.client_services ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies (if any) to avoid conflicts
DROP POLICY IF EXISTS "Permit SELECT based on role" ON public.client_services;
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.client_services;
DROP POLICY IF EXISTS "Permit UPDATE based on role" ON public.client_services;
DROP POLICY IF EXISTS "Permit DELETE based on role" ON public.client_services;

-- 3. Define Policies based on CLIENTS vertical permissions

-- SELECT: Viewer, Contributor, Editor, Admin
CREATE POLICY "Permit SELECT based on role" ON public.client_services 
FOR SELECT USING (public.get_user_permission_level('CLIENTS') IN ('viewer', 'contributor', 'editor', 'admin'));

-- INSERT: Contributor, Editor, Admin
CREATE POLICY "Permit INSERT based on role" ON public.client_services 
FOR INSERT WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('contributor', 'editor', 'admin'));

-- UPDATE: Editor, Admin
CREATE POLICY "Permit UPDATE based on role" ON public.client_services 
FOR UPDATE USING (public.get_user_permission_level('CLIENTS') IN ('editor', 'admin')) 
WITH CHECK (public.get_user_permission_level('CLIENTS') IN ('editor', 'admin'));

-- DELETE: Admin ONLY
CREATE POLICY "Permit DELETE based on role" ON public.client_services 
FOR DELETE USING (public.get_user_permission_level('CLIENTS') = 'admin');

-- ==========================================
-- VERIFICATION
-- ==========================================
-- SELECT public.get_user_permission_level('CLIENTS');
