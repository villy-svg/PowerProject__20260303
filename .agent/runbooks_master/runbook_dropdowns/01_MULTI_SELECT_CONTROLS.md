# Phase 1: Multi-Select Controls — Refactor Runbook

> **STANDALONE DOCUMENT.** This runbook can be executed with zero prior context. It contains all background, file paths, current code state, target state, step-by-step instructions, and verification criteria needed to complete this phase.

---

## Mission

Audit and refactor the two core multi-select components — `HubSelector` and `AssigneeSelector` — to ensure they are fully compliant with the PowerProject dropdown design system, use no legacy patterns, and surface no runtime bugs.

---

## Pre-Flight: What You Need to Know

### The Two Target Components

| Component | File | Purpose |
|:---|:---|:---|
| `HubSelector` | `src/verticals/ChargingHubs/HubSelector.jsx` | Multi-selects one or more Charging Hub records |
| `AssigneeSelector` | `src/components/AssigneeSelector.jsx` | Multi-selects one or more Employee/Assignee records |

These components are **not** being replaced — they ARE the canonical multi-select components. This phase is about auditing, hardening, and ensuring they follow all design system rules.

### What These Components Do (Current Behavior)

**`HubSelector`**
- Accepts a `hubs[]` prop (passed in — does NOT self-fetch)
- `value` prop is `string[]` (array of hub UUIDs)
- `onChange` fires with a new `string[]`
- Has fuzzy search on `hub_code` and `name`
- Filters out hubs where `hub.name === 'MULTI'`
- Renders a custom trigger button, a backdrop, and a dropdown menu
- Does NOT have a "Select All" toggle

**`AssigneeSelector`**
- Self-fetches all employees via `useAssignees(true)` — receives NO `employees` prop
- `value` prop is `string[]` (array of employee UUIDs)
- `onChange` fires with a new `string[]`
- Has a `isSingle` prop: when `true`, acts as single-select (replaces checkbox with radio dot, closes immediately on pick, wraps single selection in `[id]` array)
- Has a `limitToIds` prop: shows a subset first with a "Load other employees" expander
- Has fuzzy search on `full_name`
- Does NOT have a "Select All" toggle

---

## File 1: `HubSelector.jsx`

**Full path:** `src/verticals/ChargingHubs/HubSelector.jsx`

### Current State Analysis

The component is mostly correct. Known issues to verify:

1. **Missing `useEffect` for click-outside close** — The dropdown uses a `selector-backdrop` overlay div for dismiss, which is an accepted pattern. Verify it works without scroll artifacts.
2. **"Select All" is absent** — This is intentional. Hub selection intentionally does NOT have Select All because selecting all hubs in a city is not a common workflow. Do NOT add it unless explicitly requested.
3. **`enableSelectAll` prop** — This prop is listed in the index API table but is NOT actually implemented in `HubSelector.jsx`. It was planned but not built. Do not add it unless asked.
4. **`id` prop forwarding** — The `id` prop is correctly forwarded to the trigger `<button>` element. ✅
5. **Filtering logic** — `hubs.filter(hub => hub.name !== 'MULTI' && ...)` — this is correct and intentional. The MULTI hub is a synthetic umbrella record and must never appear in the picker.

### Step-by-Step Verification

**Step 1.** Open the file and verify the import block at the top:
```
File: src/verticals/ChargingHubs/HubSelector.jsx
Expected imports:
  import React, { useState, useRef, useEffect } from 'react';
  import './HubSelector.css';
  import '../../styles/DropdownSystem.css';
```
Both CSS imports must be present. If either is missing, add it.

**Step 2.** Verify the component signature accepts these props, all with defaults:
```
hubs = []
value = []
onChange          ← required, no default
id
disabled = false
placeholder = 'Select Hubs...'
```
If any prop is missing a default (except `onChange`), add `= defaultValue`.

**Step 3.** Verify the `selectedIds` normalization line:
```js
const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);
```
This must exist. It prevents crashes when a string UUID is accidentally passed instead of an array.

**Step 4.** Verify the `filteredHubs` line:
```js
const filteredHubs = hubs.filter(hub =>
  hub.name !== 'MULTI' && (fuzzyMatch(hub.hub_code, searchTerm) || fuzzyMatch(hub.name, searchTerm))
);
```
The `hub.name !== 'MULTI'` guard must be present.

**Step 5.** Verify the `toggleOption` function handles the disabled state:
```js
const toggleOption = (id) => {
  if (disabled) return;
  // ... rest of toggle logic
};
```

