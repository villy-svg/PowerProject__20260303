# Runbook 06: Consumer Config Map & Forward-Looking Feature Guide

> **STANDALONE.** Reference document. No code changes are made here. Use this to decide which BaseDropdown features to enable for any specific dropdown in the app.

---

## Purpose

When adding a new dropdown to any form, or enabling a new feature on an existing dropdown, consult this map first. It answers:
1. Which wrapper component to use (`CustomSelect`, `AssigneeSelector`, `HubSelector`)
2. Which forward-looking props are safe to enable — and what to expect when you do

---

## Part 0: Known Behavioral Changes in This Migration

These are changes introduced by the migration from legacy components to `BaseDropdown` wrappers. Each must be verified before the branch is merged.

### 1. `AssigneeSelector` with `isSingle={true}` — onChange type change

| | Before (legacy) | After (BaseDropdown) |
|:---|:---|:---|
| `isSingle={true}` onChange fires with | `string[]` (e.g., `["uuid"]`) | `string` (e.g., `"uuid"`) |

**Action required:** Search for all `isSingle` usages:
```powershell
# Run this in the project root terminal:
Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "isSingle"
```
For each consumer found, determine if it reads `value[0]` from the result. If yes, update it to use `value` directly.

**Known consumer:** `HubTaskForm.jsx` orchestration step (line ~120-150).

### 2. CSS Container Class Changes

After migration, each component renders `BaseDropdown`'s root `<div>`, which has class `bd-container custom-select-container` instead of the legacy per-component class.

| Component | Old Root Class | New Root Class |
|:---|:---|:---|
| `CustomSelect` | `.custom-select-container` | `.bd-container custom-select-container` |
| `AssigneeSelector` | `.assignee-selector-container` | `.bd-container custom-select-container` |
| `HubSelector` | `.hub-selector-container` | `.bd-container custom-select-container` |

All CSS that targets `.assignee-selector-container` or `.hub-selector-container` for container-level overrides will no longer match. Review the per-component CSS files for any selectors like:
- `.assignee-selector-container .something { }` → update to `.custom-select-container .something { }`
- `.hub-selector-container.open .dropdown-arrow { }` → already handled by `.custom-select-container.open .dropdown-arrow { }` in `DropdownSystem.css`

---

## Part 1: Current Consumer Map

### `<CustomSelect>` — Single-Select Consumers

| Consumer File | Field | Notes |
|:---|:---|:---|
| `EmployeeFormSections.jsx` | Gender | Synthetic event adapter onChange |
| `EmployeeFormSections.jsx` | Primary Hub | `'ALL'` option + filter |
| `EmployeeFormSections.jsx` | Role | `[CODE] Name` label format |
| `EmployeeFormSections.jsx` | Department | `[CODE] Name` label format |
| `EmployeeFormSections.jsx` | Reporting Manager | Filters self + inactive |
| `HubManagement.jsx` | Status | Lowercase values: `'active'`, `'maintenance'`, `'inactive'` |
| `ClientForm.jsx` | Billing Model | Synthetic event adapter onChange |
| `TaskHierarchySelector.jsx` | Parent Task | Wraps CustomSelect; uses `fullWidthDropdown={true}` |

### `<AssigneeSelector>` — Multi-Select Consumers

| Consumer File | Mode | `limitToIds` |
|:---|:---|:---|
| `HubTaskForm.jsx` — assignees field | multi | none |
| `HubTaskForm.jsx` — orchestration row | single (`isSingle`) | from hub's employees |
| `EmployeeTaskForm.jsx` | multi | none |
| `ClientTaskForm.jsx` | multi | none |

### `<HubSelector>` — Multi-Select Consumers

| Consumer File | Notes |
|:---|:---|
| `HubTaskForm.jsx` | `hubs` filtered by city before passing in |

---

## Part 2: Forward-Looking Feature Flags

These props exist in `BaseDropdown` but are disabled by default in all current wrappers. This section documents what enabling each one does, and which consumers would benefit.

