# Runbook 01: Export Modular Access Helpers

> **STANDALONE.** Refactor `src/utils/taskUtils.js` to export atomic evaluation primitives: `isAssignee`, `isCreator`, and `isManager` as public methods on the `taskUtils` object.

---

## 1. Mission

Ensure authorization heuristics are universally accessible throughout the codebase by exposing internal checks directly via the `taskUtils` boundary. This prevents local duplication of security logic and ensures consistent RBAC enforcement across both synchronous utilities and asynchronous hooks.

---

## 2. Target File

- **Relative path:** `src/utils/taskUtils.js`
- **Absolute path (Windows):** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\utils\taskUtils.js`

---

## 3. Pre-Flight: Read the Entire File First

Before making any changes, **open and read the entire `taskUtils.js` file**. This is mandatory to understand the baseline. Here is what you will find:

### What currently exists in the file (as of this runbook's creation):

**Lines 1–19 — File header + internal private helper:**
```javascript
/**
 * taskUtils
 * Utility functions for task display and RBAC logic.
 *
 * IMPORTANT: assigned_to is now a uuid[] array.
 * Use isAssignee(task, user) helper for all membership checks.
 */

/**
 * Internal helper: checks if a user is in the task's assigned_to array.
 * Handles both employeeId and auth user.id comparisons.
 */
