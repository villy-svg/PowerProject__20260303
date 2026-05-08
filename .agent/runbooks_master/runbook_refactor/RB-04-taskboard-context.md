# RB-04 — Extract `TaskBoardContext`

**Risk Level**: 🔴 High | **Depends On**: RB-03 complete | **Est. Time**: 3 hours

> ⛔ **BACKEND SAFETY**: This runbook moves task state into a React Context.
> It does NOT modify `src/services/tasks/taskService.js` or any service file.
> `useTasks` and `useDailyTasks` hooks remain untouched — they move inside the provider.

> ⚠️ **HIGH RISK**: A mistake here will break the task board (blank screen, no tasks).
> Complete every step, run the build, then test task CRUD before moving to RB-05.

---

## Problem

Eight task-related props are drilled from App.jsx through VerticalWorkspace down to TaskController:
`tasks`, `setTasks`, `addTask`, `updateTask`, `deleteTask`, `updateTaskStage`,
`bulkUpdateTasks`, `refreshTasks`. Plus the daily/escalation variants of each.
This creates fragile prop chains and makes every intermediary component aware of
state it doesn't own.

---

## Objective

Create `src/app/contexts/TaskBoardContext.jsx` that owns all task state.
`VerticalWorkspace` and `TaskController` consume it directly via `useTaskBoard()`.

---

## Pre-Flight Checks

Confirm RB-03 is done:
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern "useAppNavigation"
# Must return a result
```

Verify these hooks exist:
```
src/hooks/useTasks.js        ✓
src/hooks/useDailyTasks.js   ✓
```

---

## Step 1 — Create `src/app/contexts/TaskBoardContext.jsx`

```jsx
/**
 * TaskBoardContext.jsx
 * Owns all task state for the application. Resolves which task set is active
 * (regular / daily / escalation) based on the current activeVertical.
 *
 * CRITICAL IMPLEMENTATION NOTES:
 * 1. useDailyTasks depends on the SHARED tasks + setTasks from useTasks.
 *    Do NOT create a separate tasks array for daily tasks.
 * 2. escalationTasks is a derived memo of the main tasks array — it is NOT
 *    a separate fetch. It is filtered from the global tasks by task_board.
 * 3. The 'active' variants (activeTasks, activeAddTask, etc.) resolve which
 *    set is used based on the current activeVertical from AppNavigationContext.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useTasks } from '../../hooks/useTasks';
import { useDailyTasks } from '../../hooks/useDailyTasks';
import { useAppNavigation } from './AppNavigationContext';

const TaskBoardContext = createContext(null);

export function TaskBoardProvider({ user, verticals = {}, children }) {
  const { activeVertical } = useAppNavigation();

  // ── Primary Task Store ────────────────────────────────────────────────────
  const {
    tasks,
    setTasks,
    loading: tasksLoading,
    fetchTasks,
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  } = useTasks(user);

  // ── Daily Task Overlay ────────────────────────────────────────────────────
  // useDailyTasks uses the SAME tasks/setTasks — it does NOT create a third store.
  const {
    tasks: dailyTasks,
    addTask: addDailyTask,
    updateTask: updateDailyTask,
    updateTaskStage: updateDailyTaskStage,
    bulkUpdateTasks: bulkUpdateDailyTasks,
    deleteTask: deleteDailyTask,
  } = useDailyTasks(tasks, setTasks, user, fetchTasks);

  // ── Escalation Task Filter ────────────────────────────────────────────────
  // Strict filter: only tasks explicitly in the 'Escalations' task_board array.
  const escalationTasks = useMemo(() => {
    const hubId = verticals?.CHARGING_HUBS?.id;
    if (!hubId) return [];
    return tasks.filter(t =>
      t.verticalId === hubId &&
      Array.isArray(t.task_board) &&
      t.task_board.includes('Escalations')
    );
  }, [tasks, verticals?.CHARGING_HUBS?.id]);

  // ── Active Set Resolution ─────────────────────────────────────────────────
  // Which task set + CRUD actions are active for the current view?
  const isDaily      = activeVertical === 'daily_hub_tasks';
  const isEscalation = activeVertical === 'escalation_tasks';

  const activeTasks          = isDaily ? dailyTasks      : isEscalation ? escalationTasks : tasks;
  const activeAddTask        = isDaily ? addDailyTask    : addTask;
  const activeUpdateTask     = isDaily ? updateDailyTask : updateTask;
  const activeUpdateTaskStage = isDaily ? updateDailyTaskStage : updateTaskStage;
  const activeBulkUpdateTasks = isDaily ? bulkUpdateDailyTasks : bulkUpdateTasks;
  const activeDeleteTask     = isDaily ? deleteDailyTask : deleteTask;

  // ── Context Value ─────────────────────────────────────────────────────────
  const value = {
    // Raw stores (for components that need the full unfiltered list)
    tasks,
    setTasks,
    tasksLoading,
    fetchTasks,
    dailyTasks,
    escalationTasks,
    // Active-view-resolved accessors (preferred for TaskController)
    activeTasks,
    activeAddTask,
    activeUpdateTask,
    activeUpdateTaskStage,
    activeBulkUpdateTasks,
    activeDeleteTask,
    // Raw CRUD (for special cases — e.g. EmployeeManagement filtering tasks)
    addTask,
    updateTask,
    updateTaskStage,
    bulkUpdateTasks,
    deleteTask,
  };

  return (
    <TaskBoardContext.Provider value={value}>
      {children}
    </TaskBoardContext.Provider>
  );
}

/**
 * useTaskBoard — Consume task state from any component.
 */
