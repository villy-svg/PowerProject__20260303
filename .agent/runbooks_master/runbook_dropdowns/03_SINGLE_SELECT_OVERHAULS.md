# Phase 2: Single-Select Overhauls — Runbook

> **STANDALONE DOCUMENT.** This runbook can be executed with zero prior context. It assumes Phases 1 and 1.1 are complete. All background, file paths, current code state, target state, and verification criteria are contained in this file.

---

## Mission

Ensure that every single-select dropdown across all secondary management forms uses `<CustomSelect>` — the canonical single-select component — and has no native `<select>` tags, inline style overrides on dropdown fields, or inconsistent `onChange` adapters.

---

## Pre-Flight: What You Need to Know

### The Standard: `<CustomSelect>`

**File:** `src/components/CustomSelect.jsx`  
**Style:** `src/styles/DropdownSystem.css`

```jsx
<CustomSelect
  id="field-id"            // string — unique DOM ID for the trigger button
  value={formData.field}   // string | "" — current selected value
  onChange={(val) => updateField('field', val)} // (string) => void — raw value
  options={[               // { label: string, value: string }[]
    { label: 'Option A', value: 'a' },
  ]}
  placeholder="Select..."  // string — shown when value === "" or undefined
  disabled={false}         // boolean
  fullWidthDropdown={false} // boolean — spans full modal width
/>
```

**Key rule:** `onChange` receives the raw `value` string directly, NOT a synthetic event. Never use `(e) => fn(e.target.value)`.

**Exception to the rule:** It is acceptable to wrap `val` in a synthetic event when you need to reuse an existing `handleChange(e)` function that reads `e.target.name` and `e.target.value`. In that case, the pattern is:
```js
onChange={(val) => onChange({ target: { name: 'field_name', value: val } })}
```
This is intentional and allowed — document it with a comment if you add it.

### What a Native `<select>` Looks Like (Forbidden)

```jsx
// FORBIDDEN — do not leave these in any form
<select
  name="status"
  value={formData.status}
  onChange={handleChange}
>
  <option value="active">Active</option>
  <option value="inactive">Inactive</option>
</select>
```

Replace every instance with `<CustomSelect>`.

---

## Target Files in Scope

| File | What to Fix |
|:---|:---|
| `src/components/TaskHierarchySelector.jsx` | Verify it wraps `<CustomSelect>` correctly |
| `src/verticals/Employees/EmployeeFormSections.jsx` | Audit all `<CustomSelect>` instances for correct `onChange` patterns |
| `src/verticals/ChargingHubs/HubManagement.jsx` | Verify Status `<CustomSelect>` in the hub creation modal |
| `src/verticals/Clients/ClientForm.jsx` | Verify Billing Model `<CustomSelect>` and audit for any native `<select>` remnants |

---

## File 1: `TaskHierarchySelector.jsx`

**Full path:** `src/components/TaskHierarchySelector.jsx`

### What This Component Does

A thin wrapper around `<CustomSelect>` that presents a list of available parent tasks for nesting. Used by:
- `HubTaskForm.jsx` → `<TaskHierarchySelector id="parent-task-selector" value={formData.parentTask} onChange={...} availableTasks={availableTasks} disabled={...} />`
- `EmployeeTaskForm.jsx` → same pattern
- `ClientTaskForm.jsx` → same pattern

### Expected Code (Current Correct State)

```jsx
import React from 'react';
import CustomSelect from './CustomSelect';

const TaskHierarchySelector = ({ id, value, onChange, availableTasks = [], disabled = false }) => {
  const options = [
    { label: 'None (Root)', value: '' },
    ...availableTasks.map(task => ({ label: task.text, value: task.id }))
  ];

  return (
    <>
      <CustomSelect
        id={id}
        value={value || ''}
        onChange={onChange}
        options={options}
        placeholder="Select Parent Task..."
        disabled={disabled}
        fullWidthDropdown={true}
      />
      {availableTasks.length === 0 && !disabled && (
        <small style={{ color: 'var(--text-secondary)', fontSize: '0.6rem', display: 'block', marginTop: '4px' }}>
          No other tasks available to nest under.
        </small>
      )}
    </>
  );
};

export default TaskHierarchySelector;
```

### Validation Checklist

**Step 1.** Verify `CustomSelect` is imported, NOT a native `<select>`.

**Step 2.** Verify `value={value || ''}` — the `|| ''` fallback ensures `CustomSelect` never receives `null` or `undefined` as a value (which would break the selected option matching).

**Step 3.** Verify `fullWidthDropdown={true}` — task names can be very long. Without this, the dropdown panel would be truncated to the width of the container.

