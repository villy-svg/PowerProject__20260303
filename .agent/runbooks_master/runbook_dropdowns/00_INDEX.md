# Multi-Select Dropdown Centralization — Master Index

## What This Runbook Series Is

This series is the single source of truth for upgrading every dropdown and multi-select control in the PowerProject app to use the two canonical components: **`<CustomSelect>`** (single-select) and **`<HubSelector>`/`<AssigneeSelector>`** (multi-select).

Each runbook in this directory is written to be **100% standalone**. A model with zero project context can open any one file and execute it completely. Do NOT assume the reader has read any other file first.

---

## System Architecture — Read Before Anything Else

### The Two Dropdown Families

| Family | Component | File | Use Case |
|:---|:---|:---|:---|
| **Single-Select** | `<CustomSelect>` | `src/components/CustomSelect.jsx` | City, Priority, Function, Status, Role, Department, Manager, Billing Model |
| **Multi-Select (Hubs)** | `<HubSelector>` | `src/verticals/ChargingHubs/HubSelector.jsx` | Selecting one or more Charging Hubs |
| **Multi-Select (People)** | `<AssigneeSelector>` | `src/components/AssigneeSelector.jsx` | Selecting one or more assignee employees |

### `<CustomSelect>` — API Reference

**File:** `src/components/CustomSelect.jsx`  
**Style:** `src/styles/DropdownSystem.css`

```jsx
<CustomSelect
  id="field-id"           // string — DOM id for the trigger button
  value={formData.field}  // string | "" — the currently selected value
  onChange={(val) => updateField('field', val)} // (string) => void
  options={[              // { label: string, value: string }[]
    { label: 'Option A', value: 'a' },
    { label: 'Option B', value: 'b' }
  ]}
  placeholder="Select..."  // string — shown when no value is selected
  disabled={false}         // boolean — disables the trigger
  fullWidthDropdown={false} // boolean — forces dropdown to span full modal width
/>
```

**onChange contract:** receives the raw `value` string, NOT a synthetic event. Never wrap in `(e) => onChange(e.target.value)`.

**Forbidden patterns:** Do NOT use a native `<select>` tag anywhere in a form that uses the design system.

### `<HubSelector>` — API Reference

**File:** `src/verticals/ChargingHubs/HubSelector.jsx`  
**Style:** `HubSelector.css`, `src/styles/DropdownSystem.css`

```jsx
<HubSelector
  id="hub-selector"
  hubs={filteredHubs}      // Hub[] — array of { id, name, hub_code, city }
  value={formData.hub_ids} // string[] — array of selected hub IDs (UUIDs)
  onChange={(val) => updateField('hub_ids', val)} // (string[]) => void
  disabled={!formData.city} // boolean
  placeholder="Select Hubs..."
/>
```

**onChange contract:** receives a `string[]` of hub UUIDs.

### `<AssigneeSelector>` — API Reference

**File:** `src/components/AssigneeSelector.jsx`

```jsx
<AssigneeSelector
  id="assignee-selector"
  value={formData.assigned_to}  // string[] — array of employee UUIDs
  onChange={(val) => updateField('assigned_to', val)} // (string[]) => void
  currentUser={currentUser}     // object — passed from App.jsx
  isSingle={false}              // boolean — if true, acts as single-select
  limitToIds={null}             // string[] | null — show these IDs first
  disabled={false}
/>
```

**onChange contract:** always returns `string[]` even in `isSingle` mode (it wraps the single value in an array `[id]`).

**Data source:** Internally calls `useAssignees(true)` to self-fetch. **Do NOT pass an `employees` prop** — it fetches its own data.

---

## Component Prop Contracts — Common Mistakes

| Mistake | Correct Pattern |
|:---|:---|
| `onChange={(e) => set(e.target.value)}` on `<CustomSelect>` | `onChange={(val) => set(val)}` |
| Passing `value={string}` to `<HubSelector>` | Must pass `value={string[]}` |
| Passing `value={string}` to `<AssigneeSelector>` | Must pass `value={string[]}` |
| Using native `<select>` | Replace with `<CustomSelect>` |
| Wrapping `<CustomSelect>` in an `onChange` adapter that reads `.target` | The val IS the string directly |

---

## Directory Layout

```
.agent/runbooks_master/runbook_dropdowns/
├── 00_INDEX.md                   ← This file (orientation + API reference)
├── 01_MULTI_SELECT_CONTROLS.md   ← Phase 1: Refactor HubSelector + AssigneeSelector
├── 02_CONSUMER_VALIDATION.md     ← Phase 1.1: Validate all consuming forms
└── 03_SINGLE_SELECT_OVERHAULS.md ← Phase 2: Standardize single-select controls
```

---

## Execution Order

Run the runbooks in this order. Each one depends on the previous phase being complete.

1. **[Phase 1 → 01_MULTI_SELECT_CONTROLS.md](./01_MULTI_SELECT_CONTROLS.md)**  
   Refactor the core `HubSelector` and `AssigneeSelector` components themselves.

2. **[Phase 1.1 → 02_CONSUMER_VALIDATION.md](./02_CONSUMER_VALIDATION.md)**  
   Validate that all forms consuming those components continue to work correctly.

3. **[Phase 2 → 03_SINGLE_SELECT_OVERHAULS.md](./03_SINGLE_SELECT_OVERHAULS.md)**  
   Standardize secondary single-select controls across the remaining forms.

---

## Definition of Done (Global)

A runbook phase is DONE when all of the following are true:
- [ ] No native `<select>` elements remain in any targeted file
- [ ] No inline `style={{ ... }}` overrides exist for dropdown/select elements
- [ ] All `onChange` callbacks match the component's contract (no `.target.value` adapters where not needed)
- [ ] The dev server (`npm run dev`) compiles with zero errors
- [ ] No console errors appear when opening/closing any upgraded dropdown
- [ ] `value` props match expected types (`string` for `<CustomSelect>`, `string[]` for `<HubSelector>` and `<AssigneeSelector>`)