export function useTaskBoard() {
  const ctx = useContext(TaskBoardContext);
  if (!ctx) {
    throw new Error('[useTaskBoard] Must be used inside <TaskBoardProvider>.');
  }
  return ctx;
}
```

---

## Step 2 — Update `src/App.jsx` (AppShell or App — wherever task state lives)

### 2a. Add import
```js
import { TaskBoardProvider, useTaskBoard } from './app/contexts/TaskBoardContext';
```

### 2b. Wrap AppShell render with TaskBoardProvider

In App()'s return (inside `<AppNavigationProvider>`), add:
```jsx
<AppNavigationProvider verticals={verticals}>
  <TaskBoardProvider user={user} verticals={verticals}>
    <AppShell verticals={verticals} verticalList={verticalList} />
  </TaskBoardProvider>
</AppNavigationProvider>
```

### 2c. In AppShell — REMOVE these hook calls

Find and DELETE:
```js
const { tasks, setTasks, loading: tasksLoading, fetchTasks, addTask, updateTask,
        updateTaskStage, bulkUpdateTasks, deleteTask } = useTasks(user);

const { tasks: dailyTasks, addTask: addDailyTask, updateTask: updateDailyTask,
        updateTaskStage: updateDailyTaskStage, bulkUpdateTasks: bulkUpdateDailyTasks,
        deleteTask: deleteDailyTask } = useDailyTasks(tasks, setTasks, user, fetchTasks);

const escalationTasks = useMemo(() => { ... }, [...]);
```

### 2d. In AppShell — replace with useTaskBoard() call

```js
const {
  tasks, setTasks, tasksLoading, fetchTasks,
  activeTasks, activeAddTask, activeUpdateTask,
  activeUpdateTaskStage, activeBulkUpdateTasks, activeDeleteTask,
  escalationTasks, dailyTasks,
} = useTaskBoard();
```

### 2e. Update VerticalWorkspace props in AppShell JSX

Replace all task-related props with the `active*` variants:
```jsx
<VerticalWorkspace
  tasks={activeTasks}
  setTasks={setTasks}
  addTask={activeAddTask}
  updateTask={activeUpdateTask}
  updateTaskStage={activeUpdateTaskStage}
  bulkUpdateTasks={activeBulkUpdateTasks}
  deleteTask={activeDeleteTask}
  refreshTasks={fetchTasks}
  // ... rest unchanged
