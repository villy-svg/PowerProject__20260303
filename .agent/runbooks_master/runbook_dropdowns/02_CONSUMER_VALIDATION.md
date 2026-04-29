# Phase 1.1: Consumer Validation — Runbook

> **STANDALONE DOCUMENT.** This runbook can be executed with zero prior context. It assumes Phase 1 (`01_MULTI_SELECT_CONTROLS.md`) has been completed. All context needed to validate every consumer form is contained in this file.

---

## Mission

Verify that every form that **consumes** `<HubSelector>`, `<AssigneeSelector>`, or `<CustomSelect>` continues to function correctly after the Phase 1 component hardening. This phase is read-and-validate, not write-and-refactor — fix only what is actually broken.

---

## Pre-Flight: What You Need to Know

### The Component Contracts (Recap)

| Component | `value` type | `onChange` signature |
|:---|:---|:---|
| `<CustomSelect>` | `string` | `(val: string) => void` |
| `<HubSelector>` | `string[]` | `(val: string[]) => void` |
| `<AssigneeSelector>` | `string[]` | `(val: string[]) => void` |

**Critical rules to check in every consumer:**
1. `<CustomSelect>` → `onChange` must receive the raw `val` string, NOT `(e) => fn(e.target.value)`
2. `<HubSelector>` → `value` must be an array, never a string or `null`
3. `<AssigneeSelector>` → `value` must be an array, never a string or `null`

### The Four Consumer Forms in Scope

| File | Vertical | Uses |
|:---|:---|:---|
| `src/verticals/ChargingHubs/HubTaskForm.jsx` | Charging Hubs | `HubSelector`, `AssigneeSelector`, `CustomSelect` |
| `src/verticals/Employees/EmployeeTaskForm.jsx` | Employees | `AssigneeSelector`, `CustomSelect` |
| `src/verticals/Clients/ClientTaskForm.jsx` | Clients | `AssigneeSelector`, `CustomSelect` |
| `src/verticals/ChargingHubs/DailyTasksManagement.jsx` | Daily Tasks | `AssigneeSelector`, `CustomSelect` |

---

## Consumer 1: `HubTaskForm.jsx`

**Full path:** `src/verticals/ChargingHubs/HubTaskForm.jsx`

### What This Form Does

This is the most complex consumer. It is a 2-step wizard:
- **Step 1:** Task details form — user fills in city, hub(s), assignee(s), priority, function, parent task, description
- **Step 2:** Orchestration screen — when 2+ hubs or 2+ assignees are selected, the user can assign a specific person to each hub

It uses:
- `<CustomSelect>` for: City, Priority, Function
- `<HubSelector>` for: Hub selection (multi-select)
- `<AssigneeSelector>` for: Assignee selection (multi-select) AND per-hub orchestration (single-select mode)

### State Architecture

Uses the `useTaskForm(initialData)` hook. Key state fields:
- `formData.city` → string
- `formData.hub_ids` → string[] (array of hub UUIDs)
- `formData.assigned_to` → string[] (array of employee UUIDs)
- `formData.priority` → string
- `formData.function` → string
- `orchestrationMapping` → `[{ hub_id: string, assigned_to: string[] }]`

Updates via `updateField(key, value)` or `updateFields({ key: value, ... })`.

### Validation Checklist

**Step 1.** Verify `<CustomSelect>` for City (line ~255):
```jsx
<CustomSelect
  id="city-select"
  value={formData.city}
  onChange={(val) => handleCityChange({ target: { value: val } })}
  options={uniqueCities.map(city => ({ label: city, value: city }))}
  placeholder="Select City..."
  disabled={!taskUtils.canUserEditField(initialData, 'city', permissions, currentUser)}
/>
```
⚠️ Note: `onChange` here wraps `val` in a synthetic event object `{ target: { value: val } }` to call `handleCityChange`. This is intentional because `handleCityChange` needs to reset `hub_ids` as a side effect. This is NOT a bug — the adapter is needed here.

