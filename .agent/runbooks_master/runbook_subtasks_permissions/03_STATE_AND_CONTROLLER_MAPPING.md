# Runbook 03: Refactor State & Controller Handlers

> **STANDALONE.** Wire the `canAddSubtask` security capability into the application's primary orchestrator hook (`src/hooks/useTaskController.js`) and replace the legacy hierarchy gate in `handleAddSubtask`.

---

## 1. Architectural Blueprint & Purpose

### Why This Step is Critical
`useTaskController.js` is the central brain for state changes, UI transitions, and data mutations across all vertical layers. While Runbook 01 established atomic security helpers and Runbook 02 defined the `canAddSubtask` capability in `useTaskPermissions`, those pieces remain **passive** until wired to the controller that actually triggers the subtask modal.

By replacing the legacy `canManageHierarchy` access gate inside `handleAddSubtask` with `canAddSubtask`, we execute the delegation model that allows assigned field staff to create subtasks.

Additionally, we introduce **Field Cascading**: the child task inherits the parent's context fields (city, hub_ids, function, priority, etc.) so the user doesn't have to fill them in manually.

### How `canAddSubtask` Reaches This File
`useTaskController.js` calls `useTaskPermissions({ ...props })` and destructures the result. After Runbook 02, `useTaskPermissions` returns `canAddSubtask` in its return object. We simply add `canAddSubtask` to the destructure statement to consume it.

### State Flow & Metadata Cascade Logic
```
User clicks "+" button on a task card
           │
           ▼
handleAddSubtask(parentId) is called
           │
           ▼
parentTask = tasks.find(t => t.id === parentId)
           │
           ▼
[parentTask missing?] === true => alert + return (null safety)
           │
           ▼
[canAddSubtask(parentTask)?] === false => alert + return (permission denied)
           │
           ▼ (Authorized)
setEditingTask({
  parentTask: parentId,
  city:       parentTask.city || '',
  hub_ids:    parentTask.hub_ids || (parentTask.hub_id ? [parentTask.hub_id] : []),
  hub_id:     parentTask.hub_id || null,
  function:   parentTask.function || '',
  assigned_to: parentTask.assigned_to || [],
  priority:   parentTask.priority || 'Medium',
  assigned_client_id: parentTask.assigned_client_id || '',
  metadata:   parentTask.metadata || {}
})
setIsModalOpen(true)
```

---

## 2. Target File & Prerequisites

### Location
- **Relative path:** `src/hooks/useTaskController.js`
- **Absolute path (Windows):** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\hooks\useTaskController.js`

### Current State of the File (Read This Before Touching Code)

The file is approximately 241 lines long. Key areas to know:

**Line 58-59 (Permissions destructuring block):**
```javascript
  const permissionsInfo = useTaskPermissions({ ...props });
  const { canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy, canEditTask } = permissionsInfo;
```

**Lines 205-212 (Legacy `handleAddSubtask`):**
```javascript
  const handleAddSubtask = (parentId) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!canManageHierarchy(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks to this record.");
      return;
    }
    setEditingTask({ parentTask: parentId }); setIsModalOpen(true);
  };
```

**Lines 214-238 (Return statement):**
```javascript
  return {
    ...filtersInfo,
    ...selectionInfo,
    ...permissionsInfo,           // <-- This spread already includes canAddSubtask after RB02
    isModalOpen, setIsModalOpen,
    ...
    openAddModal, openEditModal, handleAddSubtask,
    canEditTask
  };
