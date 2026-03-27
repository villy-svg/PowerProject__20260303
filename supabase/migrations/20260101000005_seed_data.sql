-- =========================================================================
-- POWERPROJECT: 5/6 — SEED DATA
-- RBAC roles, verticals, and employee-profile backfill. Idempotent.
-- =========================================================================

-- RBAC Role Permissions
INSERT INTO public.role_permissions (role_id, permissions) VALUES
('master_admin', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true, "canAccessConfig": true, "canManageRoles": true, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_editor', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_contributor', '{"canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('master_viewer', '{"canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false, "canAccessEmployees": true, "canAccessEmployeeTasks": false, "canAccessHubTasks": true}'),
('vertical_admin', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": true, "canAccessConfig": true, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_editor', '{"canCreate": true, "canRead": true, "canUpdate": true, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_contributor', '{"canCreate": true, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": true, "canAccessLeadsFunnel": true, "canAccessEmployees": true, "canAccessEmployeeTasks": true, "canAccessHubTasks": true}'),
('vertical_viewer', '{"canCreate": false, "canRead": true, "canUpdate": false, "canDelete": false, "canAccessConfig": false, "canManageRoles": false, "canAccessClients": true, "canAccessClientTasks": false, "canAccessLeadsFunnel": false, "canAccessEmployees": true, "canAccessEmployeeTasks": false, "canAccessHubTasks": true}')
ON CONFLICT (role_id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Verticals
INSERT INTO public.verticals (id, label, "order", locked) VALUES
('CHARGING_HUBS', 'Hub Manager', 1, false),
('CLIENTS', 'Client Manager', 2, false),
('EMPLOYEES', 'Employee Manager', 3, false),
('PARTNERS', 'Partner Manager', 4, true),
('VENDORS', 'Vendor Manager', 5, true),
('DATA_MANAGER', 'Data Manager', 6, true)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

-- Backfill: Link user profiles to employees by email
UPDATE public.user_profiles up SET employee_id = e.id
FROM public.employees e
WHERE LOWER(up.email) = LOWER(e.email) AND up.employee_id IS NULL;