/>
```

Also update `ExecutiveSummary` — it receives the full `tasks` array for dashboard stats:
```jsx
<ExecutiveSummary tasks={tasks} loading={tasksLoading} ... />
```

---

## Step 3 — Update `src/components/VerticalWorkspace.jsx`

VerticalWorkspace currently receives 8 task props and passes them to TaskController.
After this runbook, it still receives them as props (App passes them) but can also
consume the context for its own filter initialization.

**IMPLEMENT OPTION A (the safe, minimal change):**
Keep the prop interface on VerticalWorkspace unchanged for now.
TaskController still gets task props from VerticalWorkspace.
This limits the benefit but is safest.

> 🚫 **OPTION B IS FUTURE SCOPE — DO NOT IMPLEMENT IN THIS RUNBOOK.**
> Option B (having VerticalWorkspace call `useTaskBoard()` directly and stop receiving
> task props) is reserved for a follow-up runbook after the codebase is stable.

---

## Step 4 — Update `src/components/TaskController.jsx`

Same as VerticalWorkspace — keep receiving task props from VerticalWorkspace for now.
The context is available for future use.

**The immediate win**: App.jsx no longer calls `useTasks()` or `useDailyTasks()` directly.
The intermediary prop chain is the same length but the SOURCE is now the context.

---

## Step 5 — Update `ExecutiveSummary`, `EmployeeManagement`, `ClientManagement`

These components receive `tasks` as a filtered/full prop from App.jsx.
After this runbook, they get it from VerticalWorkspace's children or directly
from App.jsx via the context.

For `EmployeeManagement` (inside VerticalWorkspace children in App.jsx):
```jsx
{activeVertical === verticals.EMPLOYEES?.id && (
  <EmployeeManagement
    user={user}
    permissions={currentUserPermissions}
    tasks={tasks.filter(t => t.verticalId === verticals.EMPLOYEES?.id)}
  />
)}
```
The `tasks` here now comes from `useTaskBoard().tasks` in AppShell. No change to the JSX needed.

---

## Step 6 — Remove useTasks and useDailyTasks imports from App.jsx

After removing the hook calls:
```powershell
Select-String "src/App.jsx" -Pattern "useTasks|useDailyTasks"
# If these still appear, remove them
```

---

## Step 7 — Verification

### 7a. Build
```powershell
npm run build:staging
```

### 7b. Smoke tests
1. **Tasks load on Hub board** — tasks appear in list/kanban/tree view
2. **Daily Task Board** — opens with daily tasks (different subset)
3. **Escalation Board** — opens (may be empty if no escalation tasks exist)
4. **Add Task** — creates a task, appears in board immediately (optimistic update works)
5. **Delete Task** — task disappears from board
6. **Stage move** — drag/arrow moves task to new stage
7. **Executive Summary (dashboard)** — task counts are correct
---

## Common Pitfalls

### Pitfall 1: Escalation board always empty
**Symptom**: Escalation Task Board opens but shows no tasks even though tasks exist.
**Cause**: `verticals?.CHARGING_HUBS?.id` is undefined when the context renders
before App.jsx finishes loading verticals from the DB.
**Fix**: The `escalationTasks` memo has a guard: `if (!hubId) return []`. This means
the board will be empty until verticals load. This is correct behaviour — add a loading
state check in the component if needed.

### Pitfall 2: Optimistic updates lag
**Symptom**: After editing a task, the task card shows old data for a second.
**Cause**: `setTasks` was being called directly in `useTaskController` for optimistic
patches. If `setTasks` still comes through as a prop, this works fine. If it comes
through the context but the component also reads `activeTasks` (which is derived),
there may be a render timing issue.
**Fix**: Ensure `setTasks` from the context is the same reference as what `activeTasks`
derives from. This is guaranteed since both come from `useTasks()` inside the provider.

### Pitfall 3: DailyTasks and regular tasks not in sync
**Symptom**: Adding a daily task doesn't appear in the daily board.
**Cause**: `useDailyTasks` must receive the same `tasks` and `setTasks` from `useTasks`.
If the import order inside `TaskBoardProvider` is wrong, they could be different references.
**Fix**: Confirm that inside `TaskBoardProvider`, `useDailyTasks(tasks, setTasks, ...)` is
called using the SAME `tasks` and `setTasks` destructured from `useTasks()`.

---

## Rollback

```powershell
git checkout src/App.jsx
# Delete: src/app/contexts/TaskBoardContext.jsx
```

## Commit Checkpoint

After the build succeeds AND task CRUD smoke tests pass:
```powershell
git add -A
git commit -m "refactor: RB-04 extract TaskBoardContext"
```