```

> [!IMPORTANT]
> **Critical Detail:** The return statement uses `...permissionsInfo` spread. This means after Runbook 02 adds `canAddSubtask` to `useTaskPermissions`'s return object, it will **automatically** be available in the controller's return without any changes needed to the return statement. You only need to (1) destructure it and (2) use it inside `handleAddSubtask`.

### Pre-Flight Checks
1. [ ] Verify that `src/hooks/useTaskPermissions.js` has been updated (Runbook 02) and exports `canAddSubtask`.
2. [ ] Open `useTaskController.js` and confirm line 59 shows the destructure as described above.
3. [ ] Confirm line 207 shows `if (!canManageHierarchy(parentTask)) {` — this is the legacy gate we are replacing.

---

## 3. Step-by-Step Implementation

### Step 1: Destructure `canAddSubtask` from `permissionsInfo`

Navigate to line 59. The current code reads:
```javascript
  const { canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy, canEditTask } = permissionsInfo;
```

Add `canAddSubtask` to the destructure. For readability, expand it to multiple lines:

**Replace with:**
```javascript
  const {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy,
    canEditTask,
    canAddSubtask   // <-- New: context-aware subtask creation capability
  } = permissionsInfo;
```

> [!IMPORTANT]
> **Do NOT remove `canManageHierarchy` from the destructure.** It is still used in `handleMoveToParent`, `handleUIMoveTask` (indirectly via `canUserUpdate`), and will still be needed for hierarchy promotion button visibility in views. Only ADD `canAddSubtask`, do not replace `canManageHierarchy`.

### Step 2: Rewrite `handleAddSubtask`

Navigate to line 205. The current implementation:
```javascript
  const handleAddSubtask = (parentId) => {
    const parentTask = tasks.find(t => t.id === parentId);
    if (!canManageHierarchy(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks to this record.");
      return;
    }
    setEditingTask({ parentTask: parentId }); setIsModalOpen(true);
  };
```

**Replace the entire `handleAddSubtask` function (lines 205-212) with:**
```javascript
  const handleAddSubtask = (parentId) => {
    // Step 1: Resolve the parent task node safely
    const parentTask = tasks.find(t => t.id === parentId);

    // Step 2: Null safety guard — parent must exist in the current task list
    if (!parentTask) {
      alert("Error: Parent task node not found. The task list may be stale. Please refresh.");
      return;
    }

    // Step 3: Capability gate — use canAddSubtask instead of canManageHierarchy.
    // canAddSubtask grants access to managers, task creators, AND assigned field staff.
    // canManageHierarchy (the old gate) only allowed managers and creators.
    if (!canAddSubtask(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks under this task.");
      return;
    }

    // Step 4: Cascade parent context fields to the child.
    // This pre-populates the creation modal so the user doesn't have to re-enter context.
    // All fields use nullish coalescing (|| '') to guarantee safe defaults.
    setEditingTask({
      parentTask: parentId,                                                // Link to parent
      city: parentTask.city || '',                                         // Geographic context
      hub_ids: parentTask.hub_ids || (parentTask.hub_id ? [parentTask.hub_id] : []), // Hub context (supports both array and single)
      hub_id: parentTask.hub_id || null,                                  // Legacy single-hub field
      function: parentTask.function || '',                                 // Task domain/function
      assigned_to: parentTask.assigned_to || [],                          // Inherit assignees
      priority: parentTask.priority || 'Medium',                          // Inherit priority
      assigned_client_id: parentTask.assigned_client_id || '',            // Client context
      metadata: parentTask.metadata || {}                                  // Arbitrary metadata
    });

    // Step 5: Open the task creation modal
    setIsModalOpen(true);
  };
```

### Step 3: Verify the Return Statement Requires No Changes

Scroll to the return statement (around line 214). Confirm it contains `...permissionsInfo`:
```javascript
  return {
    ...filtersInfo,
    ...selectionInfo,
    ...permissionsInfo,    // <-- This spread already exports canAddSubtask automatically
    ...
  };
```

**No changes are needed here.** The `...permissionsInfo` spread automatically includes `canAddSubtask` after Runbook 02 is completed. Verify `handleAddSubtask` is also in the return statement (it should already be there on the same line as `openAddModal` and `openEditModal`).

---

## 4. Expected "After" State (Affected Lines Only)

**Lines 58-66 after change (destructure block):**
```javascript
  const permissionsInfo = useTaskPermissions({ ...props });
  const {
    canUserCreate,
    canUserUpdate,
    canUserDelete,
    canManageHierarchy,
    canEditTask,
    canAddSubtask   // <-- Contextual subtask creation capability
  } = permissionsInfo;
```

**Lines 205-233 after change (`handleAddSubtask` function):**
```javascript
  const handleAddSubtask = (parentId) => {
    const parentTask = tasks.find(t => t.id === parentId);

    if (!parentTask) {
      alert("Error: Parent task node not found. The task list may be stale. Please refresh.");
      return;
    }

    if (!canAddSubtask(parentTask)) {
      alert("Permission Denied: You do not have rights to add subtasks under this task.");
      return;
    }

    setEditingTask({
      parentTask: parentId,
      city: parentTask.city || '',
      hub_ids: parentTask.hub_ids || (parentTask.hub_id ? [parentTask.hub_id] : []),
      hub_id: parentTask.hub_id || null,
      function: parentTask.function || '',
      assigned_to: parentTask.assigned_to || [],
      priority: parentTask.priority || 'Medium',
      assigned_client_id: parentTask.assigned_client_id || '',
      metadata: parentTask.metadata || {}
    });

    setIsModalOpen(true);
  };
```

---

## 5. Verification Protocol

Execute these validation safeguards before submitting:

1. **Dev Server Check:**
   - Watch the `npm run dev` terminal after saving.
   - **Success Criteria:** No red errors, no "canAddSubtask is not a function" or "canAddSubtask is not defined" messages.

2. **Safety Checklist:**
   - [ ] `canAddSubtask` appears in the destructure on line ~60
   - [ ] `canManageHierarchy` is still in the destructure (not removed)
   - [ ] `handleAddSubtask` uses `canAddSubtask(parentTask)`, not `canManageHierarchy(parentTask)`
   - [ ] `parentTask` null guard is present BEFORE the `canAddSubtask` call
   - [ ] All 9 fields are in the `setEditingTask` call with fallback defaults
   - [ ] The return statement still contains `...permissionsInfo` (not modified)

3. **Functional Test:**
   - In the running browser app, open a task that IS assigned to you (as a field-level user).
   - Click the `+` button.
   - Verify the modal opens and the fields pre-populate from the parent task.

---

## 6. Common Mistakes to Avoid

| Mistake | Consequence | How to Avoid |
| :--- | :--- | :--- |
| Removing `canManageHierarchy` from destructure | Hierarchy promotion buttons crash | Only ADD `canAddSubtask`, keep `canManageHierarchy` |
| Calling `canAddSubtask(parentId)` instead of `canAddSubtask(parentTask)` | Evaluating a string ID instead of task object, always returns false | Pass the full `parentTask` object, not the `parentId` string |
| Putting `canAddSubtask` check BEFORE the null guard | Runtime crash if `parentTask` is undefined | Always check `if (!parentTask)` FIRST |
| Using `parentTask.hub_ids || []` without the single-hub fallback | Hub context lost when task has `hub_id` (old single-hub field) but not `hub_ids` | Use `parentTask.hub_ids \|\| (parentTask.hub_id ? [parentTask.hub_id] : [])` |
| Adding `canAddSubtask` to the return statement manually | Creates duplicate key — it's already in `...permissionsInfo` | Do NOT add it to the return statement separately |

---

## 7. Handoff

Once successfully implemented and verified, proceed to **`04_LAYOUT_NODE_WIRING.md`**.