---

### `selectAll={true}`

**What it does:** Renders a "Select All / Deselect All" toggle at the top of the dropdown list. Toggles all *currently visible/filtered* options.

**When to enable:**
- `HubSelector` — when a user needs to select all hubs in a city quickly
- `AssigneeSelector` — when doing bulk assignment across all team members

**How to enable on HubSelector:**
```jsx
// In HubSelector.jsx wrapper, add to BaseDropdown:
selectAll={true}
```

**Caution:** If `maxSelect` is also set, Select All respects the cap.

---

### `maxSelect={N}`

**What it does:** Prevents selecting more than `N` values in multi mode. Options beyond the limit appear grayed out (`.bd-option.at-max` CSS class).

**When to enable:**
- Any field with a business-rule cap (e.g., "max 3 hubs per task")
- Survey-style forms

**How to enable:**
```jsx
// In the wrapper or direct BaseDropdown usage:
maxSelect={3}
```

---

### `clearable={true}`

**What it does:** Shows a `×` button inside the trigger button. Clicking it calls `onChange('')` (single) or `onChange([])` (multi) without opening the dropdown.

**When to enable:**
- Any optional field (not `required`)
- Long forms where the user needs to quickly reset a selection

**How to enable on CustomSelect:**
```jsx
// Add a clearable prop to the CustomSelect wrapper signature,
// then pass it through to BaseDropdown:
clearable={clearable}
```

**Caution:** Never show the clear button when `disabled={true}` or `required={true}`.

---

### `displayMode='pills'`

**What it does:** Renders each selected value as a removable pill tag inside the trigger. Pills wrap to multiple lines if many items are selected.

**When to enable:**
- Multi-select fields where visibility of ALL selected values is critical
- Sidebar filter panels (not modal forms — pills in a modal form field may overflow)

**How to enable on AssigneeSelector:**
```jsx
// Add a displayMode prop to AssigneeSelector wrapper, pass through:
displayMode="pills"
```

**Caution:** Not suitable for compact table row dropdowns. Use `'compact'` there.

---

### `displayMode='count'`

**What it does:** Shows `"N selected"` instead of the primary name. Simpler than compact.

**When to enable:**
- Bulk action bars where exact names don't matter, just the count
- Mobile views where space is tight

---

### `groupBy='group'`

**What it does:** Groups options by a key on each option object and renders sticky group header rows between them.

**When to enable:**
- Hub picker grouped by city
- Role picker grouped by department
- Billing model picker grouped by type

**How to enable on HubSelector:**
```jsx
// Add 'group' to each option in options build:
const options = hubs.filter(...).map(hub => ({
  label: hub.hub_code || hub.name,
  value: hub.id,
  sublabel: hub.name,
  group: hub.city,   // ← add this
}));

// In BaseDropdown:
groupBy="group"
```

---

### `keyboardNav={true}`

**What it does:** Enables Arrow Up/Down navigation through options, Enter to select, Escape to close.

**When to enable:**
- Power-user facing forms (Hub Management, admin screens)
- Any form likely to be used by users who prefer keyboard

**Notes:**
- Works alongside `searchable={true}` — search input must be in DOM for keyboard events to fire
- The `onKeyDown` handler is attached to the root `bd-container` div

---

### `isOpen` / `onOpenChange` (Controlled Open)

**What it does:** Allows parent components to control whether the dropdown is open. When `isOpen` is `undefined`, the component self-manages (default).

**When to enable:**
- When a parent needs to imperatively close all open dropdowns (e.g., a row collapses)
- When building compound components that coordinate multiple dropdowns

**Pattern:**
```jsx
const [open, setOpen] = useState(false);

<BaseDropdown
  isOpen={open}
  onOpenChange={setOpen}
  ...
/>
```

---

### `footerSlot={<JSX />}`

**What it does:** Renders custom JSX at the bottom of the dropdown panel, below all options.

