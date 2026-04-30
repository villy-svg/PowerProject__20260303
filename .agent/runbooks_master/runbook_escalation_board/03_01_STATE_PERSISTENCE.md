# Runbook 03.1: State Persistence (View Integrity Protocol)

## 1. Executive Summary & Architectural Rationale
This runbook implements the **Session Continuity Layer** for the Escalation Task Board. In PowerProject, the user's "Active View" is managed by the `activeVertical` state in `App.jsx`. To ensure that the user doesn't lose their place upon a page refresh (F5) or accidental tab closure, we persist this state to `localStorage`.

However, we do not persist ALL views. Transient views (like modals) should not be remembered. We use a **Persistence Whitelist** to define which views are "Permanent." This runbook whitelists `'escalation_tasks'`, ensuring that managers tracking critical issues can refresh the page without being kicked back to the Home dashboard.

### 1.1 Scope of Work
- **Target File**: `src/App.jsx`
- **Primary Action**: Add `'escalation_tasks'` to the `persistentVerticals` array inside the `activeVertical` synchronization `useEffect`.
- **Expected Outcome**: The browser's `localStorage` will correctly store and retrieve the Escalation Board state.

---

## 2. Implementation: Verbatim Surgical Injection

### 2.1 File Navigation & Context Discovery
**Absolute File Path**: `c:/Users/villy/OneDrive/Documents/PowerPod New/Coding Practice/PowerProject/src/App.jsx`

**Context Identification**: 
The persistence logic is located inside a `useEffect` hook that monitors `activeVertical` and `verticals`.

**Surrounding Code (Lines 305-315 approx):**
```javascript
305:   useEffect(() => {
306:     if (activeVertical) {
307:       const persistentVerticals = [
308:         'home', 
309:         verticals.CHARGING_HUBS?.id, 
310:         'hub_tasks', 
311:         'daily_hub_tasks', 
312:         'daily_task_templates',
313:         verticals.EMPLOYEES?.id, 
```

---

### 2.2 Surgical Code Modification

The following modification must be applied **EXACTLY** as shown. The order of the array doesn't matter for logic, but for clarity, we will place it immediately after `'daily_task_templates'`.

**Modification Detail**:
- **Operation**: Array Element Insertion
- **Insertion String**: `'escalation_tasks',`

#### [MODIFY] [App.jsx](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/src/App.jsx)

**Search Target (Literal Match Required):**
```javascript
'daily_hub_tasks', 
        'daily_task_templates',
        verticals.EMPLOYEES?.id, 
```

**Replacement Content (Verbatim Result):**
```javascript
'daily_hub_tasks', 
        'daily_task_templates',
        'escalation_tasks',
        verticals.EMPLOYEES?.id, 
```

---

## 3. Tool-Specific Instructions for AI Agent

If you are the implementing agent, use the following `replace_file_content` call to update the persistence layer:

```json
{
  "TargetFile": "src/App.jsx",
  "StartLine": 311,
  "EndLine": 314,
  "TargetContent": "'daily_hub_tasks', \n        'daily_task_templates',\n        verticals.EMPLOYEES?.id, ",
  "ReplacementContent": "'daily_hub_tasks', \n        'daily_task_templates',\n        'escalation_tasks',\n        verticals.EMPLOYEES?.id, ",
  "Description": "Whitelisting 'escalation_tasks' for localStorage persistence to ensure view continuity on refresh.",
  "AllowMultiple": false
}
```

---

## 4. Mandatory Defensive Coding Rules

### 4.1 Key Canonicalization
- **Rule 01**: The key MUST be exactly `'escalation_tasks'`.
- **Reason**: This must match the normalization key in `useRBAC.js`. If you use `'EscalationBoard'`, the persistence logic will save it, but the security logic will reject it on reload, causing a fallback to Home.

### 4.2 Dependency Array Integrity
- **Rule 02**: Ensure `verticals` is included in the `useEffect` dependency array.
- **Reason**: Several keys in the whitelist depend on properties of the `verticals` object (e.g., `verticals.CHARGING_HUBS?.id`). If `verticals` updates after the backend fetch, the whitelist needs to re-evaluate to include the new UUIDs.

---

## 5. Post-Implementation Verification Workflow

### 5.1 Verification Phase A: Persistence Test
1.  **Action**: Open the application.
2.  **Action**: Open Developer Tools -> **Console**.
3.  **Action**: Run: `window.dispatchEvent(new CustomEvent('setActiveVertical', { detail: 'escalation_tasks' }))`.
4.  **Action**: Check **Application** -> **Local Storage**.
5.  **Expected**: Key `power_project_active_vertical` should have value `'escalation_tasks'`.

### 5.2 Verification Phase B: Refresh Test
1.  **Action**: With the vertical set to `'escalation_tasks'`, refresh the page (Ctrl+R).
2.  **Action**: Observe the initial boot state.
3.  **Expected**: The app should load the Charging Hubs vertical sidebar (because of the normalization in Phase 1) and remain on the escalation view.

---

## 6. Troubleshooting & Failure Recovery

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **Resets to 'home' on refresh** | Typo in `'escalation_tasks'` in the array. | Verify spelling in `App.jsx`. |
| **Infinite Refresh Loop** | LocalStorage being set on every render. | Ensure the code is inside the `if (activeVertical)` guard. |
| **Wrong Sidebar Loads** | Phase 1.1 (Normalization) was skipped or failed. | Return to Runbook 01.1. |

---

## 7. Success Sign-off Matrix

- [ ] **Code Integrity**: `'escalation_tasks'` added to the persistent whitelist verbatim.
- [ ] **State Persistence**: View key survives tab closure.
- [ ] **Refresh Integrity**: View key survives F5 refresh.
- [ ] **Dependency Audit**: `useEffect` dependencies are correctly set.

---
**Runbook Status**: `READY FOR EXECUTION`
**Target Sub-Phase**: `3.1`
**Complexity**: `LOW`
**Line Count**: `~215`
