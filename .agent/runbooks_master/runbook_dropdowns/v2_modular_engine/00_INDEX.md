# v2 Modular Dropdown Engine — Master Index

> **Series Goal:** Replace all three existing dropdown components (`CustomSelect`, `HubSelector`, `AssigneeSelector`) with thin wrappers around a single unified engine: `BaseDropdown`. All features from all three components are merged into `BaseDropdown` as opt-in props. Forward-looking features are included and disabled by default.

> [!IMPORTANT]
> **Known Breaking Change: `isSingle` onChange type.** The legacy `AssigneeSelector` returned `string[]` from `isSingle` mode. After migration, `BaseDropdown` in `mode="single"` returns a plain `string`. Any consumer that reads `value[0]` from the result must be updated to use `value` directly. See `06_CONSUMER_CONFIG_MAP.md` Part 0 for the full list of breaking changes.

---

## Prerequisites for Interns

Before you touch any code, ensure your local development environment is ready.
1. **Open Terminal:** Open your command prompt or VS Code terminal.
2. **Navigate to Workspace:** Ensure you are in the root directory: `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject`
3. **Start Dev Server:** Run `npm run dev`. Keep this terminal open to watch for syntax errors.

---

## Why This Exists

The three current components share ~70% of their logic (fuzzy search, backdrop, open/close, search input, CSS classes) but diverge in specific features. Every bug fix or new feature must be applied in three places. `BaseDropdown` solves this via the **Union Pattern**: a single engine that can express any combination of features via props.

---

## Series Directory

```
.agent/runbooks_master/runbook_dropdowns/v2_modular_engine/
├── 00_INDEX.md                        ← THIS FILE — API reference + series guide
├── 01_BASE_DROPDOWN_COMPONENT.md      ← Build src/components/BaseDropdown.jsx
├── 02_CSS_EXPANSION.md                ← Expand src/styles/DropdownSystem.css
├── 03_CUSTOM_SELECT_WRAPPER.md        ← Refactor CustomSelect.jsx as thin wrapper
├── 04_ASSIGNEE_SELECTOR_WRAPPER.md    ← Refactor AssigneeSelector.jsx as thin wrapper
├── 05_HUB_SELECTOR_WRAPPER.md         ← Refactor HubSelector.jsx as thin wrapper
└── 06_CONSUMER_CONFIG_MAP.md          ← Which props each consumer enables
```

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\.agent\runbooks_master\runbook_dropdowns\v2_modular_engine\`

**Execution order:** `01 → 02 → 03 → 04 → 05 → 06`

Each runbook is **100% standalone** — a model with zero project context can execute it.

---

## Architecture

```
BaseDropdown (src/components/BaseDropdown.jsx)
    ↑ thin wrapper          ↑ thin wrapper          ↑ thin wrapper
CustomSelect.jsx        AssigneeSelector.jsx     HubSelector.jsx
    ↑ consumed by           ↑ consumed by            ↑ consumed by
