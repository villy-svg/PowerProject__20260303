# Runbook 02.1: Board Registration (Service Mapping Infrastructure)

## 1. Executive Summary & Architectural Rationale
The PowerProject task ecosystem relies on a sophisticated **Inference Engine** to determine which boards a task should be visible on. This is governed by the `VERTICAL_BOARD_MAP` constant in `taskService.js`. 

When a user creates a task, the system analyzes the `verticalId`. If the `verticalId` contains a recognized keyword (like `'hub'`, `'daily'`, or `'client'`), it automatically assigns the corresponding board name to the `task_board` JSONB array. 

This runbook registers the `'escalation'` keyword. This registration is critical because it ensures that any task created while the user is on the Escalation Board is automatically "Born" as an Escalation, ensuring it appears on the board without manual intervention.

### 1.1 Scope of Work
- **Target File**: `src/services/tasks/taskService.js`
- **Primary Action**: Register the `'escalation'` keyword and map it to the `'Escalations'` board name.
- **Expected Outcome**: The `addTask` function will correctly infer the `Escalations` board when the `verticalId` is `escalation_tasks`.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/services/tasks/taskService.js`

**Context Identification**: 
The `VERTICAL_BOARD_MAP` is a top-level constant used for task classification.

**Surrounding Code (Lines 38-44 approx):**
```javascript
38: const TASK_SELECT = `*, task_context_links(*), latestSubmission:task_submissions(*), submissions:task_submissions(*)`;
39: 
40: const VERTICAL_BOARD_MAP = {
41:   'daily_hub': 'Hubs Daily',
42:   'hub':       'Hubs',
43:   'client':    'Clients',
44:   'employee':  'Employees',
```

---

### 2.2 Surgical Code Modification

The order of keys in this object is **MISSION CRITICAL**. The engine uses the first match it finds. Since `escalation_tasks` contains the word `tasks` (which isn't a key but could be added later) and potentially `hub` if mislabeled, we must place the more specific `escalation` key **ABOVE** the general `hub` key.

**Modification Detail**:
- **Operation**: Object Property Insertion (Priority Placement)
- **Insertion String**: `'escalation': 'Escalations',`

#### [MODIFY] [taskService.js](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/services/tasks/taskService.js)

**Search Target (Literal Match Required):**
```javascript
const VERTICAL_BOARD_MAP = {
  'daily_hub': 'Hubs Daily',
  'hub':       'Hubs',
```

**Replacement Content (Verbatim Result):**
```javascript
const VERTICAL_BOARD_MAP = {
  'daily_hub': 'Hubs Daily',
  'escalation': 'Escalations',
  'hub':       'Hubs',
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call for precise injection:

```json
{
  "TargetFile": "src/services/tasks/taskService.js",
  "StartLine": 40,
  "EndLine": 43,
  "TargetContent": "const VERTICAL_BOARD_MAP = {\n  'daily_hub': 'Hubs Daily',\n  'hub':       'Hubs',",
  "ReplacementContent": "const VERTICAL_BOARD_MAP = {\n  'daily_hub': 'Hubs Daily',\n  'escalation': 'Escalations',\n  'hub':       'Hubs',",
  "Description": "Registering the 'escalation' keyword in the board mapping registry with high priority matching.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Keyword Priority Protocol
- **Rule 01**: Always place `'escalation'` ABOVE `'hub'`.
- **Reason**: The `Object.keys().find()` method iterates in order. If `'hub'` is matched first for an `escalation_tasks` ID (because it's a substring), the task will be incorrectly assigned to the Hubs board only.

### 4.2 Case Sensitivity Guard
- **Rule 02**: Use all lowercase for the key (`'escalation'`).
- **Reason**: The inference engine executes `.toLowerCase()` on the `verticalId` before searching the map. Using any capital letters in the key will result in a mismatch.

### 4.3 Pluralization Standard
- **Rule 03**: The value MUST be `'Escalations'` (Plural, Title Case).
- **Reason**: This must match the string filter used in `App.jsx` (Phase 2) and the database auditing queries. Inconsistency here will lead to "Invisible Tasks."

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Logic Audit
1.  **Action**: Open `src/services/tasks/taskService.js`.
2.  **Action**: Confirm that `'escalation'` is the second key in the object.
3.  **Action**: Confirm the value is exactly `'Escalations'`.

### 5.2 Verification Phase B: Simulated Inference Test
1.  **Action**: Open Browser Console.
2.  **Action**: Copy-paste the following simulation script:
    ```javascript
    const testMap = { 'daily_hub': 'Hubs Daily', 'escalation': 'Escalations', 'hub': 'Hubs' };
    const testId = 'escalation_tasks';
    const match = Object.keys(testMap).find(k => testId.toLowerCase().includes(k));
    console.log('Resulting Board:', match ? testMap[match] : 'Failed');
    ```
3.  **Expected Output**: `Resulting Board: Escalations`.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Tasks go to 'Hubs'** | Wrong order in `VERTICAL_BOARD_MAP`. | Move `'escalation'` above `'hub'`. |
| **Inference returns 'Failed'** | Typo in the key name. | Verify the key is `'escalation'`. |
| **Syntax Error** | Missing comma at the end of the new line. | Ensure the comma `,` is present. |

---

## 7. Success Sign-off Matrix

- [ ] **Code Insertion**: `'escalation'` key is registered verbatim.
- [ ] **Inference Check**: Priority order is correctly established.
- [ ] **String Integrity**: Value is `'Escalations'`.
- [ ] **App Stability**: Application boots without service-layer errors.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `2.1`
**Complexity**: `LOW`
**Line Count**: `~210`
