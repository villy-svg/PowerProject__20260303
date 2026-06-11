# Attendance Board — Master Runbook Index

## Overview

This folder contains a fully phased, sequentially ordered set of runbooks for implementing the **Attendance Board MVP** inside PowerProject. Each runbook is self-contained and written so any low-context model or developer can execute it from start to finish without guessing.

---

## ✅ What Already Exists (DO NOT RECREATE)

Before starting, validate the following are already in place:

| Artifact | Status | Notes |
|---|---|---|
| `employees` table | ✅ Exists | `src/verticals/Employees/` vertical is live |
| `user_profiles` table | ✅ Exists | With `role_id`, `employee_id` linkage |
| `hubs` table | ✅ Exists | Hub selector data source |
| `EmployeeAttendanceBoard.jsx` | ✅ Exists (stub) | Empty placeholder in `src/verticals/Employees/` |
| `EmployeeAttendanceBoard.css` | ✅ Exists (stub) | Empty placeholder |
| Sub-sidebar nav button | ✅ Exists | Already in `EmployeeSubSidebar.jsx` |
| RBAC flag `canAccessEmployeeAttendanceBoard` | ✅ Exists | Already in `verticalFeatures.js` + `useRBAC.js` |
| ContentRouter routing | ✅ Exists | `activeVertical === 'employee_attendance_board'` already handled |
| Supabase client | ✅ Exists | `src/services/core/supabaseClient.js` |
| `MasterPageHeader` component | ✅ Exists | Imported from `src/components/MasterPageHeader` |
| RBAC system (`useRBAC.js`) | ✅ Exists | Fully wired, master + vertical scopes |
| Migration baseline | ✅ Exists | 31 migration files, last: `20260608181500` |
| `@capacitor/geolocation` capability | ✅ Confirmed | Previously investigated |

**Key Insight:** The navigation shell, RBAC flags, and board stub are all wired. Phases 1-3 are purely additive (new tables, new services). The UI stub just needs to be replaced with real content — no routing changes needed.

---

## Architecture Decisions & Recommendations

### Recommendation 1: Attendance as a Dedicated Management View

> **Decision**: The Attendance Board is NOT a standard task board. It is a **Management View** (like `hub_management`, `department_management`).

**Action Required**: Add `'employee_attendance_board'` to the `MANAGEMENT_VIEWS` array in `useLayoutShell.js`. This prevents the Shell Architecture from wrapping it in `VerticalWorkspace` when the Phase 3 shell upgrade occurs.

---

### Recommendation 2: JSONB `session_logs_data` Column

The `session_logs_data` JSONB column stores an array of session objects. This provisions for future "multi-hub auto-checkout" without requiring a schema migration. Each object shape:

```json
[
  {
    "hub_id": "uuid",
    "login_time": "ISO timestamp",
    "logout_time": "ISO timestamp | null",
    "device_id": "string",
    "login_geolocation": { "lat": 0.0, "lng": 0.0, "accuracy": 10 },
    "logout_geolocation": { "lat": 0.0, "lng": 0.0, "accuracy": 10 }
  }
]
```

---

### Recommendation 3: Feature-Specific RBAC Flags

Extend the existing `canAccessEmployeeAttendanceBoard` to also add:
- `canManageAttendanceApprovals` — gate the Editor's approval drawer
- `canSubmitAttendanceEdits` — gate the Contributor "Suggest Edit" flow

These are derived from the standard RBAC level (contributor vs editor vs admin) and don't require new DB columns.

---

### Recommendation 4: WhatsApp Share via Web Share API + Deep Link Fallback

The receipt screen should use:
```javascript
// Primary: Web Share API (supported in Chrome Android, Safari iOS)
if (navigator.share) { navigator.share({ text: formattedText }); }
// Fallback: WhatsApp deep link
else { window.open(`https://wa.me/?text=${encodeURIComponent(formattedText)}`); }
```

---

### Recommendation 5: Employee-Side UI as a Separate Route

The Employee Self-Service (check-in/out) screen should be a **separate page** (e.g., `activeVertical === 'attendance_self_service'`) to avoid role-confusion on the Manager Board. Employees see a clean, single-action screen; managers see the grid.

---

## Phase → Runbook Mapping

| Phase | Runbook | File | Status |
|---|---|---|---|
| **Phase 1: Database** | | | |
| | 1.1 Schema & Migration — Two New Tables | [01_DATABASE_SCHEMA.md](./01_DATABASE_SCHEMA.md) | ☐ |
| | 1.2 RLS Policies | [02_RLS_POLICIES.md](./02_RLS_POLICIES.md) | ☐ |
| **Phase 2: Backend Services** | | | |
| | 2.1 Attendance Service (check-in / check-out) | [03_ATTENDANCE_SERVICE.md](./03_ATTENDANCE_SERVICE.md) | ☐ |
| | 2.2 Edit Request Service (Maker-Checker) | [04_EDIT_REQUEST_SERVICE.md](./04_EDIT_REQUEST_SERVICE.md) | ☐ |
| | 2.3 React Hooks | [05_REACT_HOOKS.md](./05_REACT_HOOKS.md) | ☐ |
| **Phase 3: Manager Board UI** | | | |
| | 3.1 Board Shell & Header | [06_BOARD_SHELL.md](./06_BOARD_SHELL.md) | ☐ |
| | 3.2 Attendance Grid Component | [07_ATTENDANCE_GRID.md](./07_ATTENDANCE_GRID.md) | ☐ |
| | 3.3 Approval Drawer (Editor) | [08_APPROVAL_DRAWER.md](./08_APPROVAL_DRAWER.md) | ☐ |
| | 3.4 Suggest Edit Modal (Contributor) | [09_SUGGEST_EDIT_MODAL.md](./09_SUGGEST_EDIT_MODAL.md) | ☐ |
| **Phase 4: Employee Self-Service UI** | | | |
| | 4.1 Self-Service Check-In/Out Screen | [10_SELF_SERVICE_UI.md](./10_SELF_SERVICE_UI.md) | ☐ |
| | 4.2 Receipt / WhatsApp Share Screen | [11_RECEIPT_SCREEN.md](./11_RECEIPT_SCREEN.md) | ☐ |
| **Phase 5: Wiring & RBAC Guards** | | | |
| | 5.1 Shell & Navigation Wiring | [12_SHELL_WIRING.md](./12_SHELL_WIRING.md) | ☐ |
| | 5.2 CSS Design System | [13_CSS_DESIGN_SYSTEM.md](./13_CSS_DESIGN_SYSTEM.md) | ☐ |

---

## Execution Rules

1. **Run phases in order.** Phase 2 services depend on Phase 1 tables existing.
2. **Each runbook is atomic.** Complete one before starting the next.
3. **Every runbook ends with a Validation Checklist.** Do NOT proceed until validation passes.
4. **Migration naming**: `YYYYMMDDHHMMSS_attendance_[description].sql`
5. **PostgreSQL Kick**: Every migration MUST end with `NOTIFY pgrst, 'reload schema';`
6. **Staging First**: Push to staging, validate, then merge to main for production.
7. **Skill Compliance**: Read required skills before modifying any existing file.
