# RB-06 — Extract `ListViewRow` from `TaskListView.jsx`

**Risk Level**: 🟡 Low | **Depends On**: RB-01 complete | **Est. Time**: 45 minutes

> ⛔ **BACKEND SAFETY**: Pure frontend component split. No service files touched.

---

## Problem

`src/components/TaskListView.jsx` is 540 lines containing TWO distinct components:
1. `ListViewRow` (lines 23–354) — renders a single row in the list view
2. `TaskListView` (lines 356–539) — orchestrates stage sections and row mapping

These are currently in one file, making both hard to find, test, and modify independently.
When `ListViewRow` changes, the entire `TaskListView` file is dirty in git.

---

## Objective

Move `ListViewRow` to its own file: `src/components/ListViewRow.jsx`.
`TaskListView.jsx` imports it. All behaviour is preserved exactly.

---

## Pre-Flight Checks

```powershell
(Get-Item "src/components/TaskListView.jsx").Length
# Should be ~21,000 bytes (539 lines)
```

```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx" | Select-String -Pattern "ListViewRow" | Select-Object Filename
# Should only appear in TaskListView.jsx (it is not exported currently)
```

---

## Step 1 — Find the `ListViewRow` function boundaries

Open `src/components/TaskListView.jsx`. Search for the function signature:

```
const ListViewRow = ({
```

This marks the START of the component. The component ends at the first `};` that is
at the top indentation level (column 0) AFTER the opening `const ListViewRow`.

> ⚠️ **DO NOT rely on the line numbers in this runbook.** Line numbers change as
> the file is edited. Always use the function signature as your anchor.

The function signature is:
```jsx
const ListViewRow = ({
  task, stage, stageList, canUpdate, canEditTask, canManageHierarchy, canDelete,
  deleteTask, updateTaskStage, openEditModal, onCloneTask, openAddSubtaskModal,
  openSubmissionModal, onMoveToParent, TaskTileComponent, selectedTaskIds, onSelect,
  onDuplicateMerge, currentUser, canCreate, canAddSubtask, canCloneTask,
  isExpanded, onToggleExpand, hasChildren, tasks, permissions, handleApproveSubmission,
  handleRejectClick, isRowExpanded, onToggleRowExpand
}) => {
```

It ends with the matching `};` at the zero-indent level.

---

## Step 2 — Identify all imports ListViewRow uses

Scan the imports at the top of `TaskListView.jsx`. `ListViewRow` uses these:
```js
import {
  IconEdit, IconDelete, IconUpload, IconPlus, IconArrowLeft, IconArrowRight,
  IconPromote, IconDiagonalUp, IconChevronDown, IconChevronRight, IconCopy
} from './Icons';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { useTaskViewActions } from '../hooks/useTaskViewActions';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';
import AssigneeBadge from './AssigneeBadge';
```

`TaskListView` (the parent component) also uses:
```js
import { hierarchyUtils } from '../utils/hierarchyUtils';
```
This one is NOT needed in ListViewRow — only in TaskListView.

---

## Step 3 — Create `src/components/ListViewRow.jsx`

Create a NEW file with this content:

```jsx
/**
 * ListViewRow.jsx
 * Renders a single row in the Task List View, including:
 * - Priority badge, assignee badge, custom vertical tile
 * - Hierarchy progress badges (direct + recursive)
 * - Stage navigation arrows (left/right)
 * - Action buttons: submit proof, edit, clone, deprio, delete, promote
 * - Hierarchy DnD (drag a task onto another to make it a child)
 *
 * Extracted from TaskListView.jsx for single-responsibility.
 * Canonical location: src/components/ListViewRow.jsx
 */
import React from 'react';
import {
  IconEdit,
  IconDelete,
  IconUpload,
  IconPlus,
  IconArrowLeft,
  IconArrowRight,
  IconPromote,
  IconDiagonalUp,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
} from './Icons';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { useTaskViewActions } from '../hooks/useTaskViewActions';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';
import AssigneeBadge from './AssigneeBadge';
```

After the imports, paste the COMPLETE `ListViewRow` function body verbatim from
`src/components/TaskListView.jsx`. Use the function signature identified in Step 1
as the start marker. Copy everything from `const ListViewRow = ({` to the matching
`};` at zero indentation.

End the file with:
```jsx
export default ListViewRow;
```

**CRITICAL**: Do NOT modify any logic inside the function. Copy it character-for-character.

---

## Step 4 — Update `src/components/TaskListView.jsx`

### 4a. Add the import for the extracted component
At the TOP of `TaskListView.jsx`, add:
```js
import ListViewRow from './ListViewRow';
```

### 4b. Remove the ListViewRow function body
Delete the entire `ListViewRow` function from `TaskListView.jsx`.
Use the function signature `const ListViewRow = ({` as the start.
Use the matching `};` at zero indentation as the end.
Do NOT delete the `const TaskListView` function that follows it.

### 4c. Verify the remaining imports are still needed
After removing `ListViewRow`, some imports may no longer be needed in `TaskListView.jsx`.

Check each import:
```
IconEdit, IconDelete, etc.   → REMOVE (now in ListViewRow.jsx)
useHierarchyDnd              → REMOVE (now in ListViewRow.jsx)
useTaskViewActions           → REMOVE (now in ListViewRow.jsx)
hierarchyService             → REMOVE (now in ListViewRow.jsx)
taskUtils                    → REMOVE (now in ListViewRow.jsx)
AssigneeBadge                → REMOVE (now in ListViewRow.jsx)
hierarchyUtils               → KEEP (still used in TaskListView for sortByHierarchy)
```