const isAssignee = (task, user) => {
  if (!task?.assigned_to?.length) return false;
  return (
    (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
    (user?.id && task.assigned_to.includes(user.id))
  );
};
```

**Line 21 — The exported object begins:**
```javascript
export const taskUtils = {
```

**The first method inside `taskUtils` is `getAssigneeLabel` (starting around line 27):**
```javascript
  getAssigneeLabel(task, currentUser) {
    if (!task?.assigned_to?.length) return 'None';
    ...
```

### Critical Facts to Internalize:

1. **There is a private `const isAssignee` at line 13.** This is NOT the same as the public `taskUtils.isAssignee` we are adding. They co-exist. The private one is used internally by methods inside the file. **Do NOT delete, rename, or modify the private `const isAssignee`.**

2. **The `taskUtils` object starts at line 21 with `export const taskUtils = {`.** New methods are injected immediately after the opening `{`, before `getAssigneeLabel`.

3. **The `isManager` threshold is `> 6`.** Seniority level 6 means field staff. Level 7+ means management. This matches the global `MANAGER_SENIORITY_THRESHOLD` constant used elsewhere.

4. **`isCreator` must check BOTH `task.createdBy` and `task.created_by`** because the database uses snake_case (`created_by`) but the frontend sometimes camelCases it (`createdBy`).

---

## 4. Downstream Blast Radius & Traceability

Modifying the core primitives in `src/utils/taskUtils.js` has a high blast radius across the application. A regression in these access helpers can break permission evaluations in the following files:

### Hooks & Services:
- `src/hooks/useTaskPermissions.js` (Integrates `canAddSubtask` policies — Runbook 02)
- `src/hooks/useTaskController.js` (Manages general CRUD capabilities — Runbook 03)
- `src/hooks/useTaskFilters.js` (Sphere of Influence task isolation)

### UI & Presentation Components:
- `src/components/TaskCard.jsx`
- `src/components/TaskTreeView.jsx`
- `src/components/TaskListView.jsx`
- `src/components/AssigneeBadge.jsx`

### Vertical-Specific Forms:
- `src/verticals/ChargingHubs/HubTaskForm.jsx`
- `src/verticals/Employees/EmployeeTaskForm.jsx`
- `src/verticals/Clients/ClientTaskForm.jsx`

> [!CAUTION]
> **Failure Mode:** If `isAssignee` or `isCreator` fails to evaluate properly (e.g., returns `undefined` instead of `false`), users may experience **"Invisible UI syndrome"** — where edit buttons, drop zones, or task contexts disappear completely without throwing console errors. Always use early-return guards (`if (!task || !user) return false;`).

---

## 5. Step-by-Step Implementation

Follow these foolproof steps to execute the refactoring.

### Step 1: Open the Target File

Open `src/utils/taskUtils.js` in your editor.

### Step 2: Confirm the Injection Point

Locate this exact line (around line 21):
```javascript
export const taskUtils = {
```

The very next line should be the start of `getAssigneeLabel`. The injection point is between these two.

### Step 3: Insert the Three Public Methods

Place the cursor on the line **immediately after** `export const taskUtils = {` and **before** the `/**` JSDoc comment for `getAssigneeLabel`. Insert the following three methods exactly as written:

```javascript
  /**
   * PUBLIC: Checks if a user is in the task's assigned_to array.
   * Handles both employeeId and auth user.id comparisons.
   * This is the public counterpart to the private `const isAssignee` above.
   * Use this when calling from outside this file (hooks, components).
   *
   * @param {Object} task - The task entity. Must have an `assigned_to` array.
   * @param {Object} user - The current logged-in user. Has `.id` and optionally `.employeeId`.
   * @returns {boolean} True if the user is assigned to the task.
   */
  isAssignee(task, user) {
    if (!task?.assigned_to?.length) return false;
    return (
      (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
      (user?.id && task.assigned_to.includes(user.id))
    );
  },

  /**
   * Evaluates if user meets the seniority threshold for management.
   * Seniority level GREATER THAN 6 constitutes managerial authority.
   * Seniority level 6 or below is considered field staff.
   *
   * @param {Object} user - The current logged-in user. Must have `.seniority`.
   * @returns {boolean} True if the user is a manager (seniority > 6).
   */
  isManager(user) {
    return user?.seniority > 6;
  },

  /**
   * Validates task creation ownership.
   * Checks both camelCase (createdBy) and snake_case (created_by) field names.
   *
   * @param {Object} task - The task entity.
   * @param {Object} user - The current logged-in user. Must have `.id`.
   * @returns {boolean} True if the user created the task.
   */
  isCreator(task, user) {
    if (!task || !user) return false;
    return (task.createdBy || task.created_by) === user.id;
  },

```

> [!IMPORTANT]
> **Trailing Comma Rule:** The last line of the `isCreator` method must end with `},` (note the comma). This comma separates `isCreator` from the next method `getAssigneeLabel`. Missing this comma will cause a JavaScript syntax error and crash the app.

### Step 4: Verify the Injection Did Not Disturb Existing Methods

After inserting, scroll down and confirm:
- `getAssigneeLabel` is still intact and unchanged.
- `getAssigneeTooltip` is still intact and unchanged.
- `formatAssigneeForList` is still intact and unchanged.
- `formatTaskText` is still intact and unchanged.
- `canUserMoveTask` is still intact and unchanged.
- `canUserEditField` is still intact and unchanged.
- The private `const isAssignee` at the top of the file is **untouched**.

---

## 6. Expected "After" State Reference

Once updated, the top portion of your `src/utils/taskUtils.js` file should read exactly as follows. Use this as a visual confirmation:

```javascript
/**
 * taskUtils
 * Utility functions for task display and RBAC logic.
 *
 * IMPORTANT: assigned_to is now a uuid[] array.
 * Use isAssignee(task, user) helper for all membership checks.
 */

/**
 * Internal helper: checks if a user is in the task's assigned_to array.
 * Handles both employeeId and auth user.id comparisons.
 */
const isAssignee = (task, user) => {
  if (!task?.assigned_to?.length) return false;
  return (
    (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
    (user?.id && task.assigned_to.includes(user.id))
  );
};

export const taskUtils = {
  /**
   * PUBLIC: Checks if a user is in the task's assigned_to array.
   * Handles both employeeId and auth user.id comparisons.
   * This is the public counterpart to the private `const isAssignee` above.
   *
   * @param {Object} task - The task entity.
   * @param {Object} user - The current logged-in user.
   * @returns {boolean} True if the user is assigned to the task.
   */
  isAssignee(task, user) {
    if (!task?.assigned_to?.length) return false;
    return (
      (user?.employeeId && task.assigned_to.includes(user.employeeId)) ||
      (user?.id && task.assigned_to.includes(user.id))
    );
  },

  /**
   * Evaluates if user meets the seniority threshold for management.
   * Seniority level greater than 6 constitutes managerial authority.
   *
   * @param {Object} user - The current logged-in user.
   * @returns {boolean} True if the user is a manager.
   */
  isManager(user) {
    return user?.seniority > 6;
  },

  /**
   * Validates task creation ownership.
   *
   * @param {Object} task - The task entity.
   * @param {Object} user - The current logged-in user.
   * @returns {boolean} True if the user created the task.
   */
  isCreator(task, user) {
    if (!task || !user) return false;
    return (task.createdBy || task.created_by) === user.id;
  },

  /**
   * Returns "You" if the task is assigned to the current user,
   * otherwise returns the assignee's first name.
   * For multi-assignee tasks, returns the first assignee name.
   */
  getAssigneeLabel(task, currentUser) {
    if (!task?.assigned_to?.length) return 'None';
    ...
```

---

## 7. Verification & Defensive Engineering

Execute the following validation steps before finalizing this task:

1. **Dev Server Check:**
   - The dev server (`npm run dev`) is already running. Watch the terminal for any red error messages after saving.
   - **Success Criteria:** No new errors appear in the terminal.

2. **Build Verification (optional but recommended):**
   - Run `npm run build` via the terminal.
   - **Success Criteria:** Build completes with zero errors.

3. **Safety Checklist:**
   - [ ] The private `const isAssignee` at the top of the file is **unchanged**.
   - [ ] Three new public methods (`isAssignee`, `isManager`, `isCreator`) are inside the `taskUtils` object.
   - [ ] Each new method ends with a comma `,`.
   - [ ] `getAssigneeLabel` still appears directly after `isCreator,` and is unchanged.
   - [ ] No other methods in the file were accidentally deleted or modified.

---

## 8. Common Mistakes to Avoid

| Mistake | Consequence | How to Avoid |
| :--- | :--- | :--- |
| Deleting the private `const isAssignee` | Runtime crash in `canUserMoveTask` and `canUserEditField` | Only ADD to the `taskUtils` object; never remove the top-level `const isAssignee` |
| Missing trailing comma after `isCreator` | Syntax error, blank screen | Always end method definitions with `},` inside an object literal |
| Using `user.seniority >= 6` instead of `> 6` | Grants management access to senior field staff (level 6) | Threshold is strictly GREATER THAN 6 |
| Not checking both `task.createdBy` and `task.created_by` | Creator check fails for tasks loaded from different sources | Always use `(task.createdBy \|\| task.created_by)` |

---

## 9. Handoff

Once successfully integrated and verified, proceed to **`02_PERMISSION_CAPABILITY_INTEGRATION.md`**.
