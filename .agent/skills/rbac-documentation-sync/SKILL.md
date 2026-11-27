---
name: RBAC Tooltip & Capability Sync
description: CRITICAL MANDATORY SKILL — Enforces ZERO DRIFT between actual RBAC/RLS/hierarchy/workflow permissions in code and what Master Admins see in RoleTooltip, UserEditorModal, and BoardRBACModal. MUST be triggered and completed whenever ANY RBAC, RLS, RPC auth, seniority, Maker-Checker, or role-guard change is made.
---

# RBAC Tooltip & Capability Sync (Zero-Drift Protocol)

> [!CAUTION]
> **HARD BLOCKING GATE:** An RBAC, RLS, hierarchy, or permission-guard change is **INCOMPLETE** if `src/constants/rbacCatalog.js` is not audited and updated in the **exact same change**. Master Admins rely on tooltips and notices in `UserEditorModal` and `BoardRBACModal` to know the exact access they are granting — stale or generic tooltips are a security & operational defect.

---

## 1. Mandatory Trigger Conditions
You **MUST** run this protocol before completing ANY task that touches:
1. **Frontend RBAC / Role Logic:** `src/hooks/useRBAC.js`, `src/constants/roles.js`, `src/constants/verticalFeatures.js`, `src/features/task-board/hooks/useTaskPermissions.js`.
2. **Hierarchy / Sphere of Influence / Scoping:** `src/services/rules/hierarchyService.js`, `src/hooks/useAttendanceBoard.js`, `src/verticals/Employees/EmployeeManagement.jsx`, or any query/filter checking `seniority`, `reporteeEmployeeIds`, or `employeeId`.
3. **Approval / Maker-Checker / Workflow Gates:** `src/services/employees/employeeRequestService.js`, `src/services/employees/unmarkedAttendanceTaskService.js`, `src/verticals/Employees/attendance/LiveAttendanceTab.jsx`, `EmployeeForm.jsx`, etc.
4. **Component UI Guards:** Any component adding/changing checks on `permissions.can*`, `permissions.level`, `permissions.scope`, `permissions.canAccessConfig`, `permissions.canManageRoles`, or `user.roleId === 'master_admin'`.
5. **Backend Authorization:** Any Supabase migration (`supabase/migrations/*.sql`) adding or altering an RLS policy or a `SECURITY DEFINER` RPC's role/hierarchy/permission check.
6. **Board RBAC Entry Points:** Any new or renamed `<RBACManageButton label="..." />` or `<BoardRBACModal titleLabel="..." />` (in sidebars or board headers).

---

## 2. Single Source of Truth Architecture
All human-readable RBAC descriptions live in **one file**:
- **`src/constants/rbacCatalog.js`**
  - `SCOPE_ACCESS` — Step 1 (`Master` vs `Vertical`) cards in `UserEditorModal.jsx`.
  - `LEVEL_CARD_ACCESS` — Step 2 (`Viewer` / `Contributor` / `Editor` / `Admin`) ceiling cards when Scope = `Vertical`.
  - `MASTER_ROLE_ACCESS` — Step 2 tooltips AND the live Master Scope notice banner in `UserEditorModal.jsx` when Scope = `Master`.
  - `RAW_CONTEXT` — Per-vertical and per-feature `none / viewer / contributor / editor / admin` capabilities (`can[]`, `cannot[]`, `summary`).
  - `CONTEXT_ALIASES` & `normalizeContextName()` — Maps every DB label, sidebar label, and `RBACManageButton` `label` to its canonical `RAW_CONTEXT` key.

**Consumers (NEVER duplicate copy in these files):**
- `src/components/ui/RoleTooltip.jsx` (used by `UserEditorModal.jsx` and `BoardRBACModal.jsx`)
- `src/components/users/UserEditorModal.jsx` (Step 1, Step 2, Step 3, and Master Scope notice)

---

## 3. Step-by-Step Sync Protocol

### Step A — Classify What Changed
Identify every role/scope affected by your code change:
- Does it affect a **specific feature** (e.g., `Attendance Board`, `Employees List`, `Current Attendance`, `Remarks Manager`, `Rules & Regulations`, `Hub Tasks Board`, `Escalation Task Board`)?
- Does it affect a **parent vertical** (`Employees`, `Hubs`)?
- Does it affect **Master roles** (`master_viewer`, `master_contributor`, `master_editor`, `master_admin`) or **Master Admin-only overrides**?
- Does it affect **Step 1 (Scope)** or **Step 2 (Capability Level ceiling)** rules?
- Does it introduce a **conditional rule** (e.g., Sphere of Influence `Seniority ≤ 6`, downward reporting tree, upward reporting manager, Maker-Checker separation, self-only restriction, approval requirement)?

### Step B — Update `src/constants/rbacCatalog.js`
1. Update the affected feature entry in `RAW_CONTEXT` (both `can` and `cannot` arrays + `summary`) so the wording reflects **exact code reality** — never aspirational or generic CRUD text.
2. Update the parent vertical entry in `RAW_CONTEXT` if the change alters vertical-level behavior or configuration access.
3. Update `MASTER_ROLE_ACCESS` (and `LEVEL_CARD_ACCESS` / `SCOPE_ACCESS` if applicable) whenever a Master role gains, loses, or uniquely holds an override (e.g., Force Checkout, direct bank update, immediate deactivation, document delete, orphan task visibility, self-approval bypass).
4. **Locked Verticals/Features Rule:** Do NOT touch locked verticals (`CLIENTS`, `PARTNERS`, `VENDORS`, `DATA_MANAGER`) or locked features (`Leave Manager`, `Daily Task Board`, `Daily Task Templates`) until explicitly unlocked.

### Step C — Verify Label Normalization (Zero Generic Fallbacks)
If you added or renamed any `<RBACManageButton label="..." />`, `<BoardRBACModal titleLabel="..." />`, or vertical/feature label in `src/constants/verticals.js` or `src/constants/verticalFeatures.js`:
1. Confirm `normalizeContextName(label)` in `src/constants/rbacCatalog.js` resolves to an existing key in `RAW_CONTEXT`.
2. If not, add the lowercase alias to `CONTEXT_ALIASES` in `src/constants/rbacCatalog.js`.
3. Never allow an unlocked board or vertical to silently fall back to `GENERIC_ACCESS`.

---

## 4. Mandatory Pre-Completion Checklist
Before reporting any RBAC-related task as complete, confirm every box:
- [ ] Every changed role level (`none`, `viewer`, `contributor`, `editor`, `admin`) in `src/constants/rbacCatalog.js` matches the exact frontend guard AND backend RLS/RPC logic.
- [ ] Every Master Admin-only override or Master Editor/Contributor/Viewer distinction is reflected in `MASTER_ROLE_ACCESS`.
- [ ] Every conditional scope (self-only, downward reporting tree, upward reporting manager, Sphere of Influence `Seniority ≤ 6`, Maker-Checker separation) is explicitly stated in the corresponding tooltip.
- [ ] All `RBACManageButton` / `BoardRBACModal` labels resolve via `normalizeContextName()` with zero generic fallbacks.
- [ ] `npm run build` succeeds with zero errors.
