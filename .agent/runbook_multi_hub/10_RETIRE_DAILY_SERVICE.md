# Runbook 10 — Retire Daily Task Service

## Phase 5: Frontend Services
## Subphase 10.1: Remove `dailyTaskService.js` and Redirect Consumers to `taskService.js`

---

## 📖 Background & Context

In the previous architectural phases (Runbooks 01-03), we consolidated the fragmented database schema. The `daily_tasks` table has been retired, and its data migrated into the unified `tasks` table. Categorization is now handled by the `task_board` JSONB/Text array (e.g., `['DAILY']`, `['INCIDENT']`).

**The Problem:** The frontend still contains `dailyTaskService.js`, which is hardcoded to query the non-existent `daily_tasks` table. This causes runtime errors and maintenance bloat.

**The Solution:** 
1.  **Consolidate CRUD:** All operations must flow through the unified `taskService.js`.
2.  **Preserve DX:** Keep `useDailyTasks` as a "Smart Wrapper" around `useTasks` so existing UI components don't need massive refactoring.
3.  **Cleanup:** Physically remove the dead service file.

---

## 🛠 Prerequisites

- [x] **Database Migration Complete:** The `daily_tasks` table data has been moved to `tasks`.
- [x] **RLS Hardened:** `taskService` has permission to read/write tasks with `task_board` containing 'DAILY'.
- [x] **Runbook 09 Complete:** Template services are already using the multi-hub generator.

---

## 📂 Files Affected

| File | Action | Rationale |
|---|---|---|
| `src/hooks/useDailyTasks.js` | **REFACTOR** | Change from an independent fetcher to a filtered wrapper of `useTasks`. |
| `src/verticals/ChargingHubs/DailyTasksManagement.jsx` | **MODIFY** | Remove direct `dailyTaskService` imports; use hook methods instead. |
| `src/verticals/ChargingHubs/TaskCSVImport.jsx` | **MODIFY** | Remove conditional logic targeting the `daily_tasks` table. |
| `src/services/tasks/dailyTaskTemplateService.js` | **MODIFY** | Replace `dailyTaskService` with `taskService`. |
| `src/services/tasks/dailyTaskService.js` | **DELETE** | Remove dead code. |

---

## 🚀 Implementation Steps

### Step 10.1: Transform `useDailyTasks.js` into a Smart Wrapper

Currently, `useDailyTasks` manages its own state and fetches from `dailyTaskService`. We want it to "borrow" the global task state from `useTasks` and simply filter it.

#### [MODIFY] [useDailyTasks.js](file:///src/hooks/useDailyTasks.js)

```javascript
import { useMemo } from 'react';
import { useTasks } from './useTasks';

/**
 * useDailyTasks Hook
 * 
 * ARCHITECTURE NOTE:
 * Instead of fetching from its own service, this hook now wraps useTasks().
 * It provides a "Daily View" of the global task stream by filtering for 
 * tasks where `task_board` includes 'DAILY'.
 */
export const useDailyTasks = (user) => {
  const taskHook = useTasks(user);

  // 1. Filter tasks for the Daily Board
  const dailyTasks = useMemo(() => 
    taskHook.tasks.filter(t => 
      Array.isArray(t.task_board) && t.task_board.includes('DAILY')
    ), 
    [taskHook.tasks]
  );

  // 2. Hierarchy Logic (maintained for backward compatibility)
  const parentTasks = useMemo(() => 
    dailyTasks.filter(t => !t.parentTask), 
    [dailyTasks]
  );

  const getSubTasks = (parentId) => 
    dailyTasks.filter(t => t.parentTask === parentId);

  // 3. Export filtered data while preserving standard useTasks CRUD methods
  return {
    ...taskHook,      // Includes loading, fetchTasks, addTask, updateTask, deleteTask
    tasks: dailyTasks, // Overrides the global task list with the filtered "Daily" list
    allTasks: taskHook.tasks, // Access to the raw stream if needed
    parentTasks,
    getSubTasks,
  };
};
```

---

### Step 10.2: Decouple `DailyTasksManagement.jsx`

Remove direct dependencies on the retiring service. All UI interactions should go through the hook.

