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

## 5. Locked Verticals & Features
- **Hidden in User Management**: Locked verticals (`src/constants/verticals.js`) and locked features (`src/constants/verticalFeatures.js`) MUST NOT be shown in User Management UI (`UserEditorModal` / `UserList`).
- **Default `'none'`**: All locked verticals and locked features MUST default to and sync as `'none'`. Do NOT work on locked verticals/features until explicitly unlocked (see `locked-verticals-and-features.md`).

## 6. MANDATORY RBAC Tooltip & Capability Catalog Sync (CRITICAL — ZERO DRIFT)
- **Single Source of Truth**: `src/constants/rbacCatalog.js` is the **sole source of truth** for all RBAC tooltip copy (`RoleTooltip.jsx`), Master role capability summaries (`UserEditorModal.jsx`), and `BoardRBACModal` label aliases. NEVER hardcode permission descriptions directly inside UI components.
- **Blocking Pre-Completion Gate**: ANY change that adds, modifies, or removes:
  - A `useRBAC.js` flag or `roles.js` capability,
  - A frontend role/permission guard (`permissions.can*`, `user.roleId === 'master_admin'`, `canReview*`, `canMark*`, etc.),
  - A Sphere of Influence / seniority / reporting-tree visibility rule (`hierarchyService.js`, `useAttendanceBoard.js`, etc.),
  - A Maker-Checker or approval workflow (`employeeRequestService.js`, `unmarkedAttendanceTaskService.js`, etc.),
  - A Supabase RLS policy or `SECURITY DEFINER` RPC authorization check, or
  - A new `RBACManageButton` / `BoardRBACModal` `label` or `titleLabel`
  **MUST** update `src/constants/rbacCatalog.js` in the **same change** before the task is considered complete.
- **No Silent Generic Fallbacks**: Every `label` / `titleLabel` passed to `RBACManageButton` or `BoardRBACModal` MUST resolve to a canonical key in `RAW_CONTEXT` (via `CONTEXT_ALIASES` / `normalizeContextName()`).
- **Mandatory Skill**: Before finishing any RBAC-touching task, follow `.agent/skills/rbac-documentation-sync/SKILL.md`.
