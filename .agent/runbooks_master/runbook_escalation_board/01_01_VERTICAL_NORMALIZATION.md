# Runbook 01.1: Vertical Normalization (Security Boundary Implementation)

## 1. Executive Summary & Architectural Rationale
This runbook focuses on the **Security Normalization** of the Escalation Task Board. In the PowerProject architecture, "Verticals" (Hubs, Clients, Employees) are the primary security boundaries. However, the system allows for "Sub-views" or "Transient Verticals" (like `daily_hub_tasks` or `escalation_tasks`) to provide specialized workflows within these boundaries.

To ensure that Role-Based Access Control (RBAC) and Row-Level Security (RLS) policies are correctly applied, these transient keys MUST be normalized back to their root vertical ID. Without this normalization, a user navigating to the Escalation Board might be treated as having "No Vertical Context," causing a total failure of permission checks and data loading.

### 1.1 Scope of Work
- **Target File**: `src/hooks/useRBAC.js`
- **Primary Action**: Update the `rootVerticalId` ternary chain to recognize `escalation_tasks`.
- **Expected Outcome**: When `activeVertical` is `'escalation_tasks'`, `rootVerticalId` will resolve to the Hubs Vertical ID (UUID).

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/hooks/useRBAC.js`

**Context Identification**: 
The normalization logic is located within the `useMemo` block of the `useRBAC` hook. Specifically, it resides in the **Vertical Scope** derivation section.

**Surrounding Code (Lines 64-72 approx):**
```javascript
64:     const current = activeVertical || 'home';
65: 
66:     // Normalize sub-views back to their root vertical ID
67:     const rootVerticalId = 
68:       (current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates') ? verticals.CHARGING_HUBS?.id :
69:       (current === verticals.CLIENTS?.id || current === 'client_tasks' || current === 'leads_funnel') ? verticals.CLIENTS?.id :
70:       (current === verticals.EMPLOYEES?.id || current === 'employee_tasks') ? verticals.EMPLOYEES?.id :
71:       current.toUpperCase();
```

---

### 2.2 Surgical Code Modification

The following modification must be applied **EXACTLY** as shown. Do not add whitespace, remove semicolons, or change the capitalization of the keys.

**Modification Detail**:
- **Operation**: String Insertion in Ternary Condition
- **Insertion String**: ` || current === 'escalation_tasks'`

#### [MODIFY] [useRBAC.js](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/hooks/useRBAC.js)

**Search Target (Literal Match Required):**
```javascript
(current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates')
```

**Replacement Content (Verbatim Result):**
```javascript
(current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates' || current === 'escalation_tasks')
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to ensure zero error:

```json
{
  "TargetFile": "src/hooks/useRBAC.js",
  "StartLine": 67,
  "EndLine": 69,
  "TargetContent": "(current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates')",
  "ReplacementContent": "(current === verticals.CHARGING_HUBS?.id || current === 'hub_tasks' || current === 'daily_hub_tasks' || current === 'daily_task_templates' || current === 'escalation_tasks')",
  "Description": "Normalizing the 'escalation_tasks' view key to the CHARGING_HUBS root vertical ID in the RBAC hook.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

To prevent regressions during this sub-phase, the implementing agent MUST adhere to these rules:

### 4.1 String Consistency Protocol
The string `'escalation_tasks'` is the **Global View Key**.
- **Rule 01**: Never use camelCase (`escalationTasks`).
- **Rule 02**: Never use PascalCase (`EscalationTasks`).
- **Rule 3**: Never use snake_case variants like `hub_escalations`.
- **Reason**: The routing engine, localStorage persistence, and sidebar navigation ALL rely on this exact character-for-character string.

### 4.2 Optional Chaining Guard
The `verticals.CHARGING_HUBS?.id` expression uses the optional chaining operator (`?.`).
- **Rule 04**: Do NOT remove the `?`.
- **Reason**: During the initial application boot cycle, the `verticals` object might be an empty object `{}` before the backend fetch completes. Removing the `?` will cause a "TypeError: Cannot read property 'id' of undefined" which will crash the entire app.

### 4.3 Ternary Fallthrough Integrity
- **Rule 05**: Ensure the final fallback `current.toUpperCase()` remains at the end of the chain.
- **Reason**: This ensures that any new, unmapped verticals (e.g., custom ad-hoc verticals) still receive a valid `rootVerticalId` based on their name.

---

## 5. Post-Implementation Verification Workflow

After applying the code change, perform the following verification steps in sequence. Do not skip any step.

### 5.1 Verification Phase A: Static Syntax Check
- [ ] Open `src/hooks/useRBAC.js`.
- [ ] Scroll to line 68.
- [ ] Visually confirm the presence of `|| current === 'escalation_tasks'`.
- [ ] Confirm no missing parentheses `)` at the end of the Hubs condition group.

### 5.2 Verification Phase B: Runtime Logic Test
Since the UI for the Escalation Board does not exist yet, we must simulate the state via the browser console.

1.  **Action**: Open the application in a browser.
2.  **Action**: Open Developer Tools (F12) -> **Console**.
3.  **Action**: Run the following command to force the view state:
    ```javascript
    localStorage.setItem('power_project_active_vertical', 'escalation_tasks');
    window.location.reload();
    ```
4.  **Action**: After reload, run the following command to check the resolved vertical:
    ```javascript
    // This assumes the permissions object is logged or accessible
    // If not, add a temporary console.log(rootVerticalId) in useRBAC.js
    ```
5.  **Expected Output**: The `rootVerticalId` must match the UUID of the Hub Manager vertical (usually starting with `charging_hubs_...` or a standard UUID string).

### 5.3 Verification Phase C: Vertical Isolation Audit
1.  **Action**: In the console, set vertical to `client_tasks`.
2.  **Expected**: Confirm that `rootVerticalId` resolves to the Clients UUID, NOT the Hubs UUID.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Blank White Screen** | Syntax error (e.g., missing parenthesis) in `useRBAC.js`. | Revert `useRBAC.js` immediately. Check for linter errors. |
| **Permissions Fail** | Typo in `'escalation_tasks'`. | Verify spelling matches Runbook 01.1 exactly. |
| **All Boards Break** | `verticals` object was mutated incorrectly. | Ensure you only modified the ternary condition, not the `verticals` mapping. |

---

## 7. Success Sign-off Matrix

- [ ] **File Modified**: `src/hooks/useRBAC.js` is updated verbatim.
- [ ] **Normalization Tested**: `escalation_tasks` resolves to `CHARGING_HUBS`.
- [ ] **Syntax Integrity**: Linter passes (no red squiggles in IDE).
- [ ] **Regression Test**: Hub Tasks Board still loads correctly.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `1.1`
**Complexity**: `LOW`
**Line Count**: `~215`