**Step 2.** Verify `<HubSelector>` (line ~269):
```jsx
<HubSelector
  id="hub-selector"
  hubs={filteredHubs}
  value={formData.hub_ids}
  onChange={(val) => updateField('hub_ids', val)}
  disabled={!formData.city || !taskUtils.canUserEditField(initialData, 'hub_id', permissions, currentUser)}
/>
```
- `value` must be `formData.hub_ids` (a `string[]`). ✅ Verify `hub_ids` is initialized as `[]` in `useTaskForm`.
- `hubs` must be `filteredHubs` (NOT `hubs`) — `filteredHubs = formData.city ? hubs.filter(h => h.city === formData.city) : []`.
- `disabled` should be true when no city is selected.

**Step 3.** Verify `<AssigneeSelector>` in Step 1 (line ~302):
```jsx
<AssigneeSelector
  id="assignee-selector"
  value={formData.assigned_to}
  onChange={(val) => updateField('assigned_to', val)}
  currentUser={currentUser}
  disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
/>
```
- `value` must be `formData.assigned_to` (a `string[]`). ✅

**Step 4.** Verify `<CustomSelect>` for Priority (line ~284):
```jsx
<CustomSelect
  id="priority-select"
  value={formData.priority}
  onChange={(val) => updateField('priority', val)}
  options={[
    { label: 'Low', value: 'Low' },
    { label: 'Medium', value: 'Medium' },
    { label: 'High', value: 'High' },
    { label: 'Urgent', value: 'Urgent' }
  ]}
  disabled={...}
/>
```
- `onChange={(val) => updateField('priority', val)}` — `val` is the raw string. ✅

**Step 5.** Verify `<CustomSelect>` for Function (line ~317):
```jsx
<CustomSelect
  id="function-select"
  value={formData.function}
  onChange={(val) => updateField('function', val)}
  options={[
    { label: 'N/A (General)', value: '' },
    ...functions.map(fn => ({
      label: fn.function_code ? `[${fn.function_code}] ${fn.name}` : fn.name,
      value: fn.name
    }))
  ]}
  placeholder="Select Function..."
  disabled={...}
/>
```
⚠️ The empty/unset state uses `value: ''`. Verify `formData.function` is initialized to `''` (empty string) not `null` or `undefined`. If it's `null`, `<CustomSelect>` will show the placeholder but selection state may be inconsistent.

**Step 6.** Verify Orchestration Step — per-hub `<AssigneeSelector>` (line ~373):
```jsx
{orchestrationMapping.map((item, idx) => (
  <div key={item.hub_id || idx} className="form-group">
    <label>{hubs.find(h => h.id === item.hub_id)?.hub_code || 'HUB'}</label>
    <div className="form-input-container orch-assignee-select">
      <AssigneeSelector
        id={`orch-assignee-${idx}`}
        isSingle={true}
        limitToIds={formData.assigned_to}
        value={item.assigned_to}
        onChange={(val) => {
          const next = [...orchestrationMapping];
          next[idx] = { ...next[idx], assigned_to: val };
          setOrchestrationMapping(next);
        }}
        currentUser={currentUser}
      />
    </div>
  </div>
))}
```
- `isSingle={true}` ✅ — each hub only gets one assignee
- `limitToIds={formData.assigned_to}` ✅ — only shows people already selected in step 1
- `value={item.assigned_to}` — verify `item.assigned_to` is a `string[]`. Check `orchestrationService.calculateOrchestration()` returns `{ hub_id, assigned_to: string[] }` for each hub.
- `id={\`orch-assignee-${idx}\`}` ✅ — unique ID per row

