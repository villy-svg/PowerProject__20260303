# Runbook 5.1 — Update taskService for Multi-Hub & Hierarchy

## Phase 5: Frontend Services
## Subphase 5.1: Extend `taskService.js` for Polymorphic Links & Nesting

---

## 1. Objective & Contextual Logic

The goal of this phase is to align the frontend `taskService` with the **Multi-Hub Fan-Out Architecture** deployed in Phase 4. 

### The Shift: From Scalar to Polymorphic
Previously, a task was owned by one hub (`hub_id`) and one person (`assigned_to`). Now, a task is an "Umbrella" that can be linked to:
- **Multiple Hubs**: A single safety check visible across all locations in a city.
- **Multiple Assignees**: A task that requires a team effort.
- **Parent/Child Hierarchy**: A "Parent" task (created by the generator) that tracks the progress of its "Child" fan-out instances.

### The Mechanism: Computed PostgREST Joins
To keep the frontend efficient, we don't fetch from `task_context_links` directly. Instead, we use computed relationships:
1. `hubs(t public.tasks)`: Returns a set of `hubs` linked to the task.
2. `assignees(t public.tasks)`: Returns a set of `employees` linked to the task.
This allows us to fetch everything in a single `TASK_SELECT` string.

---

## 2. Prerequisites & Safety Checks

> [!IMPORTANT]
> This runbook assumes the master migration `20260423203000_multi_hub_phase_1_2.sql` has been applied to Staging/Production.

### V5.1.0: Verify Schema Readiness
Run this query in the Supabase SQL Editor:
```sql
-- Should return columns: is_active, parent_task_id, task_board
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('parent_task_id', 'task_board');
```

---

## 3. Implementation Step-by-Step

### Step 1: Bump Cache Version & Keys
**File**: `src/services/tasks/taskService.js` (Lines 16-17)

To prevent the app from crashing due to the new data shape, we must force a cache invalidation.

```javascript
// Change:
const TASK_CACHE_VERSION = 4;
const TASK_CACHE_KEY = 'powerpod_tasks_v4';

// To:
const TASK_CACHE_VERSION = 5;
const TASK_CACHE_KEY = 'powerpod_tasks_v5';
```

---

### Step 2: Update `TASK_SELECT` Query String
**File**: `src/services/tasks/taskService.js` (Line 91)

We need to include the new `hubs` relationship and a self-join to count child tasks.

```javascript
// Current:
const TASK_SELECT = '*, assignees(id, full_name, badge_id, employee_roles(seniority_level)), submissions(id, status, rejection_reason, submission_number, created_at)';

// New (Use Template Literal for readability):
const TASK_SELECT = `
  *,
  assignees(id, full_name, badge_id, employee_roles(seniority_level)),
  hubs(id, name, hub_code, city),
  submissions(id, status, rejection_reason, submission_number, created_at),
  children:tasks!parent_task_id(id)
`;
```

---

### Step 3: Update `normalizeTask` Helper
**File**: `src/services/tasks/taskService.js` (Lines 24-66)

The `normalizeTask` function is the "Translation Layer" between DB rows and UI objects.

#### Logic Updates:
1. **Hub Array**: Handle the new `hubs` array returned by PostgREST.
2. **Hierarchy Flags**: Add `childCount` and `isSubTask`.
3. **Board Tags**: Parse the `task_board` JSONB to provide a convenient `isDailyTask` flag.

```javascript
const normalizeTask = (row) => {
  // ... existing submission sorting (lines 25-27) ...

  // 1. Resolve Multi-Hub Data
  const hubData = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);
  
  // 2. Resolve Assignee Names (Existing logic lines 29-40, keep but ensure it uses row.assignees)

  return {
    id: row.id,
    text: row.text,
    verticalId: row.vertical_id,
    stageId: row.stage_id,
    priority: row.priority,
    description: row.description,
    
    // Hub Relationships
    hub_id: row.hub_id,                          // Legacy scalar primary hub
    hub_ids: hubData.map(h => h.id),             // Multi-hub UUID array
    hubNames: hubData.map(h => h.name),          // For display
    hubCodes: hubData.map(h => h.hub_code),      // For badges
    hubData: hubData,                            // Full objects for forms
    city: row.city,
    
    function: row.function,
    
    // Assignee Relationships
    assigned_to: Array.isArray(row.assignees) ? row.assignees.map(a => a.id) : (row.assigned_to ? [row.assigned_to] : []),
    assigneeName: assigneeNames,
    assigneeMeta,
    
    // Hierarchy
    parentTask: row.parent_task_id || null,
    childCount: row.children?.length || 0,        // Count of child tasks
    isSubTask: !!row.parent_task_id,              // Is this a fan-out child?
    
    // Meta & Audit
    task_board: row.task_board || [],
    isDailyTask: Array.isArray(row.task_board) && row.task_board.includes('DAILY'),
    
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,
    
    // Entity Links (Legacy/Future)
    client_id: row.client_id ? [row.client_id] : [],
    partner_id: row.partner_id ? [row.partner_id] : [],
    vendor_id: row.vendor_id ? [row.vendor_id] : [],
    employee_id: row.employee_id ? [row.employee_id] : [],
    
    latestSubmission,
  };
};
```

