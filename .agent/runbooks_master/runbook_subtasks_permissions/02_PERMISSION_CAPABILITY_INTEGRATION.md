# Runbook 02: Integrate Permission Capabilities

> **STANDALONE.** Upgrade `src/hooks/useTaskPermissions.js` to compute and expose the new `canAddSubtask` capability.

---

## 1. Architectural Blueprint & Purpose

### Why This Capability Exists
Historically, task creation was restricted purely by global role flags (`canUserCreate`). If a user was a general Contributor, they could create tasks. However, in complex workflows, we need **context-aware delegation**.

The `canAddSubtask` capability bridges the gap between **Role-Based Access Control (RBAC)** and **Task-Level Assignment**. It empowers field staff (Assignees) to create sub-tasks beneath their assigned work, without granting them destructive global management capabilities.

### What `canAddSubtask` Is
`canAddSubtask` is a **function** (not a boolean). It is created with `useCallback` and has the following signature:
```
canAddSubtask(task: Object) => boolean
```
It is called at render time per task to determine if the current user can add a subtask to that specific task.

### Logic Flow
```
canAddSubtask(task) is called with a task object
           |
           v
+------------------------+
| task === null/undefined | === true ==> return false
+------------------------+
           |
           v
+------------------------+
| task.isContextOnly      | === true ==> return false (virtual grouping node)
+------------------------+
           |
           v
+------------------------+
| canUserCreate === false | === true ==> return false (no baseline create access)
+------------------------+
           |
           v
+-----------------------------------------------+
| Evaluate Three Authorization Escalations:      |
|  1. taskUtils.isManager(user) → true? GRANT   |
|  2. taskUtils.isCreator(task,user) → true? GRANT |
|  3. taskUtils.isAssignee(task,user) → true? GRANT |
|  otherwise: DENY                               |
+-----------------------------------------------+
```

---

## 2. Blast Radius & Downstream Traceability

Modifying capabilities in `useTaskPermissions.js` cascades throughout the frontend application.

| File Path | Impact Type | Expected Outcome |
| :--- | :--- | :--- |
| `src/hooks/useTaskController.js` | Orchestration | Guards the actual execution of the creation event. |
| `src/components/TaskController.jsx` | Root aggregator | Destructures and passes capability to all views. |
| `src/components/TaskCard.jsx` | UI/UX | Toggles the visibility of the `+` (Add Subtask) button. |
| `src/components/TaskListView.jsx` | UI/UX | Governs subtask creation button per row. |
| `src/components/TaskTreeView.jsx` | UI/UX | Governs nested node rendering thresholds. |

> [!CAUTION]
> **Critical Failure Mode — Stale Closures:** Messing up the dependency array in `useCallback` will lead to **Stale Closures**. If `user` is omitted from the dependency array, the capability will evaluate permissions against the initial auth state, permanently locking out legitimate users until a hard refresh.
>
> The correct dependency array is: `[canUserCreate, user]`

---

## 3. Target File & Prerequisites

