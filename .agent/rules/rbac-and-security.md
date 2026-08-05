# RBAC & Hierarchy Security

Rules for ensuring data integrity, security, and proper access control across the application.

## 1. Database Row Level Security (RLS)
- **Mandatory RLS**: Row Level Security MUST be enabled on every Supabase table.
- **Policy Helper**: All policies MUST utilize the `public.get_user_permission_level(vertical_id)` helper function to evaluate Admin, Editor, Contributor, or Viewer roles.

## 2. Frontend Action Guards
- **Conditional Rendering**: Action buttons (Create, Update, Delete) MUST be conditionally rendered using the `permissions` object passed down from `App.jsx`.
- **Feature Flags**: Prefer feature-specific flags (e.g., `permissions.canCreateClients`) over generic vertical flags when gating UI elements.

## 3. Service Worker Prohibition (CRITICAL)
- **No Caching API Responses**: **NEVER** cache Supabase API responses (`.supabase.co`) or cold storage JSON blobs in the Service Worker.
- **Security Implication**: Caching user-specific data on the device can cause a direct RBAC breach if multiple users log into the same device. Use `NetworkOnly` for these routes.

## 4. Sphere of Influence (Hierarchy Gating)
- **Restricted Visibility**: Users with a seniority level `≤ 6` are restricted to viewing tasks they are assigned to, created by them, or created by someone in their downward reporting tree (`hierarchyUtils.getDescendants`).
- **Context Only Mode**: Parent tasks rendered solely to maintain tree structure (Kanban/Tree views) must be flagged with `isContextOnly: true` and forced to Read-Only, regardless of standard RBAC.