#### [MODIFY] [DailyTasksManagement.jsx](file:///src/verticals/ChargingHubs/DailyTasksManagement.jsx)

1.  **Remove Import:**
    ```javascript
    // DELETE
    import { dailyTaskService } from '../../services/tasks/dailyTaskService';
    ```
2.  **Verify Hook Usage:** Ensure all `addTask`, `updateTask`, etc., are pulled from the `useDailyTasks` hook return value, not called directly from a service.

---

### Step 10.3: Update `TaskCSVImport.jsx`

This component has hardcoded logic to switch tables based on `verticalId`. This must be removed.

#### [MODIFY] [TaskCSVImport.jsx](file:///src/verticals/ChargingHubs/TaskCSVImport.jsx)

**Find (Lines ~27-30):**
```javascript
verticalId === 'daily_hub_tasks' 
  ? supabase.from('daily_tasks').select('id, text, hub_id, function_name')
  : supabase.from('tasks').select('id, text, hub_id, function').eq('vertical_id', verticalId)
```

**Replace with Unified Query:**
```javascript
// All tasks now come from the 'tasks' table. 
// Filter by verticalId or board type as appropriate.
supabase.from('tasks')
  .select('id, text, hub_id, function, task_board')
  .or(`vertical_id.eq.${verticalId},task_board.cs.{"DAILY"}`)
```

**Find (Lines ~167-168):**
```javascript
const { error } = await supabase
  .from(verticalId === 'daily_hub_tasks' ? 'daily_tasks' : 'tasks')
  .upsert(tasksToInsert, { onConflict: 'id' });
```

**Replace with Unified Upsert:**
```javascript
const { error } = await supabase
  .from('tasks')
  .upsert(tasksToInsert, { onConflict: 'id' });
```

---

### Step 10.4: Update `dailyTaskTemplateService.js`

Switch the generation logic to use the unified service and ensure the `task_board` tag is applied.

#### [MODIFY] [dailyTaskTemplateService.js](file:///src/services/tasks/dailyTaskTemplateService.js)

1.  **Update Import:** Replace `dailyTaskService` with `taskService`.
2.  **Update `generateSampleTask`:**
    ```javascript
    async generateSampleTask(template, userId) {
      const taskData = {
        text: `[SAMPLE] ${template.title}`,
        description: template.description,
        priority: 'Medium',
        stageId: 'BACKLOG',
        verticalId: template.verticalId,
        hub_id: template.hub_ids?.[0] || template.subjectId,
        hub_ids: template.hub_ids || [],
        assigned_to: template.assignedTo || [],
        task_board: ['DAILY'], // CRITICAL: This ensures visibility on the daily board
      };
      return taskService.addTask(taskData, userId);
    },
    ```

---

### Step 10.5: Permanent Deletion & Cleanup

1.  **Delete File:** `src/services/tasks/dailyTaskService.js`.
2.  **Global Grep:** Run the following to find any "hidden" references.
    ```bash
    grep -rn "dailyTaskService" src/
    grep -rn "daily_tasks" src/
    ```

---

## ✅ Validation Suite

### 1. Architectural Integrity
- [ ] `grep -rn "dailyTaskService" src/` returns **0 results**.
- [ ] `grep -rn "from('daily_tasks')"` returns **0 results**.

### 2. Functional Test: Daily Board
- [ ] Navigate to Charging Hubs -> Daily Tasks.
- [ ] Verify existing daily tasks appear (filtered by `task_board: ['DAILY']`).
- [ ] Create a new task. Verify it appears on the board and has `task_board: ['DAILY']` in the database.
- [ ] Update a task stage (Drag and Drop). Verify it persists.

### 3. Functional Test: CSV Import
- [ ] Perform a CSV import for Daily Tasks.
- [ ] Verify rows are written to the `tasks` table, not `daily_tasks`.
- [ ] Verify `task_board` is correctly set to `['DAILY']` for these rows.

### 4. Build Test
- [ ] `npm run build` succeeds without `Module not found` errors.

---

## ⏭️ Next Step

Proceed to [Runbook 11: Task Form UI](./11_TASK_FORM_UI.md) to implement the multi-hub selection UI in the task creation form.