### Location
- **Relative path:** `src/hooks/useTaskPermissions.js`
- **Absolute path (Windows):** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\hooks\useTaskPermissions.js`

### Current State of the File (Read This Before Touching Code)
The file currently:
- Imports `useMemo, useCallback` from React
- Imports `MANAGER_SENIORITY_THRESHOLD` from `'../constants/roles'`
- Does **NOT** import `taskUtils`
- Defines 5 capabilities: `canUserCreate`, `canUserUpdate`, `canUserDelete`, `canManageHierarchy`, `canEditTask`
- Returns all 5 in an object at the bottom

We are adding a **6th capability**: `canAddSubtask`.

### Pre-Flight Checks
1. [ ] Confirm that Runbook 01 has been completed — `src/utils/taskUtils.js` must export the `taskUtils` object with `isAssignee`, `isManager`, and `isCreator` as public methods.
2. [ ] Open the file and verify the existing return statement looks like:
   ```javascript
   return {
     canUserCreate,
     canUserUpdate,
     canUserDelete,
     canManageHierarchy,
     canEditTask
   };
   ```

---

## 4. Step-by-Step Implementation

### Step 1: Add the `taskUtils` Import

Open `src/hooks/useTaskPermissions.js`. The file starts with these two import lines:

```javascript
import { useMemo, useCallback } from 'react';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
```

Add a third import line **directly below** the `MANAGER_SENIORITY_THRESHOLD` import:

**After:**
```javascript
import { useMemo, useCallback } from 'react';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
import { taskUtils } from '../utils/taskUtils';
```

> [!IMPORTANT]
> The import path must be `'../utils/taskUtils'` (two dots, then `/utils/taskUtils`). Since `useTaskPermissions.js` is inside `src/hooks/`, the relative path goes up one level to `src/` then into `utils/`. Do not use `./utils/taskUtils` (single dot) — that would look for a `utils` folder inside `hooks/` which does not exist.

### Step 2: Inject the `canAddSubtask` Capability

The current file ends the `canEditTask` block around line 76 with its closing `}, [canUserUpdate, user.id, user.employeeId, permissions.level]);` and then has a blank line followed by the return statement.

Find this closing sequence:
```javascript
  }, [canUserUpdate, user.id, user.employeeId, permissions.level]);


  return {
```

Inject the new `canAddSubtask` capability between `canEditTask`'s closing line and the `return {` block:

**After (add between `canEditTask` block end and `return {`):**
```javascript
  }, [canUserUpdate, user.id, user.employeeId, permissions.level]);

  // 6. Subtask Creation Capability
  // Context-aware delegation: allows assignees (not just managers) to add child tasks.
  // Unlike canManageHierarchy which is reserved for managers/creators only,
  // canAddSubtask also grants permission to any assigned user.
  const canAddSubtask = useCallback((task) => {
    // Defensive Guard: Prevent runtime crashes on empty task evaluation
    if (!task) return false;

    // Virtual Node Guard: Context nodes are grouping nodes (view-only), not actionable records.
    // isContextOnly is set by useTaskFilters when it creates synthetic grouping rows.
    if (task.isContextOnly) return false;

    // RBAC Guard: User must possess baseline creation permissions for this vertical.
    // This is the featurized canCreate flag that accounts for vertical-specific access.
    if (!canUserCreate) return false;

    // Escalation 1: Managerial Authority — managers can always add subtasks
    if (taskUtils.isManager(user)) return true;

    // Escalation 2: Ownership Authority — task creators can always add subtasks
    if (taskUtils.isCreator(task, user)) return true;

    // Escalation 3: Delegated Assignee Authority — assignees can add subtasks
    return taskUtils.isAssignee(task, user);
  }, [canUserCreate, user]);

  return {
```

### Step 3: Expose the Capability in the Return Statement

The current return statement (at the bottom of the file) looks like:
```javascript
  return {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy,
    canEditTask
  };
```

Add `canAddSubtask` to the returned object. The order matters for readability — add it after `canEditTask`:

**After:**
```javascript
  return {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy,
    canEditTask,
    canAddSubtask   // <-- New: context-aware subtask creation capability
  };
```

> [!IMPORTANT]
> **Don't forget the comma** after `canEditTask,` — without it you will get a JavaScript syntax error.

---

## 5. Expected Complete "After" State of the File

Below is the full expected state of the file after your changes. Use this as a confirmation checklist:

```javascript
import { useMemo, useCallback } from 'react';
import { MANAGER_SENIORITY_THRESHOLD } from '../constants/roles';
import { taskUtils } from '../utils/taskUtils';           // <-- NEW LINE

/**
 * useTaskPermissions Hook
 * Centralizes all security and permission logic for task management.
 */
export const useTaskPermissions = ({
  user,
  permissions,
  activeVertical,
  rootVerticalId
}) => {
  // 1. Feature-specific CRUD flags
  const featureBaseName = useMemo(() =>
    activeVertical.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''),
    [activeVertical]
  );

  const fCanCreate = useMemo(() => permissions[`canCreate${featureBaseName}`] ?? permissions.canCreate, [permissions, featureBaseName]);
  const fCanUpdate = useMemo(() => permissions[`canUpdate${featureBaseName}`] ?? permissions.canUpdate, [permissions, featureBaseName]);
  const fCanDelete = useMemo(() => permissions[`canDelete${featureBaseName}`] ?? permissions.canDelete, [permissions, featureBaseName]);

  // 2. Vertical Access Check
  const hasVerticalAccess = useMemo(() => {
    if (permissions.scope === 'global') return true;
    const assigned = user?.assignedVerticals || [];
    return (
      assigned.includes(rootVerticalId) ||
      assigned.includes(activeVertical) ||
      assigned.includes(activeVertical.toUpperCase())
    );
  }, [user, permissions.scope, rootVerticalId, activeVertical]);

  // 3. Final CRUD Permission Flags
  const canUserCreate = fCanCreate && hasVerticalAccess;
  const canUserUpdate = fCanUpdate && hasVerticalAccess;
  const canUserDelete = fCanDelete && hasVerticalAccess;

  // 4. Hierarchy Management Permission
  const canManageHierarchy = useCallback((task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;
    if (user.seniority > MANAGER_SENIORITY_THRESHOLD) return true;
    const isCreator = (task.createdBy || task.created_by) === user.id;
    return isCreator;
  }, [user.seniority, user.id]);

  // 5. Task Editing Guard
  const canEditTask = useCallback((task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;
    if (canUserUpdate) return true;
    const isCreator = (task.createdBy || task.created_by) === user.id;
    const assignedTo = task.assigned_to || [];
    const isAssignee = (user.employeeId && assignedTo.includes(user.employeeId)) || (user.id && assignedTo.includes(user.id));
    if (['contributor', 'viewer'].includes(permissions.level) && (isCreator || isAssignee)) {
      return true;
    }
    return false;
  }, [canUserUpdate, user.id, user.employeeId, permissions.level]);

  // 6. Subtask Creation Capability     <-- NEW BLOCK
  const canAddSubtask = useCallback((task) => {
    if (!task) return false;
    if (task.isContextOnly) return false;
    if (!canUserCreate) return false;
    if (taskUtils.isManager(user)) return true;
    if (taskUtils.isCreator(task, user)) return true;
    return taskUtils.isAssignee(task, user);
  }, [canUserCreate, user]);

  return {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy,
    canEditTask,
    canAddSubtask     // <-- NEW
  };
};
```

---

## 6. Verification Protocol

To guarantee the capability does not break the frontend build pipeline:

1. **Dev Server Check:**
   - Watch the running `npm run dev` terminal output after saving.
   - **Success Criteria:** No red errors appear.

2. **Static Analysis & Build Check:**
   - Run `npm run build` in the terminal.
   - **Success Criteria:** No undefined variable errors, no missing imports.

3. **Safety Checklist:**
   - [ ] `import { taskUtils } from '../utils/taskUtils';` is present at line 3
   - [ ] `canAddSubtask` uses `useCallback` (not `useMemo`)
   - [ ] Dependency array is exactly `[canUserCreate, user]`
   - [ ] Return statement includes `canAddSubtask`
   - [ ] All existing capabilities (`canUserCreate`, `canUserUpdate`, `canUserDelete`, `canManageHierarchy`, `canEditTask`) are still present and unchanged

4. **Console Audit (Temporary Debug):**
   - Optionally add `console.log("canAddSubtask test:", canAddSubtask({ id: 'test', assigned_to: [] }))` inside the hook after the `canAddSubtask` definition to confirm it returns `false` for an empty task without crashing.
   - Remove this log before completing.

---

## 7. Common Mistakes to Avoid

| Mistake | Consequence | How to Avoid |
| :--- | :--- | :--- |
| Using `useMemo` instead of `useCallback` | `canAddSubtask` becomes a value, not a function. Calling it crashes. | Always use `useCallback` for functions. |
| Wrong import path `'./utils/taskUtils'` | Module not found error | Use `'../utils/taskUtils'` (parent directory) |
| Missing `user` in dependency array | Stale closure: evaluates with initial user object forever | Always include `user` in the dep array |
| Not guarding `task.isContextOnly` | Context-only virtual rows show the `+` button | Always check `if (task.isContextOnly) return false` |
| Forgetting to add `canAddSubtask` to `return {}` | Hook consumers receive `undefined` | Explicitly add to return object |

---

## 8. Handoff

Once fully coded and verified, proceed immediately to **`03_STATE_AND_CONTROLLER_MAPPING.md`**.
