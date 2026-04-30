# Runbook 03: Data Filtering & State (Core Engine)

## 1. Architectural Context
The `App.jsx` file is the central orchestrator of state in PowerProject. It manages the `activeVertical` and the global `tasks` array. 

For the Escalation Board, we are implementing a **Virtual Vertical**. Unlike "Employees" or "Clients" which have their own `vertical_id`, the Escalation Board is a dynamic filter across the `CHARGING_HUBS` vertical. This runbook covers the integration of this filtering logic and the persistence of the "Escalation Board" view state.

---

## 2. Pre-Implementation Checklist
- [ ] Ensure `useMemo` is imported in `App.jsx`.
- [ ] Confirm `verticals.CHARGING_HUBS?.id` is correctly populated.
- [ ] Verify that `tasks` array contains `priority` and `task_board` fields.

---

## 3. Implementation Steps

### 3.1 Persistent View State
We need the browser to remember if the user was on the Escalation Board after a refresh.

**File**: `src/App.jsx`

1. Locate the `useEffect` that manages `localStorage` for `activeVertical` (around line 306).
2. Add `'escalation_tasks'` to the `persistentVerticals` array.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/App.jsx
 * ACTION: Add 'escalation_tasks' to persistence whitelist.
 */

useEffect(() => {
  if (activeVertical) {
    const persistentVerticals = [
      'home', 
      verticals.CHARGING_HUBS?.id, 
      'hub_tasks', 
      'daily_hub_tasks', 
      'daily_task_templates', 
      'escalation_tasks', // <--- ADD THIS LINE
      verticals.EMPLOYEES?.id, 
      'employee_tasks', 
      verticals.CLIENTS?.id, 
      'client_tasks', 
      'leads_funnel'
    ];
    if (persistentVerticals.includes(activeVertical)) {
      localStorage.setItem('power_project_active_vertical', activeVertical);
    }
  } else {
    localStorage.setItem('power_project_active_vertical', 'home');
  }
}, [activeVertical, verticals]);
```

### 3.2 Dynamic Escalation Filtering
This is the "Brain" of the Escalation Board. It combines automatic priority-based filtering with manual board tagging.

**File**: `src/App.jsx` (inside the component body, before the return)

1. Implement the `useMemo` hook to calculate the `escalationTasks`.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/App.jsx
 * ACTION: Implement Escalation filtering logic.
 */

const escalationTasks = useMemo(() => {
  const hubId = verticals.CHARGING_HUBS?.id;
  if (!hubId) return [];

  return tasks.filter(t => {
    // 1. Must belong to Charging Hubs vertical
    const isHubTask = t.verticalId === hubId;
    if (!isHubTask) return false;

    // 2. Must be an active issue (not completed)
    const isNotCompleted = t.stageId !== 'COMPLETED';
    if (!isNotCompleted) return false;

    // 3. Meet escalation criteria:
    //    a) High or Urgent Priority
    const isHighPriority = t.priority === 'High' || t.priority === 'Urgent';
    //    b) Explicitly tagged in 'Escalations' board
    const isManuallyEscalated = Array.isArray(t.task_board) && t.task_board.includes('Escalations');

    return isHighPriority || isManuallyEscalated;
  });
}, [tasks, verticals.CHARGING_HUBS?.id]);
```

### 3.3 Workspace Prop Wiring
Finally, we must pass these tasks to the `VerticalWorkspace` when the `escalation_tasks` view is active.

**File**: `src/App.jsx` (inside the JSX return)

```javascript
<VerticalWorkspace
  // ... other props
  tasks={
    activeVertical === 'daily_hub_tasks' ? dailyTasks : 
    activeVertical === 'escalation_tasks' ? escalationTasks : // <--- ADD THIS LINE
    tasks
  }
  // ...
/>
```

---

## 4. Defensive Coding Standards

> [!CAUTION]
> **Performance**: Filtering the entire `tasks` array (which can contain 1000+ items) inside a render cycle is expensive. Always wrap the filtering logic in `useMemo` with proper dependencies (`tasks`, `verticals`).

- **Array Verification**: Always use `Array.isArray(t.task_board)` before calling `.includes()`.
- **String Constants**: Use the string `'Escalations'` exactly as defined in `taskService.js`.
- **Vertical ID Null Check**: Always guard against `verticals.CHARGING_HUBS?.id` being null to prevent `t.verticalId === undefined` matching incorrectly.

---

## 5. Verification Workflow

### 5.1 Manual Verification (Priority Auto-Escalation)
1. Go to "Hubs Task Board".
2. Create a task with "Low" priority.
3. Observe it is NOT on the Escalation Board.
4. Change priority to "Urgent".
5. Observe it appears on the Escalation Board.

### 5.2 Manual Verification (Explicit Tagging)
1. Use the console to manually tag a "Low" priority task.
```javascript
// Run in console to test
await taskService.updateTask({ ...myTask, task_board: ['Hubs', 'Escalations'] });
```
2. Verify the task appears on the Escalation Board despite low priority.

---

## 6. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Tasks Missing** | `t.verticalId` case mismatch. | Use `.toUpperCase()` or strict enum comparison. |
| **Completed Tasks Visible** | `t.stageId !== 'COMPLETED'` logic omitted. | Add the stage filter to the `useMemo`. |
| **Infinite Re-renders** | `useMemo` deps unstable. | Ensure `verticals` object reference is stable. |

---

## 7. Rollback Plan
1. Revert the `useMemo` block in `App.jsx`.
2. Remove `'escalation_tasks'` from the persistence whitelist.
3. The board will effectively become empty or redirect to Home.

---

## 8. Progress Tracking
- [ ] Step 3.1: Persistence whitelist updated.
- [ ] Step 3.2: `useMemo` filter implemented.
- [ ] Step 3.3: Workspace props wired.
- [ ] Step 5: Filtering logic verified.

**Next Runbook**: `04_SIDEBAR_NAVIGATION.md`
