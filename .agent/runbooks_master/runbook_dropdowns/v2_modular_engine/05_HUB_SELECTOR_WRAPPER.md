# Runbook 05: Migrate `HubSelector.jsx` to Thin Wrapper

> **STANDALONE.** Refactor `HubSelector.jsx` to be a thin wrapper around `BaseDropdown`. Runbooks 01 and 02 must be complete before executing this.

---

## Mission

Replace the body of `src/verticals/ChargingHubs/HubSelector.jsx` with a thin wrapper around `BaseDropdown`. The wrapper is responsible for:
1. Accepting the `hubs[]` prop (externally provided — does NOT self-fetch)
2. Building `options` from hub records, excluding `MULTI` hubs
3. Providing a custom `getLabel` for hub-code + count format
4. Providing a custom `renderItem` for the hub-code-first row layout
5. Excluding the MULTI hub via `filterFn`

No consumer of `HubSelector` should need any changes.

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\verticals\ChargingHubs\HubSelector.jsx`

---

## Pre-Flight: Read These Files First

| File | Why |
|:---|:---|
| `src/verticals/ChargingHubs/HubSelector.jsx` | Current implementation to replace |
| `src/verticals/ChargingHubs/HubSelector.css` | Component-scoped CSS that must be preserved — defines `.hub-info`, `.hub-code`, `.hub-name`, `.hub-selector-container`, `.selector-backdrop` |
| `src/components/BaseDropdown.jsx` | Target component prop API |

> **HubSelector.css class inventory** (you must keep these working):
> - `.hub-selector-container` — position:relative, width:100%, user-select:none
> - `.hub-selector-trigger` — visual trigger button style (will no longer match after migration; the new trigger uses `.custom-select-trigger`)
> - `.selector-backdrop` — fixed full-screen overlay for click-outside close
> - `.hub-info` — flex column wrapper for hub code + name
> - `.hub-code` — monospace code badge
> - `.hub-name` — full hub name text
> - `.hub-dropdown-menu` — contains `@extend .custom-dropdown-menu;` which is invalid CSS syntax (no-op). Pre-existing issue, do not fix here.

> **CSS Container Class Migration:** The current `HubSelector` renders `<div className="hub-selector-container">`. After migration, `BaseDropdown` renders `<div className="bd-container custom-select-container">`. The `.hub-selector-container` CSS (position, user-select, arrow rotation) will no longer apply to the container.
> → **Action:** Keep `import './HubSelector.css';` in the wrapper. This preserves `.selector-backdrop`, `.hub-info`, `.hub-code`, `.hub-name`. The container will be styled by `.custom-select-container` in `DropdownSystem.css` instead.

---

## Current Props (Must All Be Preserved)

```
hubs, value, onChange, id, disabled, placeholder
```

---

## Feature Mapping: HubSelector → BaseDropdown

| HubSelector Feature | BaseDropdown Prop |
|:---|:---|
| Multi-select | `mode="multi"` |
| `hubs.filter(h => h.name !== 'MULTI')` | `filterFn={opt => opt.raw?.name !== 'MULTI'}` (see options build) |
| Fuzzy on `hub_code` AND `name` | `searchKeys={['label', 'sublabel']}` |
| Custom label "CODE + N" | `getLabel` prop |
| Hub-code-first item layout | `renderItem` prop |
| Checkbox multi | `showCheckbox={true}` |
| `placeholder` | `placeholder` pass-through |
| `disabled` | `disabled` pass-through |
| `id` | `id` pass-through |

---

## Options Array Shape

The MULTI exclusion happens at option-build time (not via filterFn) — this is simpler and more correct:

```js
const options = hubs
  .filter(hub => hub.name !== 'MULTI')
  .map(hub => ({
    label: hub.hub_code || hub.name,   // primary search key + display
    value: hub.id,
    sublabel: hub.name,                // secondary search key
    // hub_code: hub.hub_code          // optional: duplicate for clarity
  }));
```

> The `filterFn` approach is an alternative but filtering at build time is preferred — it keeps `BaseDropdown`'s internal logic clean.

---

## Custom getLabel

```js
const getLabel = (selectedValues, options) => {
  if (selectedValues.length === 0) return 'N/A (No Hub)';

  const firstOpt = options.find(o => o.value === selectedValues[0]);
  if (!firstOpt) return `Selected (${selectedValues.length})`;

  const primaryLabel = firstOpt.label; // hub_code or name

  if (selectedValues.length === 1) return primaryLabel;
  return `${primaryLabel} + ${selectedValues.length - 1}`;
};
```

---

## Custom renderItem

The current HubSelector shows `hub_code` prominently, not `full_name`. Preserve via `renderItem`:

```jsx
const renderItem = (opt, isSelected) => (
  <>
    <div className="custom-dropdown-checkbox">
      {isSelected && '✓'}
    </div>
    <div className="hub-info">
      <span className="hub-code">{opt.label}</span>
      {opt.sublabel && opt.sublabel !== opt.label && (
        <span className="hub-name">{opt.sublabel}</span>
      )}
    </div>
  </>
);
```

> The `.hub-info`, `.hub-code`, `.hub-name` classes are defined in `HubSelector.css` and must remain.

> **New behavior note:** The old `HubSelector.jsx` only rendered `hub_code` in the option row — it never showed the hub `name` below it. The new `renderItem` above shows the hub name as a sublabel when it differs from the hub code. This is an **intentional improvement**. The `hub-name` CSS class exists in `HubSelector.css` and will now be visually active for the first time.

---

## Target Code Shape

```jsx
import React from 'react';
import BaseDropdown from '../../components/BaseDropdown';
import './HubSelector.css';
import '../../styles/DropdownSystem.css';