**Step 7.** Verify the "Next: Orchestrate Team" button guard (line ~441):
```jsx
{(formData.hub_ids.length > 1 || formData.assigned_to.length > 1) && step === 1 ? (
  <button
    type="button"
    className="halo-button save-btn"
    onClick={handleNextStep}
    disabled={!allEmployees || allEmployees.length === 0}
    style={{ marginLeft: 'auto' }}
  >
    Next: Orchestrate Team
  </button>
```
- `disabled={!allEmployees || allEmployees.length === 0}` — this prevents the crash where orchestration runs before employee data loads. ✅

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| City dropdown shows nothing | `uniqueCities` is empty | Check `hubs` state is populated after `fetchHubs()` |
| Hub dropdown disabled even after city selected | `formData.city` not set, or `taskUtils.canUserEditField` returning false | Verify permissions prop is correct |
| Orchestration step shows wrong names | `orchestrationService.calculateOrchestration()` mapping issue | Check `allEmployees` is not empty at call time |
| Orchestration assignee picker shows all employees | `limitToIds` not passed or not an array | Ensure `limitToIds={formData.assigned_to}` where `assigned_to` is `string[]` |
| "Next" button always disabled | `allEmployees` hook slow to load | Expected — the disabled guard is intentional; user must wait |

---

## Consumer 2: `EmployeeTaskForm.jsx`

**Full path:** `src/verticals/Employees/EmployeeTaskForm.jsx`

### What This Form Does

Single-step form for creating/editing tasks under the Employees vertical. Uses:
- `<CustomSelect>` for: Priority
- `<AssigneeSelector>` for: Assigned To

### State Architecture

Uses `useTaskForm(initialData)` hook. Key fields:
- `formData.text` → string
- `formData.priority` → string
- `formData.assigned_to` → string[]
- `formData.parentTask` → string (task UUID or `''`)
- `formData.description` → string

### Validation Checklist

**Step 1.** Verify `<CustomSelect>` for Priority (line ~66):
```jsx
<CustomSelect
  value={formData.priority}
  onChange={(val) => updateField('priority', val)}
  options={[
    { label: 'Low', value: 'Low' },
    { label: 'Medium', value: 'Medium' },
    { label: 'High', value: 'High' },
    { label: 'Urgent', value: 'Urgent' }
  ]}
  disabled={!taskUtils.canUserEditField(initialData, 'priority', permissions, currentUser)}
/>
```
✅ `onChange` receives raw `val`. Correct.

**Step 2.** Verify `<AssigneeSelector>` (line ~83):
```jsx
<AssigneeSelector
  value={formData.assigned_to}
  onChange={(val) => updateField('assigned_to', val)}
  currentUser={currentUser}
  disabled={!taskUtils.canUserEditField(initialData, 'assigned_to', permissions, currentUser)}
/>
```
✅ `value` is `string[]`. ✅ `onChange` receives `string[]`.

**Step 3.** Verify `<TaskHierarchySelector>` (line ~97):
```jsx
<TaskHierarchySelector
  value={formData.parentTask}
  onChange={(val) => updateField('parentTask', val)}
  availableTasks={availableTasks}
  disabled={!taskUtils.canUserEditField(initialData, 'parentTask', permissions, currentUser)}
/>
```
`TaskHierarchySelector` wraps `<CustomSelect>` internally. The `onChange` here will receive a task UUID string or `''`. ✅

**Step 4.** Verify `CustomSelect` import at top of file (line 8):
```js
import CustomSelect from '../../components/CustomSelect';
```
⚠️ This was a known bug (Bug10) — `CustomSelect` was missing from the import, causing a runtime crash when the Employee task form opened. Verify the import IS present.

**Step 5.** Verify the submit button logic (line ~121):
```jsx
<button
  type={isDirty ? "submit" : "button"}
  className={`halo-button ${isDirty ? 'save-btn' : 'close-btn'}`}
  onClick={isDirty ? undefined : onCancel}
  disabled={loading}
>
  {loading ? 'Saving...' : (initialData?.id ? (isDirty ? 'Update Task' : 'Close') : 'Create Task')}
</button>
```
This button uses a toggle pattern: when `isDirty=true`, it's `type="submit"`. When `isDirty=false`, it's `type="button"` that calls `onCancel`. This is intentional and correct.

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Blank screen when opening Employee task modal | Missing `CustomSelect` import (Bug10) | Add `import CustomSelect from '../../components/CustomSelect';` |
| Priority dropdown does nothing | Stale `updateField` or missing `CustomSelect` | Check import and `onChange` handler |