**REMOVE** from `TaskListView.jsx`:
```js
import { IconEdit, IconDelete, IconUpload, IconPlus, IconArrowLeft, IconArrowRight,
         IconPromote, IconDiagonalUp, IconChevronDown, IconChevronRight, IconCopy } from './Icons';
import { useHierarchyDnd } from '../hooks/useHierarchyDnd';
import { useTaskViewActions } from '../hooks/useTaskViewActions';
import { hierarchyService } from '../services/rules/hierarchyService';
import { taskUtils } from '../utils/taskUtils';
import AssigneeBadge from './AssigneeBadge';
```

**KEEP** in `TaskListView.jsx`:
```js
import React from 'react';
import { hierarchyUtils } from '../utils/hierarchyUtils';
import ListViewRow from './ListViewRow';
import './TaskListView.css';
```

---

## Step 5 — Verify the TaskListView.jsx `<ListViewRow>` usage

The `TaskListView` component renders `<ListViewRow ...>` inside a `.map()`.
Confirm this usage is still present and unchanged after the extraction:

```jsx
{stageTasks.filter(t => { ... }).map((task) => (
  <ListViewRow
    key={task.id}
    task={task}
    stage={stage}
    stageList={stageList}
    // ... all props unchanged
  />
))}
```

The props passed to `<ListViewRow>` must match exactly the props in `ListViewRow.jsx`'s
destructured parameter list. Count them — there should be ~26 props.

---

## Step 6 — CSS check

`ListViewRow` uses these CSS classes:
```
list-task-row, selected, is-expanded, context-only, drop-target
list-row-main, list-row-selection, selection-checkbox
list-row-badges, list-row-vertical-meta, list-hierarchy-badges
subtask-progress-badge, recursive-progress-badge
list-row-content, rejected-red-dot, review-yellow-dot
list-row-controls, list-nav-group, list-action-group
card-priority, duplicate-badge-mini, card-nav-button
card-add-sub-button, card-submit-proof-button, card-edit-button
card-clone-button, card-reprio-button, card-deprio-button
card-delete-button, promote-button, hierarchy-nav-group
```

All these classes are defined in `src/components/TaskListView.css`.
`ListViewRow.jsx` does NOT import `TaskListView.css` directly —  it relies on the parent
`TaskListView.jsx` having already imported the CSS.

**VERIFY**: `TaskListView.jsx` still has: `import './TaskListView.css';` — it should.
**DO NOT** remove this import from `TaskListView.jsx`.

---

## Step 7 — Verification

### 7a. Line count check
```powershell
(Get-Content "src/components/TaskListView.jsx").Count
# Should be approximately 540 - 332 = ~210 lines

(Get-Content "src/components/ListViewRow.jsx").Count
# Should be approximately 332 + imports = ~360 lines
```

### 7b. Build
```powershell
npm run build:staging
```

### 7c. Smoke tests
1. Open Hub Task Board → switch to **List view**
2. Tasks render in stage sections ✓
3. Click the left/right stage arrows → task moves stages ✓
4. Click Edit button → edit modal opens ✓
5. Click Clone button (if visible) → clone modal opens ✓
6. Click Delete button → confirmation appears ✓
7. Click Submit Proof button → submission modal opens ✓
8. Expand/collapse task children → tree expander works ✓
9. Click task row → row expands (compact detail) ✓
10. Select checkbox → bulk action bar appears ✓

---

## Common Pitfalls

### Pitfall 1: CSS classes not rendering
**Symptom**: List view renders but all styling is wrong (no colors, wrong layout).
**Cause**: `ListViewRow.jsx` was importing `TaskListView.css` but then the import was
removed during cleanup.
**Fix**: `ListViewRow.jsx` should NOT import `TaskListView.css`. The CSS is imported
by `TaskListView.jsx` which renders the parent. As long as `TaskListView.jsx` has
`import './TaskListView.css'`, ListViewRow styles will work.

### Pitfall 2: `hierarchyService` not found in ListViewRow
**Symptom**: Build error: `Cannot find module '../services/rules/hierarchyService'`.
**Cause**: `hierarchyService` import path in `ListViewRow.jsx` is wrong.
**Fix**: The path from `src/components/ListViewRow.jsx` to the service is:
`'../services/rules/hierarchyService'` — exactly the same as in the original file.

### Pitfall 3: `useTaskViewActions` hook not working
**Symptom**: Edit/delete/clone buttons don't fire correctly.
**Cause**: `useTaskViewActions` hook is imported in `ListViewRow.jsx` but the hook
file moved during RB-09.
**Fix**: If doing this runbook BEFORE RB-09, use the original hook path:
`'../hooks/useTaskViewActions'`. If AFTER RB-09, update to the new colocated path.

---

## Rollback

```powershell
# Restore TaskListView.jsx from git
git checkout src/components/TaskListView.jsx
# Delete the new file
Remove-Item src/components/ListViewRow.jsx
```

## Commit Checkpoint

After the build succeeds and list view smoke tests pass:
```powershell
git add -A
git commit -m "refactor: RB-06 extract ListViewRow component"
```
