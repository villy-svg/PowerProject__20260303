# Runbook 05.2: E2E Scenario Testing (Functional Validation Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Full-Stack Functional Validation** for the Escalation Task Board. At this stage, every layer (Security, Service, Logic, UI) is integrated. We must now verify that the "Escalation Life Cycle" works as intended from the perspective of a real-world manager.

The Escalation Board is a reactive system. We need to confirm that:
1. **Automated Entrance**: Changing a task to "Urgent" triggers its appearance.
2. **Manual Entrance**: Manually tagging a board triggers its appearance.
3. **Automated Exit**: Completing a task triggers its removal (keeping the board "live").
4. **Data Sync**: No data is lost or duplicated during these transitions.

### 1.1 Scope of Work
- **Target Context**: Full Application Environment (UI + Supabase).
- **Primary Action**: Execution of 3 critical "Life Cycle" test scenarios.
- **Expected Outcome**: Absolute confirmation of a production-ready feature.

---

## 2. Verbatim Scenario Testing Protocols

### 2.1 Scenario A: Automated Priority Escalation (The "Critical Issue" Flow)
1.  **Action**: Open the **Hub Task Board**.
2.  **Action**: Create a new task: `"Verbatim Test A"`.
3.  **Action**: Set priority to **Medium**.
4.  **Verification**: Confirm it appears on the Hub Board but is **absent** from the Escalation Board.
5.  **Action**: Open the edit modal for `"Verbatim Test A"`.
6.  **Action**: Change priority to **Urgent**. Save.
7.  **Action**: Click "Escalation Task Board" in the sidebar.
8.  **Expected**: `"Verbatim Test A"` should be visible in the **Backlog** column.

---

### 2.2 Scenario B: Manual Board Tagging (The "Manager Oversight" Flow)
1.  **Action**: Open the **Hub Task Board**.
2.  **Action**: Create a new task: `"Verbatim Test B"`.
3.  **Action**: Set priority to **Low**.
4.  **Action**: Open the **Console** (or use the UI if available) and run:
    ```javascript
    // Simulate manual board tagging
    // Replace 'TASK_ID' with the actual ID from the UI
    taskService.updateTask('TASK_ID', { task_board: ['Hubs', 'Escalations'] });
    ```
5.  **Action**: Click "Escalation Task Board" in the sidebar.
6.  **Expected**: `"Verbatim Test B"` should be visible despite its **Low** priority.

---

### 2.3 Scenario C: Resolution & Cleanup (The "Done" Flow)
1.  **Action**: On the **Escalation Task Board**, drag `"Verbatim Test A"` to the **Completed** column.
2.  **Expected**: The task should **disappear** from the Escalation Board immediately.
3.  **Check**: Observe the total task count in the header/sidebar.
4.  **Action**: Switch back to the **Hub Task Board**.
5.  **Expected**: `"Verbatim Test A"` should be visible in the **Completed** column.
6.  **Rationale**: "Live Issues" boards must never show completed work.

---

## 3. Mandatory Defensive Testing Rules

### 3.1 Refresh Integrity Rule
- **Rule 01**: After every scenario, refresh the page (Ctrl+R).
- **Reason**: We must ensure the state is persisted in the database, not just held in the local React cache. A "False Positive" happens when the UI looks correct but the database hasn't updated.

### 3.2 Vertical Boundary Rule
- **Rule 02**: While on the Escalation Board, create a task in a different vertical (e.g., Client Manager).
- **Reason**: Confirm that tasks from other verticals never "leak" into the Hub Escalation Board, even if they are set to Urgent.

---

## 4. Troubleshooting & Verification Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Task disappears too slowly** | Optimistic UI update failed. | Check if `setTasks` is being called correctly in the `TaskController`. |
| **Task stays on board after completion** | Filter in `App.jsx` didn't check for `stageId`. | Return to Runbook 03.2 and add the `isLive` check. |
| **Task count mismatch** | Duplicate tasks in the `tasks` array. | Check for unique keys in the `.map()` loop rendering the tasks. |

---

## 5. Tool-Specific Instructions for AI Agent

If you are the implementing agent, you MUST provide a "Success Log" of your testing session:

```javascript
/**
 * TEST LOG TEMPLATE
 * Task Name: [Name]
 * Start Board: [Board]
 * Action: [Action]
 * Result: [SUCCESS/FAIL]
 */
```

---

## 6. Success Sign-off Matrix

- [ ] **Scenario A Verified**: Priority triggers work verbatim.
- [ ] **Scenario B Verified**: Manual tags work verbatim.
- [ ] **Scenario C Verified**: Completion logic works verbatim.
- [ ] **Data Sync verified**: All changes persisted to Supabase.
- [ ] **UI Polish**: Board transitions are smooth (< 200ms).

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `5.2`
**Complexity**: `MEDIUM`
**Line Count**: `~215`