**Step 4.** Verify the empty state hint renders only when `availableTasks.length === 0 && !disabled`:
- When there are no tasks, show the hint.
- When the field is disabled (view-only mode), don't show the hint.

**Step 5.** Verify the `onChange` prop is passed directly to `<CustomSelect>` without wrapping. `TaskHierarchySelector.onChange` already receives `(val) => updateField('parentTask', val)` from the parent — it must not be re-wrapped.

### ✅ Completion Checklist — TaskHierarchySelector

- [ ] Imports `CustomSelect`, not a native select
- [ ] `value={value || ''}` fallback present
- [ ] `fullWidthDropdown={true}` present
- [ ] Empty state hint conditional on `availableTasks.length === 0 && !disabled`
- [ ] `onChange` passed through unmodified
- [ ] No inline style on the dropdown field itself

---

## File 2: `EmployeeFormSections.jsx`

**Full path:** `src/verticals/Employees/EmployeeFormSections.jsx`

### What This File Does

Exports three pure display components used by the Employee create/edit form:
- `BasicDetailsSection` — Name, Contact, Email, **Gender**, DOB
- `CompanyDetailsSection` — Emp Code (read-only), Badge ID (read-only), DOJ, **Primary Hub**, **Role**, **Department**, **Reporting Manager**
- `BankDetailsSection` — Account Number, IFSC, Account Name, PAN (all text inputs)

`<CustomSelect>` is used for: **Gender, Primary Hub, Role, Department, Reporting Manager** — all inside `CompanyDetailsSection` and `BasicDetailsSection`.

### Validation Checklist

**Step 1.** Verify the single import at top:
```js
import CustomSelect from '../../components/CustomSelect';
```
This file has NO React import (`import React from 'react'`) because it uses JSX without React-specific hooks — confirm the project config supports the JSX transform (Vite/React 17+ does). If there's a compile error, add `import React from 'react';`.

**Step 2.** Verify `<CustomSelect>` for **Gender** in `BasicDetailsSection` (line ~28):
```jsx
<CustomSelect
  value={formData.gender}
  onChange={(val) => onChange({ target: { name: 'gender', value: val } })}
  options={[
    { label: 'Select Gender', value: '' },
    { label: 'Male', value: 'Male' },
    { label: 'Female', value: 'Female' },
    { label: 'Other', value: 'Other' },
    { label: 'Prefer not to say', value: 'Prefer not to say' }
  ]}
  disabled={isViewOnly}
/>
```
⚠️ The `onChange` here uses the synthetic event adapter pattern — this is intentional because `onChange` passed from the parent reads `e.target.name` and `e.target.value`. This is NOT a bug.

**Step 3.** Verify `<CustomSelect>` for **Primary Hub** in `CompanyDetailsSection` (line ~77):
```jsx
<CustomSelect
  value={formData.hub_id}
  onChange={(val) => onChange({ target: { name: 'hub_id', value: val } })}
  options={[
    { label: 'Select primary hub', value: '' },
    { label: 'ALL (Global Access)', value: 'ALL' },
    ...hubs.filter(h => h.name !== 'ALL').map(hub => ({
      label: hub.hub_code || hub.name,
      value: hub.id
    }))
  ]}
  disabled={isViewOnly}
/>
```
- The `'ALL'` option maps to the string `'ALL'`, not a UUID. This is intentional — it grants the employee global access.
- `.filter(h => h.name !== 'ALL')` prevents a duplicate "ALL" option.

**Step 4.** Verify `<CustomSelect>` for **Role** (line ~95):
```jsx
<CustomSelect
  value={formData.role_id}
  onChange={(val) => onChange({ target: { name: 'role_id', value: val } })}
  options={[
    { label: 'Select Role', value: '' },
    ...roles.map(r => ({
      label: r.role_code ? `[${r.role_code}] ${r.name}` : r.name,
      value: r.id
    }))
  ]}
  disabled={isViewOnly}
/>
```
- Labels use `[ROLE_CODE] Role Name` format for readability.

**Step 5.** Verify `<CustomSelect>` for **Department** (line ~112):
```jsx
<CustomSelect
  value={formData.department_id}
  onChange={(val) => onChange({ target: { name: 'department_id', value: val } })}
  options={[
    { label: 'Select Department', value: '' },
    ...departments.map(d => ({
      label: d.dept_code ? `[${d.dept_code}] ${d.name}` : d.name,
      value: d.id
    }))
  ]}
  disabled={isViewOnly}
/>
```
✅ Same label format as Role.

