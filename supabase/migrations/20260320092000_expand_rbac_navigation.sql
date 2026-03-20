-- Migration: Add role_permissions table and navigation flags
-- Description: Moves role capability definitions to the database and adds granular navigation access flags.

-- 1. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id text PRIMARY KEY,
    permissions jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- SELECT: All authenticated users can read permissions
DROP POLICY IF EXISTS "Permit SELECT for all users" ON public.role_permissions;
CREATE POLICY "Permit SELECT for all users" ON public.role_permissions
FOR SELECT TO authenticated USING (true);

-- ALL: Only master_admin can modify role definitions
DROP POLICY IF EXISTS "Permit ALL for master_admin" ON public.role_permissions;
CREATE POLICY "Permit ALL for master_admin" ON public.role_permissions
FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role_id = 'master_admin'
    )
);

-- 4. Seed initial permissions with new navigation flags
INSERT INTO public.role_permissions (role_id, permissions) VALUES
('master_admin', '{
    "canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true,
    "canAccessConfig": true, "canManageRoles": true,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('master_editor', '{
    "canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('master_contributor', '{
    "canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('master_viewer', '{
    "canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false,
    "canAccessEmployees": true, "canAccessEmployeeTasks": false,
    "canAccessHubTasks": true
}'),
('vertical_admin', '{
    "canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true,
    "canAccessConfig": true, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('vertical_editor', '{
    "canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('vertical_contributor', '{
    "canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true,
    "canAccessEmployees": true, "canAccessEmployeeTasks": true,
    "canAccessHubTasks": true
}'),
('vertical_viewer', '{
    "canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false,
    "canAccessConfig": false, "canManageRoles": false,
    "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false,
    "canAccessEmployees": true, "canAccessEmployeeTasks": false,
    "canAccessHubTasks": true
}')
ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;
