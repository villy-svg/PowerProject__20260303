# Locked Verticals & Features Policy

**MANDATORY RULE**: Certain verticals and features are intentionally **locked and disabled** until the user explicitly requests unlocking and building them.

## 1. Source of Truth
- **Locked Verticals**: `LOCKED_VERTICAL_OVERRIDES` and `locked: true` in `src/constants/verticals.js` (currently: `CLIENTS`, `PARTNERS`, `VENDORS`, `DATA_MANAGER`).
- **Locked Features**: `locked: true` on items in `EMPLOYEE_NAV_ITEMS`, `HUB_NAV_ITEMS`, and `VERTICAL_FEATURES` in `src/constants/verticalFeatures.js` (currently: Leave Manager `employee_leave_wallet` / `canAccessEmployeeLeaveWallet`, Daily Task Board `daily_hub_tasks` / `canAccessDailyHubTasks`, Daily Task Templates `daily_task_templates` / `canAccessDailyTaskTemplates`).

## 2. Do NOT Work on Locked Scope
- **ZERO development time** may be spent refactoring, styling, debugging, auditing, or building features inside locked verticals or locked features unless the user explicitly asks to unlock them.
- During global refactors, audits, or UI sweeps, skip locked verticals/features (except when enforcing lock guards or fixing a shared build error).

## 3. User Management & RBAC Defaults (STRICT)
- **Hide from User Management UI**: Locked verticals and locked features MUST NOT be displayed in `UserEditorModal` or vertical summary badges in `UserList`.
- **Default to `'none'`**:
  - Locked verticals MUST NEVER be granted in `vertical_access` (`handleSyncPermissions` skips locked verticals so they remain `'none'`).
  - Locked features inside unlocked verticals MUST always default to and sync as `'none'` in `feature_access` (`getDefaultFeatures` + `handleSyncPermissions`).
- **Navigation Guards**: Locked verticals and features remain visibly disabled with `<IconLock />` in sidebars/switchers and redirected by `ContentRouter.jsx`.