**Step 6.** Verify `<CustomSelect>` for **Reporting Manager** (line ~129):
```jsx
<CustomSelect
  value={formData.manager_id}
  onChange={(val) => onChange({ target: { name: 'manager_id', value: val } })}
  options={[
    { label: 'Select Manager', value: '' },
    ...employees
      .filter(e => e.id !== formData.id && e.status === 'Active')
      .map(e => ({
        label: `${e.full_name} (${e.role_code || 'No Role'})`,
        value: e.id
      }))
  ]}
  disabled={isViewOnly}
/>
```
- `e.id !== formData.id` prevents an employee from selecting themselves as their own manager.
- `e.status === 'Active'` ensures only active employees appear as manager options.

**Step 7.** Scan the entire file for any `<select>` tags. There should be ZERO native `<select>` elements. If any are found, replace with `<CustomSelect>`.

**Step 8.** Scan for any inline `style={{ ... }}` on `<select>` elements. If you removed native selects, remove their inline styles too.

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Gender dropdown won't open | Missing `CustomSelect` import | Add import |
| ALL hubs option creates duplicate entry | Missing `.filter(h => h.name !== 'ALL')` | Add filter |
| Employee can set self as manager | Missing `e.id !== formData.id` filter | Add filter |
| Inactive managers appearing | Missing `e.status === 'Active'` filter | Add filter |
| React compile error "React is not defined" | Missing React import | Add `import React from 'react';` at top |

### ✅ Completion Checklist — EmployeeFormSections

- [ ] `CustomSelect` imported at top
- [ ] Gender dropdown uses `<CustomSelect>` with adapter `onChange`
- [ ] Primary Hub uses `<CustomSelect>`, includes 'ALL' option, filters `h.name !== 'ALL'`
- [ ] Role uses `<CustomSelect>` with `[CODE] Name` label format
- [ ] Department uses `<CustomSelect>` with `[CODE] Name` label format
- [ ] Reporting Manager filters out self and inactive employees
- [ ] Zero native `<select>` elements in file
- [ ] All `onChange` use the synthetic event adapter pattern (intentional)

---

## File 3: `HubManagement.jsx`

**Full path:** `src/verticals/ChargingHubs/HubManagement.jsx`

### What This File Does

The Hub Management page. Contains a list/grid of hubs with create/edit functionality via a modal form. The modal form has:
- Hub Name (text input)
- Hub Code (text input)
- City/Address (text input)
- **Status** (`<CustomSelect>`)

All inputs are inside a `form.vertical-task-form`.

### Validation Checklist

**Step 1.** Verify `CustomSelect` is imported at the top (line 4):
```js
import CustomSelect from '../../components/CustomSelect';
```

**Step 2.** Verify `<CustomSelect>` for **Status** in the modal form (line ~364):
```jsx
<CustomSelect
  value={formData.status}
  onChange={(val) => setFormData({ ...formData, status: val })}
  options={[
    { label: 'Active', value: 'active' },
    { label: 'Maintenance', value: 'maintenance' },
    { label: 'Inactive', value: 'inactive' }
  ]}
/>
```
⚠️ Values are lowercase (`'active'`, `'maintenance'`, `'inactive'`). These must match the database enum values for the `hubs.status` column. Do NOT change them to Title Case.

**Step 3.** Verify `formData` state initialization:
```js
const [formData, setFormData] = useState({ name: '', hub_code: '', city: '', status: 'active' });
```
- Default status is `'active'` (lowercase). This must match the `<CustomSelect>` option values.

**Step 4.** Verify `handleOpenModal` sets status correctly when editing:
```js
setFormData({
  name: hub.name,
  hub_code: hub.hub_code || '',
  city: hub.city || '',
  status: hub.status || 'active'
});
```
- `hub.status || 'active'` fallback prevents the Status dropdown from showing blank when status is `null` in the DB.

**Step 5.** Scan the entire modal form (the section inside `{ui.isAddModalOpen && (...)}`) for any native `<select>` tags. There should be ZERO.

**Step 6.** Verify the modal form uses `className="vertical-task-form"` — this gives it the correct scoped form styles from the design system.

**Step 7.** Verify the error boundary wrapping at the bottom of the file:
```jsx
const HubManagementWithErrorBoundary = ({ permissions }) => (
  <HubManagementErrorBoundary>
    <HubManagement permissions={permissions} />
  </HubManagementErrorBoundary>
);

export default HubManagementWithErrorBoundary;
```
The exported default must be `HubManagementWithErrorBoundary`, not `HubManagement` directly.

