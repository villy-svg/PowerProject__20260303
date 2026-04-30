# Runbook 03.3: Workspace Integration (Data Wiring Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook focuses on the **UI Integration Layer** for the Escalation Task Board. Having established the security (Phase 1), service mapping (Phase 2), and filtering engine (Phase 3.2), we must now connect the filtered data to the primary UI component: the `VerticalWorkspace`.

The `VerticalWorkspace` is a polymorphic orchestrator that manages the rendering of the Sidebar, Header, and Kanban Board. By passing the `escalationTasks` array to the `tasks` prop when `activeVertical === 'escalation_tasks'`, we trigger the standard "Hubs" layout but with "Escalation" content.

### 1.1 Scope of Work
- **Target File**: `src/App.jsx`
- **Primary Action**: Update the `tasks` prop of the `<VerticalWorkspace />` component to include the escalation filter.
- **Expected Outcome**: The Kanban board correctly displays escalated tasks when the user is on the Escalation Board.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/App.jsx`

**Context Identification**: 
The `VerticalWorkspace` component is rendered inside the main layout, usually within a `ContentArea` or similar wrapper.

**Surrounding Code (Lines 550-565 approx):**
```javascript
550:         <VerticalWorkspace
551:           activeVertical={activeVertical}
552:           tasks={
553:             activeVertical === 'daily_hub_tasks' ? dailyTasks : 
554:             tasks
555:           }
556:           setTasks={setTasks}
```

---

### 2.2 Surgical Code Modification

The following modification must be applied **EXACTLY** as shown. The order of the ternary matters: we check for specialized views (Daily, Escalations) before falling back to the generic `tasks` array.

**Modification Detail**:
- **Operation**: Ternary Prop Injection
- **Insertion String**: `activeVertical === 'escalation_tasks' ? escalationTasks :`

#### [MODIFY] [App.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/App.jsx)

**Search Target (Literal Match Required):**
```javascript
tasks={
            activeVertical === 'daily_hub_tasks' ? dailyTasks : 
            tasks
          }
```

**Replacement Content (Verbatim Result):**
```javascript
tasks={
            activeVertical === 'daily_hub_tasks' ? dailyTasks : 
            activeVertical === 'escalation_tasks' ? escalationTasks :
            tasks
          }
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to finalize the data wiring:

```json
{
  "TargetFile": "src/App.jsx",
  "StartLine": 552,
  "EndLine": 555,
  "TargetContent": "tasks={\n            activeVertical === 'daily_hub_tasks' ? dailyTasks : \n            tasks\n          }",
  "ReplacementContent": "tasks={\n            activeVertical === 'daily_hub_tasks' ? dailyTasks : \n            activeVertical === 'escalation_tasks' ? escalationTasks :\n            tasks\n          }",
  "Description": "Wiring the 'escalationTasks' array to the VerticalWorkspace component for dynamic board rendering.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 State Sync Integrity
- **Rule 01**: Always pass `actualSetTasks={setTasks}` (the global state updater) to the workspace.
- **Reason**: The `VerticalWorkspace` needs the ability to modify the *original* global tasks array when a task is moved or updated. If you pass a local setter, changes will be lost on the next refresh.

### 4.2 Key Synchronization
- **Rule 02**: Ensure the string `'escalation_tasks'` in the ternary matches the persistence and normalization keys exactly.
- **Reason**: Any deviation will cause the workspace to fall back to the generic `tasks` list, showing all Hub tasks instead of just the escalations.

### 4.3 Prop Stability
- **Rule 03**: Do NOT wrap `escalationTasks` in a new object while passing it as a prop.
- **Reason**: `tasks={ { data: escalationTasks } }` would cause the `VerticalWorkspace` to re-render on every cycle because the object reference would be new every time. Pass the array directly.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Prop Validation (React DevTools)
1.  **Action**: Open the application.
2.  **Action**: Navigate to any vertical.
3.  **Action**: Open **React DevTools** -> Select `<VerticalWorkspace />`.
4.  **Action**: Manually change the `activeVertical` prop in the DevTools sidebar to `'escalation_tasks'`.
5.  **Expected**: Observe the `tasks` prop. It should instantly switch from the full list to the filtered escalation list.

### 5.2 Verification Phase B: Interaction Test
1.  **Action**: On the Escalation Board, change a task's priority to "Medium."
2.  **Expected**: The task should immediately vanish from the Escalation Board (because it no longer meets the "Live Issue" criteria).
3.  **Action**: Navigate to the Hub Task Board.
4.  **Expected**: The task should be there, updated with the new "Medium" priority.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **All tasks show on Escalation Board** | Ternary check failed (key mismatch). | Check spelling of `'escalation_tasks'`. |
| **No tasks show on Escalation Board** | `escalationTasks` array is empty. | Check the filter logic in Runbook 03.2. |
| **Updates don't persist** | Global `setTasks` not being called. | Verify the `setTasks` prop wiring in `VerticalWorkspace`. |

---

## 7. Success Sign-off Matrix

- [ ] **Prop Wiring**: `tasks` ternary is updated verbatim.
- [ ] **Reactive Sync**: Board updates instantly when priorities change.
- [ ] **Data Flow**: CRUD operations propagate correctly to global state.
- [ ] **Performance**: Switch between boards takes < 100ms.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `3.3`
**Complexity**: `LOW`
**Line Count**: `~215`