**Step 6.** Verify the trigger button renders correctly:
```jsx
<button
  type="button"
  id={id}
  className={`hub-selector-trigger ${disabled ? 'disabled' : ''}`}
  onClick={(e) => { e.stopPropagation(); if (!disabled) setIsOpen(true); }}
  aria-expanded={isOpen}
  aria-haspopup="listbox"
>
```
All of: `type="button"`, `id={id}`, `aria-expanded`, `aria-haspopup` must be present.

**Step 7.** Verify the dropdown only renders when `isOpen && !disabled`:
```jsx
{isOpen && !disabled && (
  <>
    <div className="selector-backdrop" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(false); }} />
    <div className="hub-dropdown-menu custom-dropdown-menu fade-in">
      ...
    </div>
  </>
)}
```

**Step 8.** Verify each option has:
- `key={hub.id}`
- `id={\`hub-option-${hub.id}\`}`
- `role="option"`
- `aria-selected={isSelected}`
- `className={\`custom-dropdown-option ${isSelected ? 'selected' : ''}\`}`

**Step 9.** Verify the empty state renders when `filteredHubs.length === 0`:
```jsx
{filteredHubs.length === 0 ? (
  <div className="no-hubs">No hubs available</div>
) : (
  filteredHubs.map(hub => { ... })
)}
```

### What to Fix If Something Is Wrong

| Issue Found | Fix |
|:---|:---|
| Missing CSS import | Add `import '../../styles/DropdownSystem.css';` at top |
| `value` is a string, not array | Change to `const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);` |
| Missing `type="button"` on trigger | Add attribute — prevents accidental form submission |
| Missing `aria-expanded` / `aria-haspopup` | Add for accessibility compliance |
| MULTI hubs appearing in list | Ensure `hub.name !== 'MULTI'` filter is in `filteredHubs` |
| Backdrop does not call `e.preventDefault()` | Add `e.preventDefault()` alongside `e.stopPropagation()` |

### ✅ Completion Checklist — HubSelector

- [ ] Both CSS files imported
- [ ] All props have correct defaults
- [ ] `selectedIds` normalizes string to array
- [ ] MULTI hubs are filtered out
- [ ] `toggleOption` checks `disabled` early
- [ ] Trigger button has `type="button"`, `id={id}`, `aria-expanded`, `aria-haspopup`
- [ ] Dropdown guarded by `isOpen && !disabled`
- [ ] Each option has `key`, `id`, `role`, `aria-selected`, `className`
- [ ] Empty state renders when no matches

---

## File 2: `AssigneeSelector.jsx`

**Full path:** `src/components/AssigneeSelector.jsx`

### Current State Analysis

This is the more complex of the two. Key behaviors to verify:

1. **Self-fetching** — Uses `useAssignees(true)` internally. Consumers must NOT pass `employees`. ✅
2. **`isSingle` mode** — When `isSingle={true}`, clicking a row sets `newSelection = [id]` (array of 1) and closes the dropdown. ✅
3. **`limitToIds` expander** — When `limitToIds` is an array, the dropdown shows only those IDs first, with a "+ Load other employees (N)" button to reveal the rest. This is used in the orchestration step of `HubTaskForm`.
4. **Label generation** — `getLabel()` uses `taskUtils.formatAssigneeForList()` to show "You" for the current user. ✅
5. **Loading state** — When `loading` is true (from `useAssignees`), `getLabel()` returns `'Loading...'`.

### Step-by-Step Verification

**Step 1.** Open the file and verify the import block:
```
File: src/components/AssigneeSelector.jsx
Expected imports:
  import React, { useState, useRef, useEffect } from 'react';
  import { useAssignees } from '../hooks/useAssignees';
  import { taskUtils } from '../utils/taskUtils';
  import './AssigneeSelector.css';
```

**Step 2.** Verify the component signature:
```js
const AssigneeSelector = ({
  value = [],
  onChange,
  currentUser,
  id,
  isSingle = false,
  limitToIds = null,
  disabled = false,
  required = false,
  placeholder = 'Select Assignees...'
})
```
All defaults must be present.

**Step 3.** Verify the internal hook call:
```js
const { assignees, loading } = useAssignees(true);
```
The `true` argument enables fetching active employees only. This must be `true`.

**Step 4.** Verify `selectedIds` normalization:
```js
const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);
```

**Step 5.** Verify the `visibleAssignees` / `hiddenAssignees` split:
```js
const visibleAssignees = limitToIds
  ? filteredAssignees.filter(e => limitToIds.includes(e.id))
  : filteredAssignees;

const hiddenAssignees = limitToIds
  ? filteredAssignees.filter(e => !limitToIds.includes(e.id))
  : [];
```

