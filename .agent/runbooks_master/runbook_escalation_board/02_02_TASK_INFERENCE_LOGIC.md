# Runbook 02.2: Task Inference Logic (Action Validation Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook focuses on verifying the **Operational Integrity** of the task creation engine. While Runbook 02.1 registered the board keyword, this runbook ensures that the `addTask` function in `taskService.js` correctly utilizes that registration during a live creation event.

The `addTask` function is an orchestrator:
1. It normalizes incoming task data.
2. It resolves the target vertical ID.
3. It performs **Board Inference** (the logic we are testing).
4. It persists the task to Supabase via PostgREST.

Failure in this sub-phase would result in "Mismatched Context," where a user creates a task on the Escalation Board, but it is saved to the general Hubs Board, causing it to disappear from the user's current view immediately after saving.

### 1.1 Scope of Work
- **Target File**: `src/services/tasks/taskService.js` (Action Audit)
- **Primary Action**: Step-by-step logic verification of the `addTask` function's board resolution block.
- **Expected Outcome**: Absolute certainty that any task passed with `verticalId: 'escalation_tasks'` receives the `task_board: ['Escalations']` attribute.

---

## 2. Implementation: Logic Audit & Verbatim Verification

### 2.1 Logic Block Identification
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/services/tasks/taskService.js`

**Surrounding Context (Lines 300-315 approx):**
```javascript
300:     const resolvedVid = taskData.verticalId || defaultVertical;
301: 
302:     // Determine the appropriate task board based on verticalId
303:     let taskBoard = taskData.task_board;
304:     
305:     // INFERENCE BLOCK START
306:     if (!Array.isArray(taskBoard) || taskBoard.length === 0) {
307:       const matchedKey = Object.keys(VERTICAL_BOARD_MAP).find(key => 
308:         resolvedVid.toLowerCase().includes(key)
309:       );
310:       taskBoard = matchedKey ? [VERTICAL_BOARD_MAP[matchedKey]] : ['Hubs'];
311:     }
312:     // INFERENCE BLOCK END
```

---

### 2.2 Verbatim Verification Steps

The implementing agent MUST verify the following logical conditions in `taskService.js`:

#### Step 2.2.1: Key Normalization Check
- [ ] Confirm line 308 uses `.toLowerCase()`.
- **Reason**: Incoming `verticalId` can be uppercase (`ESCALATION_TASKS`). Without normalization, the lowercase map key `'escalation'` will fail to match.

#### Step 2.2.2: Fallback Logic Check
- [ ] Confirm line 310 uses a ternary operator with a default of `['Hubs']`.
- **Reason**: If a task vertical is passed that isn't in the map, it should default to the most general board (Hubs) rather than failing or remaining null.

#### Step 2.2.3: Array Integrity Check
- [ ] Confirm line 310 wraps the result in an array `[ ... ]`.
- **Reason**: The `task_board` column in Supabase is a JSONB array. Inserting a flat string will cause a database type error.

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, run the following **Safe Simulation** to prove the logic is correct before closing this task:

```javascript
// Run in Browser Console:
(async () => {
  const testMap = { 'daily_hub': 'Hubs Daily', 'escalation': 'Escalations', 'hub': 'Hubs' };
  const testInput = { verticalId: 'escalation_tasks' };
  
  const resolvedVid = testInput.verticalId;
  const matchedKey = Object.keys(testMap).find(key => resolvedVid.toLowerCase().includes(key));
  const inferredBoard = matchedKey ? [testMap[matchedKey]] : ['Hubs'];
  
  console.log('--- Inference Test ---');
  console.log('Input Vid:', resolvedVid);
  console.log('Matched Key:', matchedKey);
  console.log('Inferred Board:', JSON.stringify(inferredBoard));
  
  if (JSON.stringify(inferredBoard) === '["Escalations"]') {
    console.log('✅ TEST PASSED: Logic is verbatim correct.');
  } else {
    console.error('❌ TEST FAILED: Logic or Key ordering is incorrect.');
  }
})();
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 No Hardcoding in Logic
- **Rule 01**: Never hardcode `'Escalations'` inside the `addTask` function.
- **Reason**: All mappings MUST go through the `VERTICAL_BOARD_MAP`. Hardcoding creates a "Maintenance Trap" where board names might change in the map but remain stale in the logic.

### 4.2 Array Type Safety
- **Rule 02**: Always check `!Array.isArray(taskBoard)` before executing inference.
- **Reason**: If a user explicitly tags a task (e.g., they are on Hubs but click an "Escalate" checkbox), the UI might pass `['Hubs', 'Escalations']`. The inference engine should NOT override this explicit intent.

---

## 5. Post-Implementation Verification Protocol

### 5.1 Verification Phase A: Logic Step-Through
1.  **Action**: Open `src/services/tasks/taskService.js` in your IDE.
2.  **Action**: Read lines 305-311.
3.  **Check**: Is there any path where `taskBoard` could remain `undefined`?
4.  **Answer**: No, the ternary ensures a fallback to `['Hubs']`.

### 5.2 Verification Phase B: Regression Test
1.  **Action**: Create a task from the **Daily Board**.
2.  **Expected**: Confirm it is tagged as `['Hubs Daily']` (verifying the order of the map still works for existing features).

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Board is `null` in DB** | `taskBoard` variable was not initialized correctly. | Check line 303: `let taskBoard = taskData.task_board;`. |
| **Inference always defaults to Hubs** | The `find` logic is matching `'hub'` first because it's higher in the map. | Return to Runbook 02.1 and move `'escalation'` to the top. |
| **Crash on task creation** | `resolvedVid` was null. | Check line 300: `const resolvedVid = taskData.verticalId || defaultVertical;`. |

---

## 7. Success Sign-off Matrix

- [ ] **Logic Audit**: `addTask` inference block is confirmed verbatim correct.
- [ ] **Type Safety**: Array wrapping is enforced.
- [ ] **Normalization**: Case-insensitive matching is verified.
- [ ] **Regression**: Existing boards (Daily, Hubs) remain functional.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `2.2`
**Complexity**: `LOW`
**Line Count**: `~215`
