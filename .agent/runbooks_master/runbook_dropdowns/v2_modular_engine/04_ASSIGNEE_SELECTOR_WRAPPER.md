# Runbook 04: Migrate `AssigneeSelector.jsx` to Thin Wrapper

> **STANDALONE.** Refactor `AssigneeSelector.jsx` to be a thin wrapper around `BaseDropdown`. Runbooks 01 and 02 must be complete before executing this. Runbook 03 does not need to be complete.

---

## Mission

Replace the body of `src/components/AssigneeSelector.jsx` with a thin wrapper around `BaseDropdown`. The wrapper is responsible for:
1. Self-fetching employee data via `useAssignees(true)`
2. Building the `options` array from raw employee records
3. Providing a custom `getLabel` that formats "You" for the current user
4. Passing `limitToIds`, `isSingle`-to-`mode` translation, and other props through

No consumer of `AssigneeSelector` should need any changes.

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\AssigneeSelector.jsx`

---

## Pre-Flight: Read These Files First

| File | Why |
|:---|:---|
| `src/components/AssigneeSelector.jsx` | Current implementation to replace |
| `src/components/BaseDropdown.jsx` | Target component prop API |
| `src/hooks/useAssignees.js` | Returns `{ assignees, loading, error, fetchAssignees }` |
| `src/utils/taskUtils.js` | Contains `taskUtils.formatAssigneeForList(id, name, currentUser)` at line 78 |
| `src/components/AssigneeSelector.css` | Defines `.assignee-selector-container`, `.assignee-selector-trigger`, `.selector-backdrop` — these MUST remain active |

> **`useAssignees` hook return shape:**
> ```js
> const { assignees, loading, error, fetchAssignees } = useAssignees(true);
> // assignees: Array<{ id: string, full_name: string, emp_code: string, email: string, badge_id: string, seniority_level: number }>
> // loading: boolean
> // error: Error | null  (unused in this wrapper)
> // fetchAssignees: () => Promise<void>  (unused in this wrapper)
> ```
> Only `assignees` and `loading` are used in this wrapper.

---

## Current Props (Must All Be Preserved)

```
value, onChange, currentUser, id, isSingle, limitToIds, disabled, required, placeholder
```

---

## Feature Mapping: AssigneeSelector → BaseDropdown

| AssigneeSelector Feature | BaseDropdown Prop |
|:---|:---|
| `useAssignees(true)` — self-fetch | Stays in wrapper; options built from `assignees` array |
| `loading` from hook | `loading={loading}` |
| `isSingle={true}` | `mode="single"` |
| `isSingle={false}` | `mode="multi"` |
| `limitToIds` | `limitToIds={limitToIds}` |
| `loadMoreLabel` | `loadMoreLabel="+ Load other employees"` |
| Custom "You" label | `getLabel={(vals, opts) => customLabelFn(vals)}` |
| `formatAssigneeForList` in item render | `renderItem` prop with custom JSX |
| Fuzzy search on `full_name` | `searchKeys={['label']}` (label = full_name in options) |
| Checkbox in multi mode | `showCheckbox={true}` |
| Radio dot in single mode | Automatic — `mode="single"` triggers `.single` class |
| `showAll` state | Managed by `BaseDropdown` internally via `limitToIds` |

> **CRITICAL — isSingle onChange contract:** The current `AssigneeSelector` always calls `onChange(newSelection)` with a **string array** (even in isSingle mode, it passes `[id]`). `BaseDropdown` in `mode="single"` fires `onChange(val)` with a **plain string**. This is a **behavioral change**.
>
> **Check all isSingle consumers before deploying:**
> - `HubTaskForm.jsx` orchestration step uses `isSingle` and reads `value[0]` from the returned array.
> - After the wrapper refactor, BaseDropdown returns a plain `string`, not `[string]`.
> - **Fix:** In `HubTaskForm.jsx`, update any code that does `assignee[0]` to just use `assignee` directly. OR, keep `isSingle` using `mode="multi"` with `maxSelect={1}` to preserve the array return type.
>
> Consult the consumer file to determine which approach is less disruptive.

> **CSS Container Class Note:** The current `AssigneeSelector` renders `<div className="assignee-selector-container">`. After migration, `BaseDropdown` renders `<div className="bd-container custom-select-container">`. The CSS in `AssigneeSelector.css` that targets `.assignee-selector-container` (position, user-select) will no longer apply.
> → **Action:** Keep the `import './AssigneeSelector.css';` in the wrapper. This ensures `.selector-backdrop`, `.load-others-btn`, `.assignee-name`, and `.no-assignees` remain styled. The container/trigger visual styling will now come from `.custom-select-container` and `.custom-select-trigger` in `DropdownSystem.css`, which is the intended design.

---

## Options Array Shape

Build inside the wrapper before passing to `BaseDropdown`:

```js
const options = assignees.map(emp => ({
  label: emp.full_name,       // searched against via searchKeys: ['label']
  value: emp.id,              // UUID string
  // sublabel: emp.role_code  // optional: enable in future for role display
}));
```

---

## Custom getLabel

The `getLabel` function receives `(selectedValues: string[], options: Option[])`.

```js
const getLabel = (selectedValues, options) => {
  if (loading) return 'Loading...';
  if (selectedValues.length === 0) return 'N/A (Unassigned)';

  if (selectedValues.length === 1) {
    const emp = assignees.find(e => e.id === selectedValues[0]);
    return emp
      ? taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)
      : 'Selected (1)';
  }

  // Primary assignee name + count
  const primary = assignees.find(e => e.id === selectedValues[0]);
  if (primary) {
    const isMe = currentUser?.employeeId === primary.id || currentUser?.id === primary.id;
    const name = isMe ? 'You' : primary.full_name.split(' ')[0];
    return `${name} + ${selectedValues.length - 1}`;
  }

  return `Selected (${selectedValues.length})`;
};
```

---

## Custom renderItem

The current `AssigneeSelector` uses `taskUtils.formatAssigneeForList` in option rows. Preserve this via `renderItem`:

```js
const renderItem = (opt, isSelected, mode) => (
  <>
    <div className="custom-dropdown-checkbox">
      {isSelected && (mode === 'single' ? <div className="radio-dot" /> : '✓')}
    </div>
    <span className="custom-dropdown-text">
      {taskUtils.formatAssigneeForList(opt.value, opt.label, currentUser)}
    </span>
  </>
);
```

> Note: If `renderItem` is provided, `showCheckbox` from `BaseDropdown` is bypassed. The checkbox rendering is handled inside `renderItem` directly.

---

## Target Code Shape

> Below is the **final complete file contents** of `AssigneeSelector.jsx` after migration. The "Target Code Shape" section is a structural outline; the **Step 2 paste block** below it is what you actually paste.

```jsx
import React from 'react';
import BaseDropdown from './BaseDropdown';
import { useAssignees } from '../hooks/useAssignees';
import { taskUtils } from '../utils/taskUtils';
import './AssigneeSelector.css';   // Keep: defines .selector-backdrop, .load-others-btn, etc.

