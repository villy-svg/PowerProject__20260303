# Feature PRD/TRD — RBAC Tooltip Sync & Governance

- **Status:** `Implemented`
- **Created:** 2026-11-27
- **Last Updated:** 2026-11-27
- **Owner Session:** Antigravity session

---

## Phase 0 — Context & Objectives

### 0a. Core Objective
Master Admins currently have no reliable way to verify the exact effective permissions they are granting to a user: tooltips in `RoleTooltip.jsx` are incomplete or outdated, several modals silently fall back to generic text, Master Scope capabilities are not detailed, and mobile devices cannot hover. We will centralize all RBAC capability definitions into a single source of truth, sync all tooltips, add a live Effective Access Preview in `UserEditorModal`, build a standalone **Access Simulator** for Master Admins, and add workspace rules/skills to enforce keeping tooltips and the simulator updated on every future RBAC change.

### 0b. Success Metrics
- **Accuracy:** 100% of unlocked verticals (`Employees`, `Hubs`) and their unlocked features (`Employees List`, `Attendance Board`, `Current Attendance`, `Remarks Manager`, `Rules & Regulations`, `Hub Tasks Board`, `Escalation Task Board`) display code-verified capability descriptions in `RoleTooltip`, `UserEditorModal`, `BoardRBACModal`, and `AccessSimulator` (0 generic fallbacks).
- **Usability:** A Master Admin can inspect any user's exact live accesses (including `getMinLevel` intersections, Sphere of Influence, and special workflow rights) in ≤ 2 clicks from Configuration or User Management, on both Desktop and Mobile.
- **Governance:** A workspace rule and skill exist and explicitly mandate updating `src/constants/rbacCatalog.js` whenever RBAC/RLS/hierarchy logic changes.

### 0c. Out of Scope
- Modifying actual RLS policies, `useRBAC.js` enforcement logic, or database schema.
- Working on locked verticals (`CLIENTS`, `PARTNERS`, `VENDORS`, `DATA_MANAGER`) or locked features (`Leave Manager`, `Daily Task Board`, `Daily Task Templates`).
- Saving permissions directly from the Access Simulator (Simulator is strictly read-only / what-if; saving remains in `UserEditorModal` and `BoardRBACModal`).

---

## Phase 1 — Current State & Dependencies

### 1a. Technical Dependencies
- **Modified:**
  - `src/components/ui/RoleTooltip.jsx` (`@prod-critical`)
  - `src/components/users/UserEditorModal.jsx`
  - `src/components/users/UserManagement.jsx` (`@prod-critical`)
  - `src/components/workspaces/Configuration.jsx`
  - `src/app/routing/ContentRouter.jsx`, `src/app/contexts/AppNavigationContext.jsx`, `src/app/shells/useLayoutShell.js`, `src/App.jsx`
  - `.agent/rules/rbac-and-security.md`, `.agent/skills/rbac-security-system/SKILL.md`
- **New:**
  - `src/constants/rbacCatalog.js`
  - `src/components/users/EffectiveAccessSummary.jsx` & `EffectiveAccessSummary.css`
  - `src/components/users/AccessSimulator.jsx` & `AccessSimulator.css`
  - `.agent/skills/rbac-documentation-sync/SKILL.md`
- **Conflict Check (`docs/features/README.md`):** No overlap with any `Draft`, `In Review`, or `Approved` feature.

### 1b–1e. Product, Logical, Data & Security Dependencies
- **Data:** Read-only consumption of existing `userService.fetchUsers()` (`user_profiles`, `vertical_access`, `feature_access`, `employees`, `employee_roles`). No DB writes or schema changes.
- **Security (RBAC):** `AccessSimulator` is strictly gated to `permissions.canManageRoles` (`master_admin` only), matching `user_management` and `role_management`.

---

## Phase 2 — Proposed Options & Strategy
- **Recommended Strategy:**
  - Single Source of Truth (`src/constants/rbacCatalog.js`) consumed by `RoleTooltip`, `EffectiveAccessSummary`, and `AccessSimulator`.
  - Standalone `AccessSimulator` mounted at `activeVertical === 'access_simulator'`, accessible from Configuration → Master Admin Controls and User Management header, supporting both **Live User Inspection** and **What-If Sandbox** simulation.

---

## Phase 3 — Risks, Mitigation & Verification
- **Risk:** Label mismatch in `BoardRBACModal` (e.g., `'Charging Hubs'` vs `'Hubs'`). **Mitigation:** Central `normalizeContextName()` helper in `rbacCatalog.js`.
- **Risk:** Inline styles or breaking `@prod-critical` `RoleTooltip`. **Mitigation:** Keep existing `RoleTooltip` prop contract intact; use external CSS with design system tokens only.
- **Rollback:** Frontend-only change; fully reversible via `git revert` with zero data loss.

---

## Implementation Notes (2026-11-27)
- **Scope Change:** Per user direction, the standalone **Access Simulator** was scrapped/deferred (user has an alternative approach in mind).
- **Implemented:**
  1. Created single source of truth `src/constants/rbacCatalog.js` containing `ROLE_BASE`, `SCOPE_ACCESS`, `LEVEL_CARD_ACCESS`, `MASTER_ROLE_ACCESS`, `RAW_CONTEXT`, `GENERIC_ACCESS`, `CONTEXT_ALIASES`, `normalizeContextName()`, and `resolveTooltipContent()`.
  2. Refactored `src/components/ui/RoleTooltip.jsx` and `src/components/ui/RoleTooltip.css` to consume `rbacCatalog.js`, support `tooltipType` (`role` | `scope` | `level` | `master`) and `fullWidth`, and fix silent generic fallbacks (e.g., `'Charging Hubs'` in `HubManagement` / `MobileSidebar` / `DesktopSidebar`).
  3. Updated `src/components/users/UserEditorModal.jsx` and `src/components/users/UserManagement.css` to add tooltips to Step 1 (Scope) & Step 2 (Capability Level / Master Role) cards and replace the static Master Scope banner with a dynamic capability breakdown from `MASTER_ROLE_ACCESS[roleLevel]`.
  4. Added mandatory zero-drift governance in `.agent/rules/rbac-and-security.md` (§6), created `.agent/skills/rbac-documentation-sync/SKILL.md`, and updated `.agent/skills/rbac-security-system/SKILL.md` (§6).
