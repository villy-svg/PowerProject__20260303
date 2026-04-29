# Runbook 02: CSS Expansion for BaseDropdown

> **STANDALONE.** Expand `DropdownSystem.css` with new classes required by `BaseDropdown`. No other runbook needs to be complete first, but `01_BASE_DROPDOWN_COMPONENT.md` should be read to understand which classes are needed.

---

## Mission

Add new `.bd-*` CSS classes to `src/styles/DropdownSystem.css`. All new rules must be appended **after the last existing rule** in the file. Do NOT modify or delete any existing rules.

---

## Target File

```
src/styles/DropdownSystem.css
```

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\styles\DropdownSystem.css`

Read the file first. Note the last line number. All additions go after it.

> **Current last line as of this writing:** Line 203. All new CSS must be appended after line 203.

---

## Existing Classes to Reuse (Do NOT duplicate)

These classes already exist and `BaseDropdown` uses them directly:

| Existing Class | Used For |
|:---|:---|
| `.custom-select-container` | Root container (bd-container is an alias) |
| `.custom-select-trigger` | Trigger button base |
| `.custom-select-search-wrapper` | Search input row |
| `.custom-select-search-input` | Search text input |
| `.custom-select-clear-btn` | Search clear × |
| `.custom-dropdown-menu` | Dropdown panel |
| `.custom-dropdown-option` | Option row |
| `.custom-dropdown-option.selected` | Selected option highlight |
| `.custom-dropdown-option.single` | Switches checkbox to circle |
| `.custom-dropdown-checkbox` | Checkbox/radio indicator box |
| `.radio-dot` | Dot inside single-mode checkbox |
| `.custom-dropdown-text` | Option label text |
| `.selector-backdrop` | Click-outside dismiss overlay |
| `.fade-in` | Dropdown open animation |
| `.load-others-btn` | Expander button (limitToIds) |

> **Critical:** `.selector-backdrop` is defined in `AssigneeSelector.css` and `HubSelector.css` — **NOT** in `DropdownSystem.css`. Do NOT add `.selector-backdrop` to `DropdownSystem.css`.
>
> **Critical:** `.load-others-btn` is defined in `AssigneeSelector.css`. Do NOT duplicate it here.

---

## New Classes to Add

Append each section below in order. Include the section comment headers.

---

### Section A: Trigger Action Area

The right side of the trigger button holds both the clear button and the arrow. They need to sit together without fighting the label for space.

```css
/* ── BaseDropdown: Trigger Action Area ── */
.bd-trigger-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: auto;
}

.bd-trigger:hover .dropdown-arrow {
  transform: translateY(1px);
  color: var(--brand-green);
  opacity: 1;
}
```

---

### Section B: Clear Button (inside trigger)

The `×` that clears all selections. Must not look like the search-clear button — it lives inside the trigger, not the search input.

```css
/* ── BaseDropdown: Clear Button ── */
.bd-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  line-height: 1;
}

.bd-clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  transform: scale(1.1) rotate(90deg);
}
```

---

### Section C: Option Content (label + sublabel)

Wraps the text content of a default option row so the label and sublabel stack vertically.

```css
/* ── BaseDropdown: Option Content ── */
.bd-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;  /* allows text-overflow to work */
}