/**
 * AssigneeSelector
 * Multi-select (or single-select via isSingle) employee picker.
 * Self-fetches employees via useAssignees. Thin wrapper around BaseDropdown.
 * Preserves original API surface — no consumer changes needed.
 */
const AssigneeSelector = ({
  value = [],
  onChange,
  currentUser = null,
  id = '',
  isSingle = false,
  limitToIds = null,
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...',
}) => {
  const { assignees, loading } = useAssignees(true);

  const options = assignees.map(emp => ({
    label: emp.full_name,
    value: emp.id,
  }));

  const getLabel = (selectedValues, options) => {
    // ... custom label logic (see above)
  };

  const renderItem = (opt, isSelected, mode) => (
    // ... custom item render (see above)
  );

  return (
    <BaseDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      mode={isSingle ? 'single' : 'multi'}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      loading={loading}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label']}
      getLabel={getLabel}
      renderItem={renderItem}
      limitToIds={limitToIds}
      loadMoreLabel="+ Load other employees"
      displayMode="compact"
      currentUser={currentUser}
      // Forward-looking features OFF
    />
  );
};

export default AssigneeSelector;
```

---

## Step-by-Step Implementation Guide for Interns

Follow these foolproof steps to execute the migration. Do not modify any files other than `AssigneeSelector.jsx`.

### Step 1: Locate the File
Open the file: `src/components/AssigneeSelector.jsx`.

### Step 2: Delete and Replace
Delete everything that is currently inside `AssigneeSelector.jsx`. Copy the full Target Code block below and paste it in:

```jsx
import React from 'react';
import BaseDropdown from './BaseDropdown';
import { useAssignees } from '../hooks/useAssignees';
import { taskUtils } from '../utils/taskUtils';
import './AssigneeSelector.css';

