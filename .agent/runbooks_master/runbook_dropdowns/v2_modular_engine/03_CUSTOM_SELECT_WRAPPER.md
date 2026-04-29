# Runbook 03: Migrate `CustomSelect.jsx` to Thin Wrapper

> **STANDALONE.** Refactor `CustomSelect.jsx` to be a thin wrapper around `BaseDropdown`. Runbooks 01 and 02 must be complete before executing this.

---

## Mission

Replace the body of `src/components/CustomSelect.jsx` with a thin wrapper that passes the correct `BaseDropdown` props to reproduce the exact same behavior as the current implementation. No consumer of `CustomSelect` should need any changes.

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\CustomSelect.jsx`

---

## Pre-Flight: Read These Files First

Before making any changes, use the `view_file` tool to read these files to build context:

| File | Why |
|:---|:---|
| `src/components/CustomSelect.jsx` | Current implementation — understand what it does before replacing |
| `src/components/BaseDropdown.jsx` | Target component — understand its prop API |
| `00_INDEX.md` (this series) | Feature flag column for CustomSelect |

---

## Current Behavior to Preserve

| Feature | Current Implementation | BaseDropdown Prop |
|:---|:---|:---|
| Single select | Closes dropdown on pick, fires `onChange(val)` | `mode="single"` |
| Fuzzy search | `fuzzyMatch()` on `opt.label` | `searchable={true}` `fuzzySearch={true}` `searchKeys={['label']}` |
| Full-width dropdown | `useEffect` positioning against `.modal-content` | `fullWidthDropdown` (pass through) |
| Placeholder | Shows when `value === ''` or no match | `placeholder` (pass through) |
| Disabled | Trigger grayed out, no interaction | `disabled` (pass through) |
| Required | `aria-required` on trigger | `required` (pass through) |
| Radio dot on selected | `.single` class + `radio-dot` div | Automatic when `mode="single"` |

> **CRITICAL — onChange Contract:** Several consumers (e.g., `EmployeeFormSections.jsx`, `ClientForm.jsx`) call `CustomSelect` with an `onChange` that expects a **raw value** (a string), **not** a synthetic event. For example:
> ```jsx
> onChange={(val) => handleChange({ target: { name: 'gender', value: val } })}
> ```
> `BaseDropdown` in single mode calls `onChange(val)` with the raw string, which is exactly what these consumers expect. This contract is preserved — no consumer changes needed.

> **CRITICAL — Radio Dot:** The current `CustomSelect.jsx` renders the radio-dot with an inline `style` prop:
> ```jsx
> <div className="radio-dot" style={{ width: '8px', height: '8px', background: '#000', borderRadius: '50%' }} />
> ```
> The new `BaseDropdown` must NOT have this inline style. The `.radio-dot` CSS class in `DropdownSystem.css` handles the visual. Removing the inline style is intentional and correct.

---

## Props CustomSelect Exposes (Must All Be Passed Through)

```
id, value, onChange, options, placeholder, disabled, required, fullWidthDropdown
```

---

## Step-by-Step Implementation for Interns

Follow these steps exactly to execute the migration. Do not modify any files other than `CustomSelect.jsx`.

### Step 1: Overwrite `CustomSelect.jsx`
Open `src/components/CustomSelect.jsx`. Delete everything in the file! Copy and paste the exact code below:

```jsx
import React from 'react';
import BaseDropdown from './BaseDropdown';

/**
 * CustomSelect
 * Single-select dropdown. Thin wrapper around BaseDropdown.
 * Preserves the original API surface — no consumer changes needed.
 */
const CustomSelect = ({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Select option...',
  disabled = false,
  required = false,
  fullWidthDropdown = false,
}) => (
  <BaseDropdown
    id={id}
    value={value}
    onChange={onChange}
    options={options}
    placeholder={placeholder}
    disabled={disabled}
    required={required}
    fullWidthDropdown={fullWidthDropdown}
    mode="single"
    searchable={true}
    fuzzySearch={true}
    searchKeys={['label']}
    showCheckbox={true}
    displayMode="compact"
  />
);

export default CustomSelect;
```

---

## Verification

### Step 2: Compile Check
Verify that the application still compiles.
- **Action:** If the dev server is running (`npm run dev`), check its terminal output. Otherwise, run `npm run build` using the `run_command` tool.
- **Goal:** Ensure zero syntax or compilation errors.

### Step 3: Smoke Test (Find One Consumer)
Use the `grep_search` tool to find a file where `CustomSelect` is imported.
- **Action:** Run `grep_search` with `Query: "import CustomSelect"` and `SearchPath: "src/"`.
- Pick any ONE consumer file from the results (e.g., `HubManagement.jsx`, `ClientForm.jsx`, `EmployeeFormSections.jsx`).

### Step 4: Browser Verification
Open the page of the consumer file you found in the browser. The dropdown should behave exactly as it did before:
- [ ] Open when clicked
- [ ] Show a search input after click
- [ ] Filter options as you type
- [ ] Select an option and close the dropdown
- [ ] Show the selected label on the trigger
- [ ] Show a radio dot on the selected option inside the list

### Full Consumer List (Do NOT modify these files)

These files import `CustomSelect` and must continue to work unchanged:

| File | Field | onChange Pattern |
|:---|:---|:---|
| `src/verticals/Employees/EmployeeFormSections.jsx` | Gender, Hub, Role, Department, Manager | Synthetic event adapter: `onChange={(val) => handleChange({ target: { name, value: val } })}` |
| `src/verticals/ChargingHubs/HubManagement.jsx` | Status | Direct state setter |
| `src/verticals/Clients/ClientForm.jsx` | Billing Model | Synthetic event adapter |
| `src/components/TaskHierarchySelector.jsx` | Parent Task | `fullWidthDropdown={true}` is used here |

> All consumers pass a raw value to `onChange`, which is what `BaseDropdown` provides in single mode. No consumer adapters need to change.

---

## Handoff

Proceed to `04_ASSIGNEE_SELECTOR_WRAPPER.md`.