---

## Consumer 3: `ClientTaskForm.jsx`

**Full path:** `src/verticals/Clients/ClientTaskForm.jsx`

### What This Form Does

Single-step form for creating/editing tasks under the Clients vertical. Uses:
- `<CustomSelect>` for: Priority, Related Client
- `<AssigneeSelector>` for: Assigned To
- `<TaskHierarchySelector>` for: Parent Task

### State Architecture

Uses `useTaskForm(initialData)` hook. Key fields:
- `formData.text` → string
- `formData.priority` → string
- `formData.assigned_client_id` → string (client UUID or `''`)
- `formData.assigned_to` → string[]
- `formData.parentTask` → string
- `formData.description` → string

Also self-fetches `clients[]` from Supabase via `fetchClients()`.

### Validation Checklist

**Step 1.** Verify imports at top (line 1–8):
```js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import AssigneeSelector from '../../components/AssigneeSelector';
import TaskHierarchySelector from '../../components/TaskHierarchySelector';
import CustomSelect from '../../components/CustomSelect';
import { taskUtils } from '../../utils/taskUtils';
import { useTaskForm } from '../../hooks/useTaskForm';
```
All 7 imports must be present.

**Step 2.** Verify `<CustomSelect>` for Priority (line ~71):
```jsx
<CustomSelect
  value={formData.priority}
  onChange={(val) => updateField('priority', val)}
  options={[...]}
  disabled={...}
/>
```
✅ `onChange` is raw `val`.

**Step 3.** Verify `<CustomSelect>` for Related Client (line ~88):
```jsx
<CustomSelect
  value={formData.assigned_client_id}
  onChange={(val) => updateField('assigned_client_id', val)}
  options={[
    { label: 'N/A (General Client Task)', value: '' },
    ...clients.map(client => ({ label: client.name, value: client.id }))
  ]}
  placeholder="Select Client..."
  disabled={...}
/>
```
- `value` must be `formData.assigned_client_id` (a string UUID or `''`). ✅
- Empty option `{ label: 'N/A (General Client Task)', value: '' }` must be the first option so the field can be cleared.

**Step 4.** Verify `<AssigneeSelector>` (line ~106):
```jsx
<AssigneeSelector
  value={formData.assigned_to}
  onChange={(val) => updateField('assigned_to', val)}
  currentUser={currentUser}
  disabled={...}
/>
```
✅ Correct.

**Step 5.** Verify `fetchClients()` only fetches `Active` clients:
```js
const fetchClients = async () => {
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('status', 'Active')
    .order('name');
  if (data) setClients(data);
};
```
✅ The `.eq('status', 'Active')` filter must be present.

**Step 6.** Verify `handleSubmit` constructs `finalTaskText` correctly:
```js
const selectedClient = clients.find(c => c.id === formData.assigned_client_id);
const finalTaskText = taskUtils.formatTaskText(formData.text, {
  assetCode: selectedClient?.name,
  forcePrefix: !!formData.assigned_client_id
});
onSubmit({ ...formData, text: finalTaskText });
```
- `assetCode` is the client name (for task text prefix). Optional chain `?.name` prevents crash when no client is selected. ✅

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Client dropdown empty | `fetchClients` not called on mount | Verify `useEffect(() => { fetchClients(); }, [])` exists |
| Inactive clients appearing | Missing `.eq('status', 'Active')` filter | Add the filter to the Supabase query |

---

## Consumer 4: `DailyTasksManagement.jsx`

