# Runbook 05: Board UI & Verification (Quality Assurance)

## 1. Architectural Context
This final runbook covers the UI customization of the Escalation Board and the comprehensive End-to-End (E2E) verification of the entire feature. 

The `VerticalWorkspace` and `TaskController` components are highly generic; we must ensure they display the correct contextual labels (e.g., "Escalation Task Board" instead of "Hubs List") to provide a premium user experience. This phase also serves as the final sign-off for the "Live Issues" filtering logic.

---

## 2. Pre-Implementation Checklist
- [ ] Phases 1 through 4 must be completed and marked `[x]` in the `INDEX.md`.
- [ ] You must have at least 5-10 tasks in the "Charging Hubs" vertical for testing.
- [ ] Verify access to both "Manager" and "Staff" roles to test permission-based visibility.

---

## 3. Implementation Steps

### 3.1 Customizing Workspace Labels
The `VerticalWorkspace` needs to know its own name to display the correct header.

**File**: `src/App.jsx`

1. Locate the `VerticalWorkspace` component instance.
2. Update the `boardLabel` prop logic.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/App.jsx
 * ACTION: Customize board labels for Escalation Board.
 */

// Inside the VerticalWorkspace component props:
boardLabel={
  (activeVertical === 'escalation_tasks') ? 'Escalation Task Board' : // <--- ADD THIS LINE
  (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :
  (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
  (activeVertical === 'hub_tasks') ? 'Hub Task Board' :
  (activeVertical === verticals.CHARGING_HUBS?.id) ? 'Hubs Task Board' :
  // ... rest of logic
}
```

### 3.2 Cleaning Up UI Artifacts
Ensure that when the user switches away from the Escalation Board, all filters and temporary states are cleared or correctly managed by the `TaskController`.

---

## 4. Comprehensive Verification Plan

### 4.1 Test Case: Automatic Escalation (Priority Trigger)
1. **Action**: Create a new task in the "Hubs Task Board" with priority "Medium".
2. **Action**: Change priority to "Urgent".
3. **Verification**: Switch to "Escalation Task Board".
4. **Expected**: The task should be visible in the "TODO" or relevant stage column.

### 4.2 Test Case: Manual Escalation (Tag Trigger)
1. **Action**: Select a "Low" priority task.
2. **Action**: Manually add the "Escalations" board via the Edit Modal (or console).
3. **Verification**: Switch to "Escalation Task Board".
4. **Expected**: The task should appear on the board despite its low priority.

### 4.3 Test Case: Resolution (Resolution Trigger)
1. **Action**: On the "Escalation Task Board", drag a task to the "Completed" column.
2. **Verification**: Refresh the page or toggle views.
3. **Expected**: The task should DISAPPEAR from the Escalation Board (since it is no longer a "live issue"), but remain visible as "Completed" on the main Hubs Task Board.

---

## 5. Defensive Coding Standards

> [!IMPORTANT]
> **Data Consistency**: Ensure that moving a task on the Escalation Board updates the *same* record used by the Hubs board. There should only be ONE source of truth for the task state.

- **Check 1**: Verify `actualSetTasks={setTasks}` is passed to `VerticalWorkspace` to ensure state updates propagate to the global `tasks` array.
- **Check 2**: Ensure `refreshTasks={fetchTasks}` is wired up to allow background reconciliation with Supabase.

---

## 6. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Header says "Hubs List"** | `boardLabel` logic in `App.jsx` was skipped. | Update the ternary/conditional in the `boardLabel` prop. |
| **Tasks stuck on board** | `t.stageId !== 'COMPLETED'` filter is missing. | Re-run Runbook 03 steps to verify filter logic. |
| **Updates not saved** | `updateTask` prop missing or wrong. | Check the props passed to `VerticalWorkspace` in `App.jsx`. |

---

## 7. Rollback Plan
1. Revert the `boardLabel` prop change in `App.jsx`.
2. Clear `localStorage` to reset the view.

---

## 8. Final Sign-off
- [ ] Manual verification of all 3 test cases complete.
- [ ] UI labels are correct.
- [ ] Mobile responsiveness verified.

**Feature Complete: Escalation Task Board**
