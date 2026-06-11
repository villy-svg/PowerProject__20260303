# Phase 5.1 — Shell & Navigation Wiring

## Skills Required (Read Before Starting)
- `board-creation-guide` — Full checklist for adding new routes
- `shell-architecture-system` — `MANAGEMENT_VIEWS` array classification
- `safe-code-modification` §1B (Additive imports only — never remove existing)
- `development-best-practices` §4 (Colocation architecture — import from `attendance/` subdirectory)
- `rbac-security-system` §2 + §3 (RBAC flags already exist — verify before adding)

---

## Objective

Wire up the new `AttendanceSelfService` component into the app's routing and navigation system. This phase involves **small, targeted edits to existing files** — never wholesale rewrites.

**Critical Rule**: ALL edits to existing files in this phase must use `replace_file_content` or `multi_replace_file_content` tools with precise line targeting. Do NOT rewrite entire files.

---

## What Already Exists (DO NOT REDO)

| Item | Status | Notes |
|---|---|---|
| Nav button in `EmployeeSubSidebar.jsx` | ✅ Done | Button for `employee_attendance_board` exists |
| ContentRouter route for `employee_attendance_board` | ✅ Done | Already renders `<EmployeeAttendanceBoard>` |
| RBAC flag `canAccessEmployeeAttendanceBoard` | ✅ Done | In `verticalFeatures.js` + `useRBAC.js` |
| `EmployeeAttendanceBoard` import in `ContentRouter.jsx` | ✅ Done | Already imported |
| `EmployeeAttendanceBoard` barrel export | ❌ Missing | Not in `index.js` yet |

---

## Step 1: Add `AttendanceSelfService` to `ContentRouter.jsx`

**File to modify:** `src/app/shells/ContentRouter.jsx`

### 1a. Add the import (additive only — line ~32 area, after Employees imports)

```diff
 import {
   EmployeeManagement, DepartmentManagement, EmployeeRoleManagement,
-  EmployeeRulesBoard, EmployeeAttendanceBoard, RuleManagement,
+  EmployeeRulesBoard, EmployeeAttendanceBoard, RuleManagement, AttendanceSelfService,
 } from '../../verticals/Employees';
```

> **Note**: `AttendanceSelfService` must be exported from the Employees `index.js` barrel first (Step 3).

### 1b. Add the route (additive only — add before the final VerticalWorkspace return)

After the `rule_management` block (around line 183), add:

```jsx
  if (activeVertical === 'attendance_self_service') {
    return (
      <AttendanceSelfService
        user={user}
      />
    );
  }
```

---

## Step 2: Add `attendance_self_service` to `MANAGEMENT_VIEWS`

**File to modify:** `src/app/shells/useLayoutShell.js`

**Why**: The self-service screen is a dedicated management view (not a task board). Adding it to `MANAGEMENT_VIEWS` ensures the Shell Architecture uses the correct wrapper — per `board-creation-guide §4` and `shell-architecture-system`.

Add `'attendance_self_service'` to the `MANAGEMENT_VIEWS` array (around line 24):

```diff
 const MANAGEMENT_VIEWS = [
   'configuration',
   'role_management',
   ...
   'tutorial',
+  'employee_attendance_board',  // Manager board is a management view, not a task board
+  'attendance_self_service',    // Employee self-service check-in/out screen
 ];
```

---

## Step 3: Add Barrel Exports to `index.js`

**File to modify:** `src/verticals/Employees/index.js`

**Additive only** — append these exports at the end of the file. Do NOT remove any existing lines.

```javascript
// Attendance Board sub-components (Phase 4+)
export { default as EmployeeAttendanceBoard } from './EmployeeAttendanceBoard';
export { default as AttendanceSelfService } from './attendance/AttendanceSelfService';
```

> **Note**: The `EmployeeAttendanceBoard` is already imported directly in `ContentRouter.jsx` from the barrel. This export maintains consistency but does not break existing imports.

---

## Step 4: Add Self-Service Nav Button to `EmployeeSubSidebar.jsx`

**File to modify:** `src/verticals/Employees/EmployeeSubSidebar.jsx`

Add a new nav button after the existing Attendance Board button (around line 142). The guard is optional for MVP — all employee-linked users should access self-service.

```jsx
          {/* Employee Self-Service button — for employees to log their own shifts */}
          <div className="employee-tasks-btn-wrapper">
            <button
              className="halo-button employee-tasks-nav-btn"
              style={{ opacity: activeVertical === 'attendance_self_service' ? 1 : 0.7 }}
              onClick={() => setActiveVertical('attendance_self_service')}
            >
              My Attendance
            </button>
          </div>
```

> **Note**: `style={{ opacity: ... }}` is intentional dynamic inline style (as is the existing pattern in this file). This is the established convention for the active state in `EmployeeSubSidebar.jsx` — do NOT move it to CSS.

---

## Step 5: Add RBAC Flag for Self-Service (Optional for MVP)

The self-service screen doesn't need a gating RBAC flag for MVP — any employee with access to the Employees vertical should be able to log their own attendance. However, if you want to control it:

**File to modify:** `src/constants/verticalFeatures.js`

```diff
   EMPLOYEES: [
     { id: 'canAccessEmployees', label: 'Employees List' },
     { id: 'canAccessEmployeeTasks', label: 'Remarks Manager' },
     { id: 'canAccessEmployeeAttendanceBoard', label: 'Attendance Board' },
+    { id: 'canAccessAttendanceSelfService', label: 'Attendance Self-Service' },
   ],
```

And in `src/hooks/useRBAC.js`, add to both the `masterPerms` object and the `features` array:
- Add `'AttendanceSelfService'` to the `features` array (line ~50)
- Add `canAccessAttendanceSelfService: true` to `masterPerms` (line ~44)

---

## Validation Checklist

- [ ] `AttendanceSelfService` imported in `ContentRouter.jsx` (without removing existing imports)
- [ ] New `if (activeVertical === 'attendance_self_service')` block added to ContentRouter
- [ ] `'employee_attendance_board'` and `'attendance_self_service'` added to `MANAGEMENT_VIEWS`
- [ ] Barrel exports for both components added to `index.js` (additive only)
- [ ] "My Attendance" nav button added to `EmployeeSubSidebar.jsx` (in the navigation section)
- [ ] App starts without console errors
- [ ] Clicking "My Attendance" in the sidebar renders the self-service screen
- [ ] Clicking "Attendance Board" still renders the manager board (no regression)

---

## DO NOT Proceed to Phase 5.2 Until All Items Above Are Checked.
