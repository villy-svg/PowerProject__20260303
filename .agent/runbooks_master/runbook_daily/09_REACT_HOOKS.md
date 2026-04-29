# Runbook 4.3 — React Hook Updates

## Phase 4: Frontend API & State Management Updates
## Subphase 4.3: Update `useDailyTasks.js` hook for hierarchy state

---

## Objective

Update the React hook to:
1. Expose hierarchy-aware computed state (parent tasks, sub-tasks, tree structure).
2. Provide helper functions for expanding/collapsing parent tasks in the UI.
3. Maintain backward compatibility — existing consumers see the same flat list.

---

## Prerequisites

- [ ] [Runbook 4.2](./08_DAILY_TASK_SERVICE.md) complete.

---

## Files Affected

| File | Action |
|---|---|
| `src/hooks/useDailyTasks.js` | MODIFY |

---

## Step 4.3.1: Add Hierarchy Computed Values

After the existing state declarations (line 20), add:

```javascript
// Hierarchy: Separate parents from children for nested rendering
const parentTasks = useMemo(() =>
  tasks.filter(t => !t.isSubTask),
  [tasks]
);

const subTasksByParent = useMemo(() => {
  const map = {};
  tasks.forEach(t => {
    if (t.parentTaskId) {
      if (!map[t.parentTaskId]) map[t.parentTaskId] = [];
      map[t.parentTaskId].push(t);
    }
  });
  return map;
}, [tasks]);

const getSubTasks = useCallback((parentId) =>
  subTasksByParent[parentId] || [],
  [subTasksByParent]
);
```

**Import `useMemo`** at the top of the file:
```javascript
import { useState, useCallback, useMemo } from 'react';
```

---

## Step 4.3.2: Update Return Object

Add the new values to the return object (after line 100):

```javascript
return {
  tasks,           // Flat list (ALL tasks, including sub-tasks)
  parentTasks,     // Only top-level tasks (parent_task_id IS NULL)
  subTasksByParent,// Map: parentId → [subTask, subTask, ...]
  getSubTasks,     // Helper: getSubTasks(parentId) → [subTasks]
  setTasks,
  loading,
  fetchTasks,
  addTask,
  updateTask,
  updateTaskStage,
  bulkUpdateTasks,
  deleteTask,
};
```

---

## Design Notes

### Why flat list + computed hierarchy (not nested objects)?

1. **Backward compatibility**: Existing board/filter code operates on a flat array. The `tasks` array still contains everything.
2. **Performance**: `useMemo` only recalculates when `tasks` changes. No extra API calls.
3. **Simplicity**: The board component can choose to render flat (show everything) or nested (iterate `parentTasks`, then `getSubTasks(parent.id)` for each).
4. **Consistent state updates**: When a sub-task is updated, the flat `tasks` state updates correctly, and the `useMemo` derivations re-compute automatically.

### State Update Pattern for Sub-Tasks

When adding or updating sub-tasks, the existing `setTasks(prev => ...)` pattern works unchanged because sub-tasks are in the same flat array. Example:

```javascript
// Adding a new sub-task works with existing addTask:
const newSubTask = await dailyTaskService.addTask({
  ...taskData,
  parentTaskId: parentId,
}, user?.id);
setTasks(prev => [newSubTask, ...prev]);
// parentTasks and subTasksByParent auto-update via useMemo
```

---

## Validation

### V4.3.1: Hook returns new properties
In a component that uses `useDailyTasks`:
```javascript
const { tasks, parentTasks, getSubTasks } = useDailyTasks(user);

useEffect(() => {
  console.log('Total tasks:', tasks.length);
  console.log('Parent tasks:', parentTasks.length);
  // For each parent with children:
  parentTasks.forEach(p => {
    const subs = getSubTasks(p.id);
    if (subs.length > 0) {
      console.log(`Parent "${p.text}" has ${subs.length} sub-tasks`);
    }
  });
}, [tasks]);
```

### V4.3.2: Backward compatibility
Existing components that only use `tasks`, `loading`, `fetchTasks`, etc. should work identically. No breaking changes.

### V4.3.3: Memo recalculation
Update a sub-task's stage. Verify that `subTasksByParent` reflects the change without a full refetch.

---

## Next → [Runbook 5.1: Template Wizard Sub-Task Config](./10_TEMPLATE_WIZARD_UI.md)