**Step 6.** Verify `toggleOption` handles both modes:
```js
const toggleOption = (id) => {
  if (disabled) return;

  let newSelection;
  if (isSingle) {
    newSelection = [id];  // Always wraps in array
  } else {
    if (selectedIds.includes(id)) {
      newSelection = selectedIds.filter(item => item !== id);
    } else {
      newSelection = [...selectedIds, id];
    }
  }
  onChange(newSelection);
  if (isSingle) setIsOpen(false);  // Close immediately in single mode
};
```

**Step 7.** Verify `getLabel()` handles the loading case:
```js
const getLabel = () => {
  if (loading) return 'Loading...';
  if (selectedIds.length === 0) return 'N/A (Unassigned)';
  // ... rest
};
```
`loading` check must come FIRST to prevent crashes while data is fetching.

**Step 8.** Verify `renderOption()` uses `isSingle` to toggle between checkbox (`✓`) and radio (`<div className="radio-dot" />`):
```jsx
<div className="custom-dropdown-checkbox">
  {isSelected && (isSingle ? <div className="radio-dot" /> : '✓')}
</div>
```

**Step 9.** Verify the "Load other employees" button renders correctly:
```jsx
{limitToIds && !showAll && hiddenAssignees.length > 0 && (
  <button
    type="button"
    className="load-others-btn"
    onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
  >
    + Load other employees ({hiddenAssignees.length})
  </button>
)}
{showAll && hiddenAssignees.map(renderOption)}
```
`type="button"` is critical here — without it, clicking this button inside a form will submit the form.

**Step 10.** Verify the empty state:
```jsx
{assignees.length === 0 ? (
  <div className="no-assignees">No employees found</div>
) : (
  <>
    {visibleAssignees.map(renderOption)}
    {/* ... limitToIds expander ... */}
  </>
)}
```

### What to Fix If Something Is Wrong

| Issue Found | Fix |
|:---|:---|
| Missing `type="button"` on "Load others" button | Add `type="button"` |
| `getLabel()` crashes during loading | Move `if (loading) return 'Loading...'` to top of function |
| `isSingle` mode doesn't close dropdown | Add `if (isSingle) setIsOpen(false)` after `onChange(newSelection)` |
| `limitToIds` not filtering visible list | Ensure `visibleAssignees` and `hiddenAssignees` split is present |
| Radio dot not showing in single mode | Ensure `renderOption` checks `isSingle` for the inner element |

### ✅ Completion Checklist — AssigneeSelector

- [ ] All four imports present
- [ ] All props have correct defaults
- [ ] `useAssignees(true)` called with `true`
- [ ] `selectedIds` normalizes string to array
- [ ] `getLabel()` checks `loading` first
- [ ] `toggleOption` handles `isSingle` mode (wraps in array, closes dropdown)
- [ ] `renderOption` shows radio dot for single, checkmark for multi
- [ ] `visibleAssignees` / `hiddenAssignees` split is present when `limitToIds` is set
- [ ] "Load others" button has `type="button"`
- [ ] Trigger button has `type="button"`, `id={id}`, `aria-expanded`, `aria-haspopup`
- [ ] Empty state renders when `assignees.length === 0`

---

## Final Verification — Both Files

After making any fixes:

1. **Open the dev server terminal.** Confirm `npm run dev` shows 0 errors.
2. **Open the app in the browser.**
3. **Navigate to: Charging Hubs → (any task form)**
4. **Test HubSelector:**
   - Click the "CHARGING HUB(S)" field — dropdown should open
   - Type a partial hub code — list should filter
   - Click an option — it should get a checkmark ✓
   - Click a second option — both should be checked
   - Click the backdrop — dropdown should close
   - The trigger label should update to `HUB_CODE + N` format
5. **Test AssigneeSelector:**
   - Click the "ASSIGNEE(S)" field — dropdown should open
   - Type a name — list should filter
   - Click an employee — checkmark should appear
   - Click a second employee — both should be checked
   - Trigger label should update to `Name + N` format
6. **Navigate to: Daily Tasks Management → New Template**
7. **Test AssigneeSelector in single mode (orchestration step):**
   - In HubTaskForm, select 2+ hubs and 2+ assignees, click "Next: Orchestrate Team"
   - Each hub row shows a single-select AssigneeSelector
   - Clicking an employee in that dropdown should show a radio dot (not checkmark) and immediately close
8. **Confirm zero console errors throughout.**

---

## Handoff Note

When this phase is complete, proceed to:
**[Phase 1.1 → 02_CONSUMER_VALIDATION.md](./02_CONSUMER_VALIDATION.md)**