**When to enable:**
- "Add new option" link (e.g., "+ Add new role" in a role picker)
- Filter reset link inside the dropdown
- Pagination controls for large lists

**Pattern:**
```jsx
footerSlot={
  <button type="button" className="halo-button" onClick={handleAddNew}>
    + Add New Role
  </button>
}
```

---

### `emptyState={<JSX />}`

**What it does:** Replaces the default "No options available" text with custom JSX when filtered list is empty.

**When to enable:**
- When the empty state should guide the user (e.g., "No hubs in this city — contact admin")
- When showing a link to create the first record

**Pattern:**
```jsx
emptyState={<span>No hubs found. <a href="/hubs/new">Add one?</a></span>}
```

---

### `sublabel` on Options

**What it does:** Shows a secondary line of text under the option label inside the dropdown.

**When to enable:**
- Role picker: show department under role name
- Hub picker: show city/address under hub code
- Billing model picker: show description under name

**How to add:**
```js
options={billingModels.map(m => ({
  label: m.name,
  value: m.id,
  sublabel: m.description,  // ← add this
}))}
```

---

## Part 3: Adding a Brand New Dropdown to a Form

When adding any new dropdown field to any form in the app:

**Step 1.** Decide: is it single or multi-select?
- Single → use `<CustomSelect>`
- Multi (hubs) → use `<HubSelector>`
- Multi (employees) → use `<AssigneeSelector>`
- Multi (anything else) → use `<BaseDropdown mode="multi">` directly

**Step 2.** Check the consumer config table above to see if a similar field already exists. Reuse its `options` build pattern.

**Step 3.** Default all forward-looking props to their OFF state. Only enable what is needed now.

**Step 4.** Verify:
- `onChange` receives the correct type: `string` (single) or `string[]` (multi)
- `value` initializes to `''` (single) or `[]` (multi) in `formData`
- `disabled={isViewOnly}` is wired up for view-only form states

---

## Part 4: Feature Activation Checklist

When a feature is requested for a specific dropdown, use this checklist:

- [ ] Identify which wrapper component or direct `BaseDropdown` usage to modify
- [ ] Read the feature's section above
- [ ] Add the prop to the wrapper's `BaseDropdown` call
- [ ] If the wrapper doesn't expose the prop externally yet, add it to the wrapper's signature first
- [ ] Test the specific dropdown in the browser
- [ ] Confirm `npm run dev` shows zero errors
- [ ] Confirm zero console errors when using the dropdown

---

## Part 5: Step-by-Step Execution Guide for Interns

If you are an intern tasked with adding a new dropdown to a form, follow these foolproof steps.

### Step 1: Open the Form File
Open the specific form file (e.g., `EmployeeFormSections.jsx`).

> **How to find all current consumers:**
> ```powershell
> # Run in the project root terminal:
> Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "import CustomSelect"
> Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "import AssigneeSelector"
> Get-ChildItem -Recurse -Include "*.jsx","*.js" | Select-String "import HubSelector"
> ```

### Step 2: Add Your State
Find the state object (like `formData`). Add your field and initialize it to `''` (for single-select) or `[]` (for multi-select).

### Step 3: Import the Component
Paste the import at the top of your file:
`import CustomSelect from '../../components/CustomSelect';` (adjust relative paths as needed).

### Step 4: Paste JSX
Insert the component directly into your form markup:

```jsx
<CustomSelect
  id="custom-identifier"
  value={formData.myField}
  onChange={(val) => setFormData({ ...formData, myField: val })}
  options={[
    { label: 'First Choice', value: '1' },
    { label: 'Second Choice', value: '2' }
  ]}
  placeholder="Choose..."
/>
```

---

## Series Complete

All six runbooks are done. The dropdown system is now:
- **Centralized** — one engine (`BaseDropdown`)
- **Backwards-compatible** — all three wrappers preserve their original API
- **Forward-looking** — every future dropdown feature has a named prop and documented activation path
