# Runbook 03.2: Filtering Engine (Core Business Logic)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Business Logic Engine** for the Escalation Task Board. In accordance with the "Virtual Vertical" architecture, we do not create a separate data store for escalations. Instead, we use a **Memoized Filter** on the global `tasks` state.

The "Live Issues" engine has three primary criteria:
1. **Vertical Isolation**: Only tasks belonging to the Charging Hubs vertical are considered.
2. **Lifecycle State**: Only "Live" tasks (not Completed/Deprioritized) are included.
3. **Escalation Trigger**: A task is included if it has a **High/Urgent Priority** OR is explicitly tagged for the **Escalations** board.

By using `useMemo`, we ensure this calculation only occurs when the `tasks` array or the vertical configuration changes, preventing UI lag during standard typing or navigation events.

### 1.1 Scope of Work
- **Target File**: `src/App.jsx`
- **Primary Action**: Inject the `escalationTasks` `useMemo` block into the main component body.
- **Expected Outcome**: A stable, reactive array of escalated tasks available for the UI.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/App.jsx`

**Context Identification**: 
The filter logic should be placed near other task-filtering logic (like `dailyTasks`) before the component's return statement.

**Surrounding Code (Lines 340-350 approx):**
```javascript
340:   const dailyTasks = useMemo(() => {
341:     return tasks.filter(t => t.task_board && t.task_board.includes('Hubs Daily'));
342:   }, [tasks]);
343: 
344:   // PLACE NEW FILTER HERE
```

---

### 2.2 Surgical Code Modification

The following modification must be applied **EXACTLY** as shown. Pay close attention to the dependency array at the end.

#### [MODIFY] [App.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/App.jsx)

**Search Target (Literal Match Required):**
```javascript
const dailyTasks = useMemo(() => {
    return tasks.filter(t => t.task_board && t.task_board.includes('Hubs Daily'));
  }, [tasks]);
```

**Replacement Content (Verbatim Result):**
```javascript
const dailyTasks = useMemo(() => {
    return tasks.filter(t => t.task_board && t.task_board.includes('Hubs Daily'));
  }, [tasks]);

  const escalationTasks = useMemo(() => {
    const hubId = verticals.CHARGING_HUBS?.id;
    if (!hubId) return [];

    return tasks.filter(t => {
      const isHubTask = t.verticalId === hubId;
      if (!isHubTask) return false;

      const isLive = t.stageId !== 'COMPLETED' && t.stageId !== 'DEPRIORITIZED';
      if (!isLive) return false;

      const isHighPriority = t.priority === 'High' || t.priority === 'Urgent';
      const isManuallyEscalated = Array.isArray(t.task_board) && t.task_board.includes('Escalations');

      return isHighPriority || isManuallyEscalated;
    });
  }, [tasks, verticals.CHARGING_HUBS?.id]);
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call for precise injection:

```json
{
  "TargetFile": "src/App.jsx",
  "StartLine": 340,
  "EndLine": 342,
  "TargetContent": "const dailyTasks = useMemo(() => {\n    return tasks.filter(t => t.task_board && t.task_board.includes('Hubs Daily'));\n  }, [tasks]);",
  "ReplacementContent": "const dailyTasks = useMemo(() => {\n    return tasks.filter(t => t.task_board && t.task_board.includes('Hubs Daily'));\n  }, [tasks]);\n\n  const escalationTasks = useMemo(() => {\n    const hubId = verticals.CHARGING_HUBS?.id;\n    if (!hubId) return [];\n\n    return tasks.filter(t => {\n      const isHubTask = t.verticalId === hubId;\n      if (!isHubTask) return false;\n\n      const isLive = t.stageId !== 'COMPLETED' && t.stageId !== 'DEPRIORITIZED';\n      if (!isLive) return false;\n\n      const isHighPriority = t.priority === 'High' || t.priority === 'Urgent';\n      const isManuallyEscalated = Array.isArray(t.task_board) && t.task_board.includes('Escalations');\n\n      return isHighPriority || isManuallyEscalated;\n    });\n  }, [tasks, verticals.CHARGING_HUBS?.id]);",
  "Description": "Implementing the 'escalationTasks' filtering engine using useMemo for reactive task aggregation.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Dependency Safety
- **Rule 01**: You MUST include `tasks` in the dependency array.
- **Reason**: If `tasks` is omitted, the Escalation Board will never update when a task is edited, moved, or created. It will show stale data forever until a full page refresh.

### 4.2 Vertical ID Matching
- **Rule 02**: Always check `t.verticalId === hubId`.
- **Reason**: Even if a task is "High Priority," it should not appear on the Hubs Escalation Board if it belongs to the "Clients" or "Employees" vertical.

### 4.3 Stage ID Precision
- **Rule 03**: Use exact string matches for `'COMPLETED'` and `'DEPRIORITIZED'`.
- **Reason**: These strings are defined in the database schema. Any typo will cause "Ghost Tasks" (completed tasks) to remain on the escalation board.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Logic Check (Manual Override)
1.  **Action**: In `App.jsx`, temporarily add `console.log('Escalation Count:', escalationTasks.length)` after the `useMemo` block.
2.  **Action**: Open the application.
3.  **Action**: Create a "Urgent" task in Hubs.
4.  **Expected**: The console should show the count increasing by 1.

### 5.2 Verification Phase B: Filter Performance
1.  **Action**: Rapidly change a task priority back and forth.
2.  **Expected**: No noticeable lag or UI freeze. The calculation should take < 1ms for typical task volumes.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Board is always empty** | `hubId` is undefined or mismatching. | Verify that `verticals.CHARGING_HUBS?.id` contains the correct vertical ID. |
| **Tasks from other verticals appear** | Missing the `isHubTask` check. | Ensure `t.verticalId === hubId` is at the top of the filter. |
| **Console Error: useMemo is not defined** | React import missing or incorrect. | Ensure `useMemo` is imported from `'react'`. |

---

## 7. Success Sign-off Matrix

- [ ] **Filter Logic**: Priority and Manual triggers are both implemented.
- [ ] **Boundary Integrity**: Tasks are correctly scoped to the Hubs vertical.
- [ ] **Lifecycle Accuracy**: Completed tasks are correctly excluded.
- [ ] **Memoization**: Dependency array is complete and stable.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `3.2`
**Complexity**: `MEDIUM`
**Line Count**: `~220`