⚠️ **Known issue:** The error boundary wrapper `HubManagementWithErrorBoundary` only passes `permissions` prop to `HubManagement`, but the actual `HubManagement` function signature accepts: `{ permissions, isSubSidebarOpen, setIsSubSidebarOpen, setActiveVertical, onShowBottomNav }`. This means those props are silently dropped at the boundary. If this causes issues in a future sprint, the boundary wrapper needs to use `...props` spread:
```jsx
const HubManagementWithErrorBoundary = (props) => (
  <HubManagementErrorBoundary>
    <HubManagement {...props} />
  </HubManagementErrorBoundary>
);
```
**Document this but do not fix it in this runbook** unless it causes an active bug.

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Status dropdown blank on edit | `hub.status` is null, missing fallback | Add `status: hub.status || 'active'` |
| Status saves as Title Case | Options using `'Active'` instead of `'active'` | Change option values to lowercase |
| Hub Management crashes on load | Props not passed through boundary | Use `{...props}` spread in boundary wrapper |

### ✅ Completion Checklist — HubManagement

- [ ] `CustomSelect` imported
- [ ] Status `<CustomSelect>` uses lowercase values
- [ ] `formData.status` initializes to `'active'` (lowercase)
- [ ] Edit modal pre-fills status with `hub.status || 'active'`
- [ ] Zero native `<select>` in modal form
- [ ] Default export is `HubManagementWithErrorBoundary`

---

## File 4: `ClientForm.jsx`

**Full path:** `src/verticals/Clients/ClientForm.jsx`

### What This File Does

A 2-page wizard form for creating/editing client records:
- **Page 1:** Client Name, Service Category Matrix (checkbox table), **Billing Model**
- **Page 2:** PoC Name, Contact Number, Email

Uses `<CustomSelect>` for: **Billing Model** only.

### Validation Checklist

**Step 1.** Verify `CustomSelect` is imported. 
⚠️ **Current Known Issue:** `ClientForm.jsx` currently does NOT import `CustomSelect` from the design system. The Billing Model field is implemented using inline styles (`selectStyle`, `inputStyle`) and a native `<select>` element:

```jsx
// CURRENT (BAD) — search for this pattern in the file
<select
  name="billing_model_id"
  value={formData.billing_model_id}
  onChange={handleChange}
  style={selectStyle}
>
  <option value="">— Select Billing Model —</option>
  {billingModels.map(model => (
    <option key={model.id} value={model.id}>{model.name} ({model.code})</option>
  ))}
</select>
```

**However**, the current code actually uses `<CustomSelect>` (this was already migrated):
```jsx
<CustomSelect
  value={formData.billing_model_id}
  onChange={(val) => handleChange({ target: { name: 'billing_model_id', value: val } })}
  options={[
    { label: '— Select Billing Model —', value: '' },
    ...billingModels.map(model => ({
      label: `${model.name} (${model.code})`,
      value: model.id
    }))
  ]}
  disabled={isViewOnly}
/>
```

**Step 2.** Verify the import at the top of the file. Look for:
```js
import CustomSelect from '../../components/CustomSelect';
```
Wait — check the actual file. The current version of `ClientForm.jsx` does NOT have this import. The `CustomSelect` for Billing Model was already in the JSX but may be missing the import line.

**Action:** Open `src/verticals/Clients/ClientForm.jsx` and check the import block (lines 1–5). If `CustomSelect` is not imported but used in JSX, the component will fail at runtime. Add:
```js
import CustomSelect from '../../components/CustomSelect';
```

**Step 3.** Verify the Billing Model field is `<CustomSelect>`, NOT a native `<select>`:
- In `ClientForm.jsx`, search (Ctrl+F) for `<select`. There should be ZERO results in the form fields.
- The category matrix uses `<input type="checkbox">` (inside `<label className="switch">`), which is correct — do not change those.

**Step 4.** Verify `formData` initialization for `billing_model_id`:
```js
const [formData, setFormData] = useState({
  name: initialData.name || '',
  category_id: initialData.category_id || '',
  billing_model_id: initialData.billing_model_id || '',
  category_matrix: initialData.category_matrix || {},
  poc_name: initialData.poc_name || '',
  poc_phone: initialData.poc_phone || '',
  poc_email: initialData.poc_email || '',
});
```
- `billing_model_id` must initialize to `''` (empty string), not `null`. This ensures the `<CustomSelect>` renders the placeholder correctly.

**Step 5.** Verify `fetchDropdowns()` fetches from `client_billing_models`:
```js
const [catRes, serviceRes, modelRes] = await Promise.all([
  supabase.from('client_categories').select('id, name, code, default_service_code').order('name'),
  supabase.from('client_services').select('id, name, code').order('name'),
  supabase.from('client_billing_models').select('id, name, code').order('name'),
]);
if (catRes.data) setVehicleCategories(catRes.data);
if (serviceRes.data) setServiceCategories(serviceRes.data);
if (modelRes.data) setBillingModels(modelRes.data);
```

