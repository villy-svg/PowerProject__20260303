# Runbook 4.2 — Daily Task Service Extension

## Phase 4: Frontend API & State Management Updates
## Subphase 4.2: Extend `dailyTaskService.js` for hierarchy

---

## Objective

Update the daily task service to:
1. Expose `parent_task_id` in normalized output.
2. Include parent task info and child tasks in the select query.
3. Add helper methods for hierarchy operations.

---

## Prerequisites

- [ ] [Runbook 4.1](./07_TEMPLATE_SERVICE.md) complete.

---

## Files Affected

| File | Action |
|---|---|
| `src/services/tasks/dailyTaskService.js` | MODIFY |

---

## Step 4.2.1: Update `normalizeDailyTask`

### Add these fields (after line 27 `submissionBy`):
```javascript
parentTaskId: row.parent_task_id || null,
childCount: row.children?.length || 0,
isSubTask: !!row.parent_task_id,
```

---

## Step 4.2.2: Update `DAILY_TASK_SELECT`

### Current (line 59):
```javascript
const DAILY_TASK_SELECT = '*, employees:assigned_to (full_name)';
```

### Change to:
```javascript
const DAILY_TASK_SELECT = `
  *,
  employees:assigned_to (full_name),
  children:daily_tasks!parent_task_id (id)
`;
```

**Note**: The `children:daily_tasks!parent_task_id` syntax uses PostgREST's self-referencing join. It fetches the IDs of all child tasks. We only fetch IDs (not full objects) to keep the payload small — the full child data is already in the flat task list.

---

## Step 4.2.3: Update `mapDailyTaskToRow`

### Add to the returned `row` object (around line 46):
```javascript
parent_task_id: task.parentTaskId || null,
```

---

## Step 4.2.4: Add Hierarchy Helper Methods

Add to the `dailyTaskService` export:

```javascript
/**
 * Get all children of a parent task.
 * Use when you need full child data on-demand (e.g., expanding a parent).
 */
async getChildTasks(parentTaskId) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select(DAILY_TASK_SELECT)
    .eq('parent_task_id', parentTaskId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeDailyTask);
},

/**
 * Get the parent of a sub-task.
 * Use for breadcrumb/navigation in the UI.
 */
async getParentTask(parentTaskId) {
  const { data, error } = await supabase
    .from('daily_tasks')
    .select(DAILY_TASK_SELECT)
    .eq('id', parentTaskId)
    .single();
  if (error) throw error;
  return normalizeDailyTask(data);
},
```

---

## Step 4.2.5: Update Cache Key (Offline Support)

The localStorage cache for daily tasks should remain flat. The `parentTaskId` field is included in the normalized data, so hierarchy can be reconstructed from the flat list client-side.

No changes needed to the caching logic — it serializes the normalized objects.

---

## Validation

### V4.2.1: Tasks include parentTaskId
```javascript
const tasks = await dailyTaskService.getTasks();
const subTasks = tasks.filter(t => t.isSubTask);
const parents = tasks.filter(t => t.childCount > 0);
console.log('Sub-tasks:', subTasks.length, 'Parents:', parents.length);
```

### V4.2.2: getChildTasks returns correct children
```javascript
// Use a known parent task ID from the V2.1.3 validation
const children = await dailyTaskService.getChildTasks('PARENT_ID');
console.log(children); // Should list sub-tasks
```

### V4.2.3: PostgREST self-join doesn't error
The `children:daily_tasks!parent_task_id` join is the trickiest part. If you get a 406:
- Ensure the `daily_tasks_parent_task_id_fkey` FK exists.
- Ensure `NOTIFY pgrst, 'reload schema'` was run.
- Try `children:daily_tasks!daily_tasks_parent_task_id_fkey` (explicit FK name).

---

## Next → [Runbook 4.3: React Hook Updates](./09_REACT_HOOKS.md)