.bd-option-sublabel {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

---

### Section D: At-Max Option State

When `maxSelect` is reached, unselected options are visually disabled.

```css
/* ── BaseDropdown: At-Max Option State ── */
.bd-option.at-max {
  opacity: 0.3;
  cursor: not-allowed;
  filter: grayscale(1) blur(0.5px);
  pointer-events: none;
}
```

---

### Section E: Keyboard Focused Option

When `keyboardNav` is active, the `focused` class highlights the currently arrowed-to option.

```css
/* ── BaseDropdown: Keyboard Focused Option ── */
.bd-option.focused {
  background: rgba(var(--brand-green-rgb, 0, 180, 160), 0.05);
  border-left: 3px solid var(--brand-green);
  outline: none;
  padding-left: 13px; /* 16px - 3px for consistency */
}
```

---

### Section F: Select All Button

The "Select All / Deselect All" toggle that appears at the top of the dropdown list.

```css
/* ── BaseDropdown: Select All Button ── */
.bd-select-all-btn {
  width: calc(100% - 16px);
  margin: 8px;
  padding: 8px 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: var(--brand-green);
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bd-select-all-btn:hover {
  background: rgba(var(--brand-green-rgb, 0, 180, 160), 0.1);
  border-color: rgba(var(--brand-green-rgb, 0, 180, 160), 0.2);
  box-shadow: 0 0 12px rgba(var(--brand-green-rgb, 0, 180, 160), 0.15);
}
```

---

### Section G: Option Groups

For `groupBy` functionality. Group headers are non-interactive label rows.

```css
/* ── BaseDropdown: Option Groups ── */
.bd-option-group {
  display: flex;
  flex-direction: column;
}

.bd-option-group-header {
  padding: 8px 16px 4px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.6;
  cursor: default;
  user-select: none;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.bd-option-group:first-child .bd-option-group-header {
  border-top: none;
}
```

---

### Section H: Pills Display Mode

When `displayMode='pills'`, the trigger shows tags instead of a compact label. Pills must wrap if there are many, and have a remove button.

```css
/* ── BaseDropdown: Pills Display Mode ── */
.bd-pills-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 32px);
  padding: 4px 0;
}

.bd-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 12px;
  border-radius: 100px;
  background: rgba(var(--brand-green-rgb, 0, 180, 160), 0.08);
  border: 1px solid rgba(var(--brand-green-rgb, 0, 180, 160), 0.25);
  color: var(--brand-green);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.bd-pill:hover {
  background: rgba(var(--brand-green-rgb, 0, 180, 160), 0.15);
  border-color: rgba(var(--brand-green-rgb, 0, 180, 160), 0.4);
  box-shadow: 0 2px 8px rgba(var(--brand-green-rgb, 0, 180, 160), 0.1);
}

.bd-pill-remove {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  color: var(--brand-green);
  opacity: 0.7;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.bd-pill-remove:hover {
  opacity: 1;
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}
```

---

### Section I: Empty State Slot

When a custom `emptyState` JSX is passed.

```css
/* ── BaseDropdown: Custom Empty State ── */
.bd-empty-state {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.85rem;
  font-style: italic;
  opacity: 0.7;
}
```

---

### Section J: Footer Slot

For `footerSlot` JSX rendered at the bottom of the dropdown panel.

```css
/* ── BaseDropdown: Footer Slot ── */
.bd-footer-slot {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
}
```

---

### Section K: Loading Trigger State

When `loading={true}`, the trigger shows a pulsing opacity animation.

```css
/* ── BaseDropdown: Loading State ── */
.bd-trigger.loading {
  animation: bd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes bd-pulse {
  0%, 100% { opacity: 1; filter: brightness(1); }
  50% { opacity: 0.6; filter: brightness(0.8); }
}
```

---

## Step-by-Step Implementation Guide for Interns

Follow these foolproof steps to safely append CSS to `DropdownSystem.css`:

### Step 1: Locate the `styles` folder
Navigate to the `src` folder, then open the `styles` folder inside it.

### Step 2: Open `DropdownSystem.css`
Double-click to open `src/styles/DropdownSystem.css`.

### Step 3: Paste New Classes At the Bottom
Scroll to the absolute bottom of the file. Paste all of the classes from Sections A through K directly. Do not delete anything that was already in the file!

---

## Verification

After appending:

1. Search the file for any duplicate class names — there should be none.
2. Confirm no existing rules were modified (check first line numbers match original).
3. All color references use CSS variables (`var(--brand-green)`, `var(--text-secondary)`) — no hardcoded hex.
4. `npm run dev` compiles with zero errors.
5. Confirm `.selector-backdrop` was NOT added (it stays in `AssigneeSelector.css` and `HubSelector.css`).
6. Confirm `.load-others-btn` was NOT added (it already exists in `AssigneeSelector.css`).

> **Known pre-existing issue:** `HubSelector.css` contains the line `@extend .custom-dropdown-menu;` inside `.hub-dropdown-menu`. This is SCSS syntax and is invalid in plain CSS — browsers silently ignore it. Do NOT fix this as part of this runbook. It is tracked as a known cosmetic issue.

---

## Handoff

Proceed to `03_CUSTOM_SELECT_WRAPPER.md`.