All single-select       All assignee fields       All hub fields
forms across app        across all task forms     across all task forms
```

---

## `BaseDropdown` — Full Prop API Reference

### Identity & Layout

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `id` | `string` | `''` | DOM id forwarded to the trigger `<button>` |
| `className` | `string` | `''` | Extra class on the root container |
| `fullWidthDropdown` | `boolean` | `false` | Expands dropdown panel to full modal width |
| `dropdownMaxHeight` | `number` | `280` | Max height in px of the dropdown panel |

### Data

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `options` | `{ label, value, sublabel?, group?, disabled? }[]` | `[]` | Static option list |
| `value` | `string \| string[]` | — | Selected value(s). `string` for single, `string[]` for multi |
| `onChange` | `(string \| string[]) => void` | — | Fires with raw `string` (single) or `string[]` (multi) |

### Mode

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `mode` | `'single' \| 'multi'` | `'single'` | Selection mode |

### Search

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `searchable` | `boolean` | `true` | Replace trigger with search input when open |
| `searchPlaceholder` | `string` | `'Search...'` | Placeholder inside the search input |
| `fuzzySearch` | `boolean` | `true` | Use fuzzy matching; `false` = substring match |
| `searchKeys` | `string[]` | `['label']` | Option object keys to search against |

### Label / Display

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `placeholder` | `string` | `'Select...'` | Shown when nothing is selected |
| `getLabel` | `(selectedValues: string[], options: Option[]) => string \| null` | `null` | Override default label logic entirely |
| `displayMode` | `'compact' \| 'pills' \| 'count'` | `'compact'` | How selected values appear on the trigger |
| `currentUser` | `object \| null` | `null` | Passed to `getLabel` for "You" formatting |

### Multi-Select Features

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `selectAll` | `boolean` | `false` | Render "Select All / Deselect All" toggle at top of list |
| `maxSelect` | `number \| null` | `null` | Cap the number of selected values in multi mode |
| `limitToIds` | `string[] \| null` | `null` | Show only these values first; rest behind expander button |
| `loadMoreLabel` | `string` | `'+ Load more...'` | Text for the expander button |

### Item Rendering

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `renderItem` | `(option, isSelected, mode) => JSX \| null` | `null` | Fully custom option renderer; replaces default checkbox row |
| `showCheckbox` | `boolean` | `true` | Show checkbox (multi) or radio dot (single) indicator |
| `groupBy` | `string \| null` | `null` | Option key to group by; renders labelled group headers |

### Clear

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `clearable` | `boolean` | `false` | Show × button inside trigger to clear all selections |

### Filter

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `filterFn` | `(option) => boolean \| null` | `null` | Additional filter applied before search (e.g., exclude MULTI hubs) |

### Keyboard Navigation *(forward-looking — off by default)*

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `keyboardNav` | `boolean` | `false` | Enable Arrow Up/Down + Enter + Escape keyboard control |

### Controlled Open State *(forward-looking — off by default)*

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `isOpen` | `boolean \| undefined` | `undefined` | Controlled open state; `undefined` = uncontrolled (default) |
| `onOpenChange` | `(bool) => void \| null` | `null` | Callback when open state changes |

### Slots

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `emptyState` | `JSX \| string \| null` | `null` | Custom empty state when no options match search |
| `footerSlot` | `JSX \| null` | `null` | JSX rendered at the bottom of the dropdown panel |

### State

| Prop | Type | Default | Description |
|:---|:---|:---|:---|
| `disabled` | `boolean` | `false` | Disables interaction; shows disabled styling |
| `required` | `boolean` | `false` | Sets `aria-required` on trigger |
| `loading` | `boolean` | `false` | Shows `'Loading...'` in trigger label |

---

## Feature Flag Status Per Consumer

| Feature Prop | `CustomSelect` | `AssigneeSelector` | `HubSelector` |
|:---|:---:|:---:|:---:|
| `mode` | `'single'` | `'multi'` | `'multi'` |
| `searchable` | ✅ on | ✅ on | ✅ on |
| `fuzzySearch` | ✅ on | ✅ on | ✅ on |
| `searchKeys` | `['label']` | `['label']` | `['label', 'sublabel']` |
| `fullWidthDropdown` | optional | ❌ off | ❌ off |
| `selectAll` | ❌ off | ❌ off | ❌ off |
| `maxSelect` | ❌ null | ❌ null | ❌ null |
| `limitToIds` | ❌ null | optional | ❌ null |
| `clearable` | ❌ off | ❌ off | ❌ off |
| `displayMode` | `'compact'` | `'compact'` | `'compact'` |
| `groupBy` | ❌ null | ❌ null | ❌ null |
| `keyboardNav` | ❌ off | ❌ off | ❌ off |
| `filterFn` | ❌ null | ❌ null | excludes MULTI |
| `renderItem` | ❌ null | ❌ null | hub code layout |
| `getLabel` | default | custom (You) | custom (CODE+N) |
| `loading` | ❌ off | ✅ from hook | ❌ off |

---

## Global CSS Classes Introduced

> Detailed in `02_CSS_EXPANSION.md`

| Class | Purpose |
|:---|:---|
| `.bd-container` | Root wrapper (alias of `.custom-select-container`) |
| `.bd-trigger` | Trigger button (extends `.custom-select-trigger`) |
| `.bd-trigger-actions` | Right side of trigger: clear btn + arrow |
| `.bd-clear-btn` | The × clear-all button inside the trigger |
| `.bd-option` | Option row (extends `.custom-dropdown-option`) |
| `.bd-option.at-max` | Greyed-out option when `maxSelect` is reached |
| `.bd-option.focused` | Keyboard-focused option highlight |
| `.bd-option-content` | Wraps label + sublabel text |
| `.bd-option-sublabel` | Secondary text under option label |
| `.bd-option-group` | Wrapper for a group of options |
| `.bd-option-group-header` | Group label row |
| `.bd-select-all-btn` | "Select All / Deselect All" toggle button |
| `.bd-pills-container` | Wraps pill tags in `displayMode='pills'` |
| `.bd-pill` | Individual selection pill |
| `.bd-pill-remove` | × button inside a pill |
| `.load-others-btn` | "Load more" expander button (already exists) |

---

## Definition of Done (Series-Wide)

- [ ] `BaseDropdown.jsx` created at `src/components/BaseDropdown.jsx`
- [ ] `DropdownSystem.css` expanded with all `.bd-*` classes
- [ ] `CustomSelect.jsx` is a thin wrapper — zero duplicate logic
- [ ] `AssigneeSelector.jsx` is a thin wrapper — zero duplicate logic
- [ ] `HubSelector.jsx` is a thin wrapper — zero duplicate logic
- [ ] All existing consumers of the three components compile and work unchanged
- [ ] `npm run dev` shows zero errors
- [ ] No console errors when opening/closing any dropdown in the app

---

## Series Execution Guide for AI Models & Interns

Follow this workflow sequentially. Do not skip runbooks.

### Phase 1: Engine & Styling (Runbooks 01 - 02)
1. Open `01_BASE_DROPDOWN_COMPONENT.md` and build the unified engine.
2. Open `02_CSS_EXPANSION.md` and append all new styling rules safely.

### Phase 2: Wrappers (Runbooks 03 - 05)
3. Open `03_CUSTOM_SELECT_WRAPPER.md` and refactor the base single-select.
4. Open `04_ASSIGNEE_SELECTOR_WRAPPER.md` and refactor the multi-select employee picker.
5. Open `05_HUB_SELECTOR_WRAPPER.md` and refactor the multi-select hub picker.

### Phase 3: Verification & Maintenance (Runbook 06)
6. Check `06_CONSUMER_CONFIG_MAP.md` to verify every consumer's capability matching.