/**
 * HubSelector
 * Multi-select hub picker. Thin wrapper around BaseDropdown.
 * Accepts hubs[] as a prop — does NOT self-fetch.
 * Preserves original API surface — no consumer changes needed.
 */
const HubSelector = ({
  hubs = [],
  value = [],
  onChange,
  id = '',
  disabled = false,
  placeholder = 'Select Hubs...',
}) => {
  const options = hubs
    .filter(hub => hub.name !== 'MULTI')
    .map(hub => ({
      label: hub.hub_code || hub.name,
      value: hub.id,
      sublabel: hub.name,
    }));

  const getLabel = (selectedValues, options) => {
    // ... hub code + count label (see above)
  };

  const renderItem = (opt, isSelected) => (
    // ... hub-code-first layout (see above)
  );

  return (
    <BaseDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      mode="multi"
      placeholder={placeholder}
      disabled={disabled}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label', 'sublabel']}
      getLabel={getLabel}
      renderItem={renderItem}
      showCheckbox={true}
      displayMode="compact"
      // Forward-looking features OFF
    />
  );
};

export default HubSelector;
```

---

## Relative Import Path

`HubSelector.jsx` lives at `src/verticals/ChargingHubs/HubSelector.jsx`.
`BaseDropdown.jsx` lives at `src/components/BaseDropdown.jsx`.
Correct relative import: `'../../components/BaseDropdown'`

> **Why two levels up?** `HubSelector.jsx` is inside `src/verticals/ChargingHubs/`. To reach `src/components/`, go up to `ChargingHubs/` (`..`), then up to `verticals/` (`..`), which reaches `src/`, then down to `components/BaseDropdown`. The path `../../components/BaseDropdown` is correct.

---

## Step-by-Step Implementation Guide for Interns

Follow these steps exactly to execute the migration. Do not modify any files other than `HubSelector.jsx`.

### Step 1: Find the File
Navigate to the `src/verticals/ChargingHubs/` folder. Find `HubSelector.jsx`.

### Step 2: Overwrite File
Open `src/verticals/ChargingHubs/HubSelector.jsx`. Delete all existing text! Copy the exact code block below and paste it in:

```jsx
import React from 'react';
import BaseDropdown from '../../components/BaseDropdown';
import './HubSelector.css';
import '../../styles/DropdownSystem.css';

const HubSelector = ({
  hubs = [],
  value = [],
  onChange,
  id = '',
  disabled = false,
  placeholder = 'Select Hubs...',
}) => {
  const options = hubs
    .filter(hub => hub.name !== 'MULTI')
    .map(hub => ({
      label: hub.hub_code || hub.name,
      value: hub.id,
      sublabel: hub.name,
    }));

  const getLabel = (selectedValues, options) => {
    if (selectedValues.length === 0) return 'N/A (No Hub)';

    const firstOpt = options.find(o => o.value === selectedValues[0]);
    if (!firstOpt) return `Selected (${selectedValues.length})`;

    const primaryLabel = firstOpt.label;

    if (selectedValues.length === 1) return primaryLabel;
    return `${primaryLabel} + ${selectedValues.length - 1}`;
  };

  const renderItem = (opt, isSelected) => (
    <>
      <div className="custom-dropdown-checkbox">
        {isSelected && '✓'}
      </div>
      <div className="hub-info">
        <span className="hub-code">{opt.label}</span>
        {opt.sublabel && opt.sublabel !== opt.label && (
          <span className="hub-name">{opt.sublabel}</span>
        )}
      </div>
    </>
  );

  return (
    <BaseDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      mode="multi"
      placeholder={placeholder}
      disabled={disabled}
      searchable={true}
      fuzzySearch={true}
      searchKeys={['label', 'sublabel']}
      getLabel={getLabel}
      renderItem={renderItem}
      showCheckbox={true}
      displayMode="compact"
    />
  );
};

export default HubSelector;
```

---

## Files That Must NOT Change

| File | How It Uses HubSelector |
|:---|:---|
| `src/verticals/ChargingHubs/HubTaskForm.jsx` | `<HubSelector hubs={filteredHubs} value={formData.hub_ids} onChange={...} />` |
| Any other task form that accepts hub selection | Same pattern |

Search: `grep -r "HubSelector" src/` to find all consumers.

---

## Verification

1. `npm run dev` zero errors
2. Open Charging Hubs → New Task form
3. Click the Charging Hub(s) field:
   - [ ] Dropdown opens
   - [ ] MULTI hub is NOT in the list
   - [ ] Fuzzy search works (type partial hub code)
   - [ ] Multi-select: checkmarks appear
   - [ ] Trigger label shows `HUB_CODE + N` format
   - [ ] Clicking backdrop closes dropdown
4. Zero console errors

---

## Handoff

Proceed to `06_CONSUMER_CONFIG_MAP.md`.