**Full path:** `src/verticals/ChargingHubs/DailyTasksManagement.jsx`

### What This Form Does

Management page for recurring task templates. The modal form uses:
- `<CustomSelect>` for: Vertical, Subject (Hub/Client), Frequency
- `<AssigneeSelector>` for: Default Assignee

### State Architecture

Local `formData` state (NOT `useTaskForm`):
```js
const [formData, setFormData] = useState({
  title: '',
  description: '',
  verticalId: VERTICALS.CHARGING_HUBS.id,
  subjectId: '',
  frequency: 'DAILY',
  timeOfDay: '08:00',
  assignedTo: [],  // ← string[]
  isActive: true,
  uploadLink: ''
});
```
Note: The assignee field is `assignedTo` (camelCase), NOT `assigned_to` (snake_case). This is specific to the template data model.

### Validation Checklist

**Step 1.** Verify imports at top (line 1–11):
```js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/core/supabaseClient';
import { masterErrorHandler } from '../../services/core/masterErrorHandler';
import { dailyTaskTemplateService } from '../../services/tasks/dailyTaskTemplateService';
import { VERTICALS } from '../../constants/verticals';
import MasterPageHeader from '../../components/MasterPageHeader';
import AssigneeSelector from '../../components/AssigneeSelector';
import { useManagementUI } from '../../hooks/useManagementUI';
import { taskUtils } from '../../utils/taskUtils';
import './DailyTasksManagement.css';
import CustomSelect from '../../components/CustomSelect';
```
All 11 imports must be present.

**Step 2.** Verify `<CustomSelect>` for Vertical (line ~354):
```jsx
<CustomSelect
  value={formData.verticalId}
  onChange={(val) => setFormData({ ...formData, verticalId: val })}
  options={[
    { label: 'Charging Hubs', value: VERTICALS.CHARGING_HUBS.id },
    { label: 'Client Management', value: VERTICALS.CLIENTS.id },
    { label: 'Employee Management', value: VERTICALS.EMPLOYEES.id }
  ]}
/>
```
✅ `onChange` uses spread update pattern (not `updateField`).

**Step 3.** Verify `<CustomSelect>` for Subject (line ~369):
```jsx
<CustomSelect
  value={formData.subjectId}
  onChange={(val) => setFormData({ ...formData, subjectId: val })}
  options={[
    { label: '-- Generic Task --', value: '' },
    ...subjectOptions.map(opt => ({ label: opt.label, value: opt.id }))
  ]}
  placeholder="Select Subject..."
/>
```
- `subjectOptions` is computed from `formData.verticalId`:
  - `VERTICALS.CLIENTS.id` → uses `clients[]`
  - Anything else → uses `hubs[]`
- Verify the `subjectOptions` derivation logic:
  ```js
  const subjectOptions = formData.verticalId === VERTICALS.CLIENTS.id
    ? clients.map(c => ({ id: c.id, label: c.name }))
    : hubs.map(h => ({ id: h.id, label: h.hub_code || h.name }));
  ```

**Step 4.** Verify `<CustomSelect>` for Frequency (line ~386):
```jsx
<CustomSelect
  value={formData.frequency}
  onChange={(val) => setFormData({ ...formData, frequency: val })}
  options={[
    { label: 'Daily', value: 'DAILY' },
    { label: 'Weekly', value: 'WEEKLY' },
    { label: 'Monthly', value: 'MONTHLY' }
  ]}
/>
```
✅ Values are uppercase strings (`'DAILY'`, etc.) — these must match the database enum.

**Step 5.** Verify `<AssigneeSelector>` for Default Assignee (line ~401):
```jsx
<AssigneeSelector
  value={formData.assignedTo}
  onChange={(val) => setFormData({...formData, assignedTo: val})}
  currentUser={currentUser}
/>
```
⚠️ Note the key is `assignedTo` (camelCase), not `assigned_to`. Verify the `handleOpenModal` function normalizes correctly when editing a template:
```js
assignedTo: Array.isArray(template.assignedTo) ? template.assignedTo : (template.assignedTo ? [template.assignedTo] : []),
```
This ensures `assignedTo` is always an array, even if the database has stored a single UUID string.