const AssigneeSelector = ({
  value = [],
  onChange,
  currentUser = null,
  id = '',
  isSingle = false,
  limitToIds = null,
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...',
}) => {
  const { assignees, loading } = useAssignees(true);

  const options = assignees.map(emp => ({
    label: emp.full_name,
    value: emp.id,
  }));

  const getLabel = (selectedValues, options) => {
    if (loading) return 'Loading...';
    if (selectedValues.length === 0) return 'N/A (Unassigned)';

    if (selectedValues.length === 1) {
      const emp = assignees.find(e => e.id === selectedValues[0]);
      return emp
        ? taskUtils.formatAssigneeForList(emp.id, emp.full_name, currentUser)
        : 'Selected (1)';
    }

    const primary = assignees.find(e => e.id === selectedValues[0]);
    if (primary) {
      const isMe = currentUser?.employeeId === primary.id || currentUser?.id === primary.id;
      const name = isMe ? 'You' : primary.full_name.split(' ')[0];
      return `${name} + ${selectedValues.length - 1}`;
    }

    return `Selected (${selectedValues.length})`;
  };

  const renderItem = (opt, isSelected, mode) => (
    <>
      <div className="custom-dropdown-checkbox">
        {isSelected && (mode === 'single' ? <div className="radio-dot" /> : '✓')}
      </div>
      <span className="custom-dropdown-text">
        {taskUtils.formatAssigneeForList(opt.value, opt.label, currentUser)}
      </span>
    </>
  );

  return (
    <BaseDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      mode={isSingle ? 'single' : 'multi'}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      loading={loading}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label']}
      getLabel={getLabel}
      renderItem={renderItem}
      limitToIds={limitToIds}
      loadMoreLabel="+ Load other employees"
      displayMode="compact"
      currentUser={currentUser}
    />
  );
};

export default AssigneeSelector;
```

---

## Files That Must NOT Change

These consume `AssigneeSelector` and must work unchanged after this refactor:

| File | How It Uses AssigneeSelector |
|:---|:---|
| `src/verticals/ChargingHubs/HubTaskForm.jsx` | Multi-select for hub tasks; also uses `isSingle` in orchestration step |
| `src/verticals/Employees/EmployeeTaskForm.jsx` | Multi-select for employee tasks |
| `src/verticals/Clients/ClientTaskForm.jsx` | Multi-select for client tasks |

Search: `grep -r "AssigneeSelector" src/` to find all consumers.

---

## Verification

1. `npm run dev` zero errors
2. Open Charging Hubs → any task form
3. Click the Assignee(s) field:
   - [ ] Dropdown opens
   - [ ] Employees listed with "You" prefix for current user
   - [ ] Fuzzy search works
   - [ ] Multi-select: checkmarks appear, trigger shows "Name + N"
4. In HubTaskForm orchestration step (isSingle mode):
   - [ ] Click an employee → radio dot appears → dropdown closes immediately
5. Zero console errors

---

## Handoff

Proceed to `05_HUB_SELECTOR_WRAPPER.md`.
