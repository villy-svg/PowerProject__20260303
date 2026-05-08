# RB-10 — Remove Inline Styles from App.jsx

**Risk Level**: 🟢 Minimal | **Depends On**: RB-09 complete | **Est. Time**: 30 minutes

> ⛔ **BACKEND SAFETY**: CSS-only changes. No service files, hooks, or Supabase
> queries are touched.

> NOTE: If you completed RB-07 which already handled inline styles in App.jsx,
> this runbook extends that work to OTHER files that still have inline styles
> violating the design system. Verify what was done in RB-07 first.

---

## Problem

Inline styles violate the design system by:
1. Hardcoding values that should come from CSS variables
2. Making sweeping design updates impossible (no single change point)
3. Polluting JSX with presentation concerns

Scan results showing inline style violations:
- `src/App.jsx` — loading screen, profile error, impersonation header
- `src/components/TaskListView.jsx` — `style={{ background: 'none', border: 'none', color: ... }}`
- `src/components/TaskCard.jsx` — `style={{ '--stage-color': ... }}` (CSS variable injection — acceptable)
- `src/components/Sidebar.jsx` — `style={{ display: 'flex', justifyContent: 'space-between'... }}`

---

## Objective

Remove all hardcoded hex colors and non-CSS-variable inline styles.
Replace with CSS classes. CSS variable injection via `style={{ '--var': value }}` is ACCEPTABLE.

---

## Step 1 — Audit all inline styles

Run this to find all files with inline styles:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx" | Select-String -Pattern 'style=\{\{' | Select-Object Filename, LineNumber, Line | Format-Table -AutoSize
```

---

## Step 2 — Fix `src/App.jsx`

**Only do this if RB-07 did NOT already address these. Check first:**
```powershell
Get-ChildItem "src" -Filter "App.jsx" | Select-String -Pattern 'style=\{\{'
```

If any remain, fix each:

### Inline A: `#ff4444` hardcoded color
FIND: `style={{ color: '#ff4444' }}`
REPLACE: `className="error-heading"`

Add to `src/App.css`:
```css
.error-heading { color: var(--status-danger); }
```

### Inline B: Loading screen layout
FIND: `style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center', height: '100vh' }}`
REPLACE: `className="loading-screen-layout"`

Add to `src/App.css`:
```css
.loading-screen-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
  align-items: center;
  height: 100vh;
}
```

### Inline C: Profile error button
FIND: `style={{ marginTop: '1rem', padding: '10px 20px', backgroundColor: 'var(--brand-green)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}`
REPLACE: `className="halo-button"`

The `halo-button` class in `src/styles/systems/systemButtons.css` already handles
background, border, border-radius, cursor. The `marginTop` can be added:
```css
/* In App.css */
.loading-screen-layout .halo-button { margin-top: 1rem; }
```

---

## Step 3 — Fix `src/components/Sidebar.jsx`

Open the file and find:
```jsx
style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
```
This is on the `<li>` element for each vertical.

REPLACE:
```jsx
className="nav-parent-item"  // (likely already there)
```

Check if `.nav-parent-item` already has flex styles in `Sidebar.css`:
```powershell
Get-ChildItem "src/components" -Filter "Sidebar.css" | Select-String -Pattern "nav-parent-item"
```

If not present, add to `src/components/Sidebar.css`:
```css
.nav-parent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

---

## Step 4 — Fix `src/components/TaskListView.jsx`

Find in the stage header section:
```jsx
<div className="header-left-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
```

REPLACE: `className="header-left-group"` and add to `src/components/TaskListView.css`:
```css
.header-left-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

Find the "Select All" button inline styles:
```jsx
style={{
  background: 'none', border: 'none', color: 'var(--brand-green)',
  fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer',
  padding: '0 8px', height: '100%', opacity: 0.8
}}
```

REPLACE: `className="stage-select-all-btn"`

Add to `src/components/TaskListView.css`:
```css
.stage-select-all-btn {
  background: none;
  border: none;
  color: var(--brand-green);
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0 8px;
  height: 100%;
  opacity: 0.8;
}
```