**Step 6.** Verify `handleSubmit` uses `currentUser?.id` (NOT `getUser()`):
```js
const userId = currentUser?.id;
```
⚠️ This was a known bug (Issue-7) — `getUser()` can crash if Supabase session is null. Must use `currentUser?.id` from props instead.

**Step 7.** Verify `fetchReferenceData` uses a safe pattern for clients:
```js
const fetchReferenceData = async () => {
  const [hubRes, clientRes] = await Promise.all([
    supabase.from('hubs').select('id, name, hub_code'),
    (async () => {
      const { data, error } = await supabase.from('clients').select('id, name').limit(100);
      return { data: error ? [] : data };
    })()
  ]);
  setHubs(hubRes.data || []);
  setClients(clientRes?.data || []);
};
```
The nested async IIFE for clients is intentional — it prevents a `.catch()` prototype error on the `PostgrestBuilder` when using `Promise.all`.

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Template form crashes on open | Missing `CustomSelect` import | Add import |
| Assignee saved as string UUID, not array | Missing normalization in `handleOpenModal` | Add `Array.isArray(template.assignedTo) ? ... : [template.assignedTo]` |
| `getUser()` crash on submit | Using `getUser()` instead of prop | Change to `const userId = currentUser?.id;` |
| Subject dropdown empty | `hubs` or `clients` fetch failed silently | Check `fetchReferenceData` error handling |

---

## Browser Smoke Test

After validating all four files, perform this browser walkthrough:

### Test A — HubTaskForm
1. Open Charging Hubs → New Task
2. Fill in Task Summary, select City, select Hub(s), select Assignee(s)
3. Select Priority and Function from their `<CustomSelect>` dropdowns
4. If 2+ hubs or 2+ assignees: click "Next: Orchestrate Team"
5. Verify orchestration step shows one single-select `<AssigneeSelector>` per hub
6. Click Back, then submit
7. Verify no console errors

### Test B — EmployeeTaskForm
1. Open Employees → select an employee → Tasks → New Task
2. Fill in Task Summary, Priority (CustomSelect), Assignee (AssigneeSelector)
3. Submit
4. Verify no console errors, no blank screen

### Test C — ClientTaskForm
1. Open Clients → select a client → Tasks → New Task
2. Fill in Task Summary, Priority, Related Client (CustomSelect), Assignee (AssigneeSelector)
3. Submit
4. Verify no console errors

### Test D — DailyTasksManagement
1. Open Daily Tasks Management
2. Click "+ New Template"
3. Fill in Title, Vertical (CustomSelect), Subject (CustomSelect), Frequency (CustomSelect), Default Assignee (AssigneeSelector)
4. Submit
5. Verify template appears in list
6. Click Edit — verify the Assignee loads back correctly as the previously selected value

---

## Definition of Done — This Phase

- [ ] All 4 consumer files open without runtime errors
- [ ] No native `<select>` elements exist in any of the 4 files
- [ ] All `<CustomSelect>` `onChange` receive raw `val`, not synthetic events (except `handleCityChange` in `HubTaskForm` — that adapter is intentional)
- [ ] All `<AssigneeSelector>` `value` props are `string[]`
- [ ] All `<HubSelector>` `value` props are `string[]`
- [ ] `CustomSelect` is imported in `EmployeeTaskForm.jsx`
- [ ] `DailyTasksManagement` uses `currentUser?.id`, not `getUser()`
- [ ] Smoke tests A through D pass

---

## Handoff Note

When this phase is complete, proceed to:
**[Phase 2 → 03_SINGLE_SELECT_OVERHAULS.md](./03_SINGLE_SELECT_OVERHAULS.md)**
