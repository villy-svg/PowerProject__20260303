# RB-11 — Split `TaskController.css`

**Risk Level**: 🟡 Low | **Depends On**: RB-10 complete | **Est. Time**: 1 hour

> ⛔ **BACKEND SAFETY**: CSS split only. No JS logic, service files, or Supabase
> queries are touched.

---

## Problem

`src/components/TaskController.css` is ~15KB and contains styles for 4 separate concerns:
1. `.task-controller`, `.workspace-main-view` — TaskController layout
2. `.bulk-action-bar`, `.bulk-action-btn` — BulkActionBar component
3. `.list-stage-header`, `.task-count-badge` — some list-view styles
4. `.kanban-*` prefixed rules — some kanban styles
5. `.menu-backdrop` — overlay for menu state

Each component should own its CSS. When `BulkActionBar.jsx` changes, only
`BulkActionBar.css` should be dirty in git — not `TaskController.css`.

---

## Pre-Flight Checks

```powershell
(Get-Item "src/components/TaskController.css").Length
# Should be ~15,000 bytes

# Check what files import TaskController.css:
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js","*.css" | Select-String -Pattern "TaskController.css" | Select-Object Filename
# Should only be: src/components/TaskController.jsx
```

---

## Step 1 — Audit `TaskController.css`

Open `src/components/TaskController.css`. Go through EVERY CSS rule and classify it:

**Belongs in `TaskController.css`** (TaskController-owned layout):
```
.task-controller { ... }
.workspace-main-view { ... }
.menu-backdrop { ... }
.is-blurred { ... }
```

**Belongs in `BulkActionBar.css`** (BulkActionBar-owned):
```
.bulk-action-bar { ... }
.bulk-action-btn { ... }
.bulk-action-divider { ... }
.bulk-count-label { ... }
Any .bulk-* prefixed rules
```

**Belongs in `TaskListView.css`** (list view owned):
```
Any .list-* rules not already in TaskListView.css
```

**Belongs in a new `TaskKanbanView.css`** (kanban owned):
```
Any .kanban-* rules
```

**Rule**: If you're unsure which component uses a class, grep for it:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx" | Select-String -Pattern "className.*CLASSNAME" | Select-Object Filename, Line
```
(Replace `CLASSNAME` with the actual class name you are checking.)

---

## Step 2 — Create `src/components/BulkActionBar.css`

Create a NEW file. Move all bulk-action related CSS blocks from `TaskController.css`:

```css
/**
 * BulkActionBar.css
 * Styles for the floating bulk-action toolbar that appears when tasks are selected.
 * Owned by: src/components/BulkActionBar.jsx
 */

.bulk-action-bar {
  /* Move the existing .bulk-action-bar block from TaskController.css here */
}

/* Move ALL .bulk-* and related rules here */
```

**Process**:
1. Open `TaskController.css`
2. Find the `.bulk-action-bar` block and ALL related `.bulk-*` rules
3. CUT those blocks from `TaskController.css`
4. PASTE into `BulkActionBar.css`

---

## Step 3 — Add CSS import to `BulkActionBar.jsx`

Open `src/components/BulkActionBar.jsx`.
Add at the top:
```js
import './BulkActionBar.css';
```

Remove the `BulkActionBar` styles from `TaskController.css` (already done in Step 2).

---

## Step 4 — Create `src/components/TaskKanbanView.css`

If `TaskController.css` contains `.kanban-*` rules, create this file:

```css
/**
 * TaskKanbanView.css
 * Styles for the Kanban board layout, column headers, and swim lanes.
 * Owned by: src/components/TaskKanbanView.jsx
 */

/* Move all .kanban-* blocks from TaskController.css here */
```

Add to `src/components/TaskKanbanView.jsx`:
```js
import './TaskKanbanView.css';
```

**CHECK**: Open `TaskKanbanView.jsx` and see if it already imports its own CSS:
```powershell
Get-ChildItem "src/components" -Filter "TaskKanbanView.jsx" | Select-String -Pattern "import.*\.css"
```

If it imports `TaskController.css` or no CSS at all, create and import `TaskKanbanView.css`.

---

## Step 5 — Identify and keep TaskController-only rules

After cutting bulk and kanban styles, `TaskController.css` should contain only:

```css
/**
 * TaskController.css
 * Layout styles for the TaskController component wrapper.
 * Only includes styles owned exclusively by TaskController.jsx.
 */