---

### Step 4: Implement `syncContextLinks` Utility
**File**: `src/services/tasks/taskService.js` (Add after `mapTaskToRow` at Line 88)

Since Supabase doesn't support atomic "Sync" for many-to-many links natively without an RPC, we use a **Delete-then-Insert** strategy within the service.

```javascript
/**
 * Synchronizes many-to-many links in task_context_links.
 * @param {string} taskId - Target task UUID
 * @param {string} entityType - 'hub' | 'assignee' | 'role'
 * @param {string[]} entityIds - Array of target UUIDs
 */
const syncContextLinks = async (taskId, entityType, entityIds) => {
  if (!taskId) return;

  // 1. Wipe existing links for this specific task + entity type
  const { error: deleteError } = await supabase
    .from('task_context_links')
    .delete()
    .match({ 
      source_id: taskId, 
      source_type: 'task', 
      entity_type: entityType 
    });

  if (deleteError) {
    console.error(`[taskService] Failed to purge ${entityType} links:`, deleteError);
    throw deleteError;
  }

  // 2. Batch insert new links
  if (entityIds && entityIds.length > 0) {
    const linkRows = entityIds.filter(id => !!id).map(id => ({
      source_id: taskId,
      source_type: 'task',
      entity_type: entityType,
      entity_id: id,
      is_active: true
    }));

    if (linkRows.length === 0) return;

    const { error: insertError } = await supabase
      .from('task_context_links')
      .insert(linkRows);

    if (insertError) {
      console.error(`[taskService] Failed to insert ${entityType} links:`, insertError);
      throw insertError;
    }
  }
};
```

---

### Step 5: Update `addTask` to include Link Sync
**File**: `src/services/tasks/taskService.js` (Line 158)

When a user creates a task, we must now save the hub and assignee links to the junction table.

```javascript
async addTask(taskData, userId) {
  // ... existing audit/row preparation ...
  
  const { data, error } = await supabase
    .from('tasks')
    .insert([row])
    .select(TASK_SELECT);

  if (error) throw error;
  const newTask = normalizeTask(data[0]);

  // --- NEW: Sync Context Links ---
  // Sync Hubs
  if (taskData.hub_ids) {
    await syncContextLinks(newTask.id, 'hub', taskData.hub_ids);
  }
  // Sync Assignees
  if (taskData.assigned_to) {
    await syncContextLinks(newTask.id, 'assignee', taskData.assigned_to);
  }

  return newTask;
}
```

---

### Step 6: Update `updateTask` to include Link Sync
**File**: `src/services/tasks/taskService.js` (Line 187)

Same logic as `addTask`, but applied to the update flow.

```javascript
async updateTask(taskData, userId) {
  // ... existing update logic ...
  
  // --- NEW: Sync Context Links ---
  if (taskData.hub_ids) {
    await syncContextLinks(taskData.id, 'hub', taskData.hub_ids);
  }
  if (taskData.assigned_to) {
    await syncContextLinks(taskData.id, 'assignee', taskData.assigned_to);
  }

  // Fetch fresh data with links
  const { data: refreshed, error: fetchError } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('id', taskData.id)
    .single();

  if (fetchError) throw fetchError;
  return normalizeTask(refreshed);
}
```

---

## 4. Hierarchy Helpers
Add this function to the `taskService` object to support the upcoming "Board Nesting" UI.

```javascript
/**
 * Retrieves all child tasks for a given parent.
 */
async getChildTasks(parentTaskId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
    .eq('parent_task_id', parentTaskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeTask);
}
```

---

## 5. Verification & Testing

### V5.1.1: Cache Busting
1. Open the app.
2. Check `LocalStorage`. `powerpod_tasks_v4` should be gone, replaced by `powerpod_tasks_v5`.

### V5.1.2: Multi-Hub Read
1. Manually add two hub links for a task in the Supabase Dashboard (`task_context_links`).
2. Run `await taskService.getTasks()` in the browser console.
3. Verify the target task has `hub_ids` with 2 UUIDs and `hubNames` with 2 names.

### V5.1.3: Link Integrity (Write)
1. Create a task via the UI (or console) with a specific `hub_ids` array.
2. Check the `task_context_links` table. 
3. **Success**: Exact matching rows exist.

---

## Next Step → [Runbook 5.2: Template Service Update](./09_TEMPLATE_SERVICE.md)
