# Runbook 05.1: Context Labeling (Dynamic Header Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Dynamic Contextual Header** for the Escalation Task Board. In PowerProject, the header serves as the "Compass" for the user. It displays the vertical name (e.g., "Hub Manager") followed by the specific board context (e.g., "Hub Task Board").

When a user switches to the Escalation view, the header must dynamically update to reflect this. Without this change, a user on the Escalation Board might still see "Hub Task Board" in the header, leading to confusion about which dataset they are currently manipulating. This implementation follows the **Declarative UI** pattern by tying the label directly to the `activeVertical` state.

### 1.1 Scope of Work
- **Target File**: `src/App.jsx`
- **Primary Action**: Inject the `'escalation_tasks'` case into the `boardLabel` prop of the `VerticalWorkspace` component.
- **Expected Outcome**: The page header clearly displays "Escalation Task Board" when the view is active.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/App.jsx`

**Context Identification**: 
The `boardLabel` logic is a complex ternary/switch block passed as a prop to the `VerticalWorkspace` component instance.

**Surrounding Code (Lines 530-545 approx):**
```javascript
530:         <VerticalWorkspace
531:           activeVertical={activeVertical}
532:           boardLabel={
533:             (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :
534:             (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
535:             (activeVertical === 'hub_tasks') ? 'Hub Task Board' :
```

---

### 2.2 Surgical Code Modification

The order of this ternary is **CRITICAL**. We must ensure that the specific sub-view keys are checked before the generic vertical IDs to prevent "Label Overwriting."

**Modification Detail**:
- **Operation**: Ternary Branch Insertion
- **Insertion String**: `(activeVertical === 'escalation_tasks') ? 'Escalation Task Board' :`

#### [MODIFY] [App.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/App.jsx)

**Search Target (Literal Match Required):**
```javascript
boardLabel={
            (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :
            (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
            (activeVertical === 'hub_tasks') ? 'Hub Task Board' :
```

**Replacement Content (Verbatim Result):**
```javascript
boardLabel={
            (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :
            (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :
            (activeVertical === 'escalation_tasks') ? 'Escalation Task Board' :
            (activeVertical === 'hub_tasks') ? 'Hub Task Board' :
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to finalize the header labeling:

```json
{
  "TargetFile": "src/App.jsx",
  "StartLine": 532,
  "EndLine": 535,
  "TargetContent": "boardLabel={\n            (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :\n            (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :\n            (activeVertical === 'hub_tasks') ? 'Hub Task Board' :",
  "ReplacementContent": "boardLabel={\n            (activeVertical === 'daily_task_templates') ? 'Daily Task Templates' :\n            (activeVertical === 'daily_hub_tasks') ? 'Daily Task Board' :\n            (activeVertical === 'escalation_tasks') ? 'Escalation Task Board' :\n            (activeVertical === 'hub_tasks') ? 'Hub Task Board' :",
  "Description": "Updating the dynamic boardLabel logic to reflect the Escalation Task Board context in the page header.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Label Canonicalization
- **Rule 01**: The label MUST be exactly `'Escalation Task Board'`.
- **Reason**: This must match the string used in the sidebar navigation (Phase 4.1). Mismatched labels between the sidebar and the header create a "Broken Navigation" feel for the user.

### 4.2 Switch Ordering Logic
- **Rule 02**: Place the `escalation_tasks` check ABOVE the generic `hub_tasks` or `verticals.CHARGING_HUBS?.id` check.
- **Reason**: React evaluates ternaries in order. If the generic vertical check is higher, the header might just say "Hub Task Board" even when you are on the escalation view.

### 4.3 Null Fallback Guard
- **Rule 03**: Ensure the final fallback in the ternary chain is `'Task Board'`.
- **Reason**: This prevents the header from rendering an empty space or `undefined` if a view state is reached that hasn't been explicitly mapped.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Navigation Sync
1.  **Action**: Open the application.
2.  **Action**: Click the "Escalation Task Board" button in the sidebar.
3.  **Check**: Observe the header text.
4.  **Expected**: The header should display "Hub Manager | Escalation Task Board" (or your specific layout).

### 5.2 Verification Phase B: Persistence Labeling
1.  **Action**: While on the Escalation Board, refresh the page.
2.  **Expected**: On reload, the header should correctly initialize to "Escalation Task Board" without "Flickering" back to the home label.

---

## 6. Troubleshooting & Failure Recovery Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Label says 'Hub Task Board'** | Order of checks in `App.jsx` ternary is wrong. | Move `escalation_tasks` higher in the list. |
| **Label is empty** | `activeVertical === 'escalation_tasks'` check misspelled. | Verify the key matches `'escalation_tasks'`. |
| **Header Layout Breaks** | Label string is too long for the mobile header. | The header component should handle truncation; if not, use a shorter string like "Escalation Board." |

---

## 7. Success Sign-off Matrix

- [ ] **Context Fidelity**: Header accurately displays the escalation context.
- [ ] **String Integrity**: Label matches the sidebar text verbatim.
- [ ] **Ternary Logic**: Check order is correct for sub-view resolution.
- [ ] **State Resilience**: Label remains correct after a page refresh.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `5.1`
**Complexity**: `LOW`
**Line Count**: `~215`