.task-controller {
  /* Main container */
}

.workspace-main-view {
  /* The blurrable main view area */
}

.workspace-main-view.is-blurred {
  /* Applied when header menu or sub-sidebar is open */
}

.menu-backdrop {
  /* Full-screen click target that closes the header menu */
}

/* View mode toggle row */
.view-mode-toggle { ... }
.view-toggle-btn { ... }
.view-toggle-btn.active { ... }

/* Filter group in header */
.header-filter-group { ... }

/* Clear board button */
.clear-board-btn { ... }
```

---

## Step 6 — Migrate any `TaskListView.css` missing rules

Check if `TaskController.css` has `.list-*` rules that belong in `TaskListView.css`:
```powershell
Get-ChildItem "src/components" -Filter "TaskController.css" | Select-String -Pattern "\.list-"
```

For each match:
1. Verify the class is used in `TaskListView.jsx` (not `TaskController.jsx`)
2. Move the CSS block to `src/components/TaskListView.css`

---

## Step 7 — Verify no CSS class is orphaned

After splitting, confirm every class in the new files is referenced in JSX:

```powershell
# Find classes defined in BulkActionBar.css and verify each is used in JSX
$classes = Get-ChildItem "src/components" -Filter "BulkActionBar.css" |
  Select-String -Pattern "^\s*\." |
  ForEach-Object { ($_.Line -split '\s')[0].TrimStart('.').TrimEnd('{').Trim() } |
  Where-Object { $_ -ne '' }

$classes | ForEach-Object {
  $cls = $_
  $found = Get-ChildItem -Recurse "src" -Include "*.jsx" | Select-String -Pattern $cls
  if (-not $found) { Write-Host "ORPHAN: $cls" }
}
```

Run the same for `TaskKanbanView.css` if created.

---

## Step 8 — Check for CSS specificity conflicts

Moving CSS to separate files can cause ordering issues. Vite imports CSS in the order
components are rendered. If `BulkActionBar.css` needs to override a rule from another
file, it might not have enough specificity.

**Test**: Open the app → select tasks → verify the bulk action bar:
- Appears at the correct fixed position ✓
- Has correct background/blur/shadow ✓
- Buttons are correctly styled ✓
- Tray visibility animation works ✓

If any style looks wrong, increase specificity:
```css
/* Instead of: */
.bulk-action-bar { ... }

/* Use: */
.task-controller .bulk-action-bar { ... }
```

---

## Step 9 — File size verification

```powershell
(Get-Item "src/components/TaskController.css").Length
# Should be significantly smaller (target: under 5,000 bytes)

(Get-Item "src/components/BulkActionBar.css").Length
# Should contain the moved bulk styles

Get-Item "src/components/TaskKanbanView.css" -ErrorAction SilentlyContinue
# Should exist if kanban styles were present in TaskController.css
```

---

## Step 10 — Build

```powershell
npm run build:staging
```

### Visual smoke tests
1. Hub Task Board → **Kanban view** → columns and cards render correctly ✓
2. Hub Task Board → **List view** → rows and stage headers render correctly ✓
3. Select 3 tasks → **Bulk action bar** appears at bottom of screen ✓
4. Scroll down → header hides, bulk bar adjusts position ✓
5. Click "Defer" in bulk bar → tasks move to Deprioritized ✓
6. Click "Clear" → bulk selection clears ✓
7. Open header MENU → backdrop appears, workspace blurs ✓

---

## Rollback

```powershell
# Restore TaskController.css
git checkout src/components/TaskController.css

# Remove new files
Remove-Item src/components/BulkActionBar.css -ErrorAction SilentlyContinue
Remove-Item src/components/TaskKanbanView.css -ErrorAction SilentlyContinue

# Remove added imports
git checkout src/components/BulkActionBar.jsx
git checkout src/components/TaskKanbanView.jsx
```

## Commit Checkpoint

```powershell
git add -A
git commit -m "refactor: RB-11 split TaskController.css by component"
```