Find hierarchy badge inline styles in `ListViewRow` (now in `ListViewRow.jsx` after RB-06):
```powershell
Get-ChildItem "src/components" -Filter "ListViewRow.jsx" | Select-String -Pattern 'style=\{\{'
```

Fix each occurrence using the same pattern above.

---

## Step 5 — Fix `src/components/TaskController.jsx`

Find:
```jsx
style={{ fontWeight: viewMode === mode ? 600 : 400, textTransform: 'capitalize' }}
```
This is on view-mode toggle buttons. REPLACE with conditional class:
```jsx
className={`view-toggle-btn ${viewMode === mode ? 'active' : ''}`}
// Remove the style attribute
```

Add to `src/components/TaskController.css`:
```css
.view-toggle-btn.active {
  font-weight: 600;
}
.view-toggle-btn {
  text-transform: capitalize;
  font-weight: 400;
}
```

Find:
```jsx
style={{ fontWeight: 600 }}
```
on the "Clear Board" button. REPLACE with class:
```jsx
className="halo-button clear-board-btn"
```

In `TaskController.css`, if `.clear-board-btn` exists, add:
```css
.clear-board-btn { font-weight: 600; }
```

---

## Step 6 — Fix `src/components/TaskListView.jsx` — duplicate badge inline

Find in `ListViewRow` / `TaskListView`:
```jsx
style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontSize: '0.6rem', padding: '1px 4px' }}
```
This is on the "VIEWER" context-only badge. REPLACE:
```jsx
className="context-viewer-badge"
```

Add to `src/components/TaskListView.css`:
```css
.context-viewer-badge {
  background-color: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 0.6rem;
  padding: 1px 4px;
}
```

---

## Step 7 — Fix hierarchy promotion button colors

Find in `ListViewRow`:
```jsx
style={{ color: 'var(--brand-blue)' }}
```
on `promote-button` elements. CSS variable injection is acceptable in style attributes
ONLY when the value must be dynamic. But `--brand-blue` is always the same — move to CSS.

In `TaskListView.css` (or `ListViewRow.css` if you created one):
```css
.promote-button {
  color: var(--brand-blue);
}
.card-reprio-button {
  color: var(--brand-green);
}
```

Remove the `style={{ color: ... }}` from each button.

---

## Step 8 — What IS acceptable as inline style

The following patterns are **acceptable** to keep as inline styles:
```jsx
// CSS variable injection for dynamic theming — KEEP:
style={{ '--stage-color': stage.color }}
style={{ backgroundColor: `${stage.color}22` }}  // alpha hex — also acceptable
style={{ paddingLeft: task.depth ? `${task.depth * 24}px` : undefined }}  // computed value — KEEP
style={{ opacity: task.isContextOnly ? 0.7 : 1 }}  // ternary state — KEEP
```

**NOT acceptable** (must use CSS class):
```jsx
style={{ color: '#ff4444' }}          // hardcoded hex
style={{ display: 'flex' }}           // static layout property
style={{ fontWeight: 600 }}           // static typography
style={{ marginTop: '1rem' }}         // static spacing
```

---

## Step 9 — Final audit grep

After all fixes:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx" | Select-String -Pattern 'style=\{\{' |
  Where-Object { $_.Line -notmatch "'--" } |
  Where-Object { $_.Line -notmatch "color\}22" } |
  Where-Object { $_.Line -notmatch "depth \*" } |
  Where-Object { $_.Line -notmatch "opacity:.*\?" }
# Remaining results should be reviewed one-by-one
```

---

## Step 10 — Build + verify

```powershell
npm run build:staging
```

Visual check: Open the app and verify:
- Loading screen still centered correctly ✓
- Profile error screen shows red heading ✓
- Sidebar vertical items properly spaced ✓
- List view stage headers show correct flex layout ✓
- "Select All" button visible ✓
- View mode toggle buttons show bold when active ✓

## Commit Checkpoint

```powershell
git add -A
git commit -m "refactor: RB-10 remove inline styles"
```