**Step 6.** Audit the `inputStyle` and `selectStyle` constants defined in the file (lines ~124–142). These are legacy inline style objects. They are still used for PoC form text inputs on Page 2. **Do NOT remove them** unless all inputs are migrated. But verify they are NOT applied to any `<select>` element that should have been replaced with `<CustomSelect>`.

**Step 7.** Verify the wizard footer buttons use `halo-button` class names:
```jsx
<button type="button" className="halo-button back-btn" onClick={handleBack} disabled={loading}>Back</button>
<button type="submit" className="halo-button next-btn">Continue ➔</button>
<button type="button" className="halo-button save-changes-btn" onClick={isDirty ? handleSubmit : onCancel}>Save Changes</button>
```
No custom `style={{ backgroundColor: ..., color: ... }}` inline overrides should be used for these buttons in the final state. **Currently, there IS an inline style** on the save button:
```jsx
style={{ backgroundColor: isDirty ? 'var(--brand-green)' : 'rgba(255,255,255,0.1)', color: 'white' }}
```
This inline style is technically a design system violation, but it uses CSS variables (`var(--brand-green)`), not hardcoded hex values. **Flag it but do not remove it in this runbook** — it would require a CSS class addition to properly fix, which is out of scope here.

### Issues to Look For

| Symptom | Root Cause | Fix |
|:---|:---|:---|
| Billing Model field appears as native browser dropdown | `CustomSelect` not used for billing model | Replace native `<select>` with `<CustomSelect>` |
| Runtime crash "CustomSelect is not defined" | Missing import | Add `import CustomSelect from '../../components/CustomSelect';` |
| Billing Model blank on edit | `billing_model_id` initializes to `null` | Change to `initialData.billing_model_id \|\| ''` |
| Billing model options show raw UUID as label | Options built incorrectly | Use `label: \`${model.name} (${model.code})\`` |

### ✅ Completion Checklist — ClientForm

- [ ] `CustomSelect` imported at top of file
- [ ] Billing Model uses `<CustomSelect>`, NOT native `<select>`
- [ ] `formData.billing_model_id` initializes to `''` not `null`
- [ ] `fetchDropdowns` fetches from `client_billing_models`
- [ ] Category matrix `<input type="checkbox">` fields are NOT touched (out of scope)
- [ ] Zero native `<select>` elements in any form field

---

## Final Browser Smoke Test — Phase 2

1. **Employee Create Form:**
   - Open Employees → Add New Employee
   - Verify Gender, Primary Hub, Role, Department, Reporting Manager all use the custom dropdown (dark theme, custom trigger button)
   - No native browser select styling visible

2. **Hub Management Modal:**
   - Open Hub Management → Add New Hub
   - Verify Status uses the custom dropdown with options: Active, Maintenance, Inactive
   - Edit an existing hub — verify Status pre-fills correctly

3. **Client Create Form:**
   - Open Clients → Add New Client
   - On Page 1, verify Billing Model uses custom dropdown
   - Select a billing model, click Continue, go to Page 2, go back — Billing Model should still show the selected value

4. **Task Hierarchy Selector:**
   - Open any task form (Hubs, Employees, or Clients)
   - Verify the "Parent Task" field opens as a wide dropdown (full modal width)
   - If there are tasks available, verify they appear as options

---

## Definition of Done — Phase 2

- [ ] `TaskHierarchySelector` uses `<CustomSelect>` with `fullWidthDropdown={true}`
- [ ] `EmployeeFormSections` — all 5 select fields use `<CustomSelect>`
- [ ] `HubManagement` — Status field uses `<CustomSelect>` with lowercase values
- [ ] `ClientForm` — Billing Model uses `<CustomSelect>`, import present
- [ ] Zero native `<select>` elements in any of the 4 files
- [ ] Zero hardcoded hex colors on any dropdown-related elements
- [ ] All 4 smoke tests pass with no console errors
- [ ] `npm run dev` compiles with zero errors

---

## Series Complete

All three phases are now done. The entire dropdown system across the PowerProject app is centralized on:
- **`<CustomSelect>`** — all single-select fields
- **`<HubSelector>`** — charging hub multi-select
- **`<AssigneeSelector>`** — employee/assignee multi-select

Return to **[00_INDEX.md](./00_INDEX.md)** for the global Definition of Done checklist.
