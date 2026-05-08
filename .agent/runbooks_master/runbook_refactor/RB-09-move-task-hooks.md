# RB-09 — Colocate Task-Feature Hooks

**Risk Level**: 🟡 Low | **Depends On**: RB-08 complete | **Est. Time**: 1 hour

> ⛔ **BACKEND SAFETY**: This runbook moves hooks to a new directory. No service files,
> Supabase schema, or database queries are touched.

> ⚠️ **PATH RISK**: The import path update examples in Step 2 are APPROXIMATE — based
> on common patterns. Before updating any path, ALWAYS read the actual import block in
> the file being copied. Do not copy-paste the example import lines blindly.

---

## Problem

Five hooks live in the global `src/hooks/` directory but are ONLY used by the
task-board feature (TaskController and its sub-components). This violates the
colocation principle: if you delete the task board feature, you'd need to hunt
through the global hooks folder to clean up.

Hooks to move:
- `useTaskController.js` — orchestrator for the task board
- `useTaskFilters.js` — task filtering logic
- `useTaskSelection.js` — checkbox selection state
- `useTaskPermissions.js` — per-task RBAC checks
- `useTaskViewActions.js` — action handlers for task tiles

---

## Objective

Move the above 5 hooks to `src/features/task-board/hooks/`.
Update all import paths that reference the old locations.

---

## Pre-Flight Checks

Confirm these files exist:
```
src/hooks/useTaskController.js   ✓
src/hooks/useTaskFilters.js      ✓
src/hooks/useTaskSelection.js    ✓
src/hooks/useTaskPermissions.js  ✓
src/hooks/useTaskViewActions.js  ✓
```

Find all consumers of each hook (RECORD THE OUTPUT — you will update every file listed):
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskController" | Select-Object Filename
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskFilters" | Select-Object Filename
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskSelection" | Select-Object Filename
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskPermissions" | Select-Object Filename
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskViewActions" | Select-Object Filename
```

---

## Step 1 — Create target directory

```powershell
mkdir src/features
mkdir src/features/task-board
mkdir src/features/task-board/hooks
```

---

## Step 2 — Move hooks (copy → verify → delete old)

**PROCESS FOR EACH HOOK**:
1. Copy file to new location
2. Update all internal relative imports in the copied file
3. Update all external consumers to use the new path
4. Delete the old file

### Hook 1: `useTaskController.js`

Copy `src/hooks/useTaskController.js` → `src/features/task-board/hooks/useTaskController.js`

**MANDATORY FIRST: Read the actual import block in the original file:**
```powershell
Get-ChildItem "src/hooks" -Filter "useTaskController.js" | Select-String -Pattern "^import"
```

Then update every `../` import to `../../../` (because the new file is 3 levels deep:
`src/features/task-board/hooks/` relative to `src/`).

Example translation pattern (verify against actual file output above):
```js
// OLD paths (relative to src/hooks/):
// import { FOO } from '../constants/...';
// import { BAR } from '../utils/...';
// import { BAZ } from '../services/...';
//
// NEW paths (relative to src/features/task-board/hooks/):
// import { FOO } from '../../../constants/...';
// import { BAR } from '../../../utils/...';
// import { BAZ } from '../../../services/...';
//
// Sibling hooks remain relative:
// import { useTaskFilters } from './useTaskFilters';  (no change needed)
```

**Update external consumers** (files that import useTaskController):
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "useTaskController" | Select-Object Filename
# Typically: src/components/TaskController.jsx
```

In each consumer file found, update:
```js
// OLD:
import { useTaskController } from '../hooks/useTaskController';
// NEW:
import { useTaskController } from '../features/task-board/hooks/useTaskController';
```

### Hook 2: `useTaskFilters.js`

Copy `src/hooks/useTaskFilters.js` → `src/features/task-board/hooks/useTaskFilters.js`

**Update internal imports**:
```js
// OLD paths (relative to src/hooks/):
import { STAGE_LIST } from '../constants/stages';
import { taskUtils } from '../utils/taskUtils';

// NEW paths (relative to src/features/task-board/hooks/):
import { STAGE_LIST } from '../../../constants/stages';
import { taskUtils } from '../../../utils/taskUtils';
```

Check for `useDuplicateDetection` import — if present:
```js
// OLD:
import { useDuplicateDetection } from './useDuplicateDetection';
// NEW: useDuplicateDetection stays in src/hooks/ (it's not task-board-exclusive)
import { useDuplicateDetection } from '../../../hooks/useDuplicateDetection';
```

**External consumers**: Already updated via `useTaskController.js` (it imports useTaskFilters).
Verify no other consumer:
```powershell
Select-String -Recurse -Path "src" -Pattern "useTaskFilters"
# Should only appear in: useTaskController.js (new location)
```

### Hook 3: `useTaskSelection.js`

Copy `src/hooks/useTaskSelection.js` → `src/features/task-board/hooks/useTaskSelection.js`

**Update internal imports** (likely has no imports or only constants):
```powershell
Select-String "src/hooks/useTaskSelection.js" -Pattern "^import"
# Check what it imports and update paths with ../../../ prefix
```

**External consumers**:
```powershell
Select-String -Recurse -Path "src" -Pattern "useTaskSelection"
# Should only be: useTaskController.js (new location)
```

### Hook 4: `useTaskPermissions.js`

Copy `src/hooks/useTaskPermissions.js` → `src/features/task-board/hooks/useTaskPermissions.js`

**Update internal imports**:
```powershell
Select-String "src/hooks/useTaskPermissions.js" -Pattern "^import"
# Likely imports from constants/ and utils/ — add ../../../ prefix
```

Example updates needed:
```js
// OLD:
import { taskUtils } from '../utils/taskUtils';
// NEW:
import { taskUtils } from '../../../utils/taskUtils';
```

**External consumers**:
```powershell
Select-String -Recurse -Path "src" -Pattern "useTaskPermissions"
# Should only be: useTaskController.js (new location)
```

### Hook 5: `useTaskViewActions.js`

Copy `src/hooks/useTaskViewActions.js` → `src/features/task-board/hooks/useTaskViewActions.js`

**Update internal imports**:
```powershell
Select-String "src/hooks/useTaskViewActions.js" -Pattern "^import"
# Check and update with ../../../ prefix
```

**External consumers**:
```powershell
Select-String -Recurse -Path "src" -Pattern "useTaskViewActions"
# Should appear in: src/components/TaskListView.jsx (or ListViewRow.jsx after RB-06)
#                   src/components/TaskKanbanView.jsx
#                   src/components/TaskTreeView.jsx
```

Update each consumer:
```js
// In TaskListView.jsx / ListViewRow.jsx / TaskKanbanView.jsx / TaskTreeView.jsx:
// OLD:
import { useTaskViewActions } from '../hooks/useTaskViewActions';
// NEW:
import { useTaskViewActions } from '../features/task-board/hooks/useTaskViewActions';
```

---

## Step 3 — Delete old hook files

Only delete AFTER confirming the build passes and all consumers have been updated.

```powershell
Remove-Item src/hooks/useTaskController.js
Remove-Item src/hooks/useTaskFilters.js
Remove-Item src/hooks/useTaskSelection.js
Remove-Item src/hooks/useTaskPermissions.js
Remove-Item src/hooks/useTaskViewActions.js
```

**CAUTION**: Run `npm run build:staging` BEFORE this step and AFTER. If the build
passes before deletion but fails after, one of the old files was still being
imported somewhere.

---

## Step 4 — Create re-export shims in old location (RECOMMENDED APPROACH)

Instead of deleting the old hook files immediately, create shim re-exports first.
This allows you to verify the build with the new files in place before removing the old ones.

Replace the CONTENTS of each old hook file with a re-export shim:

```js
// src/hooks/useTaskController.js (shim)
export { useTaskController } from '../features/task-board/hooks/useTaskController';
```

```js
// src/hooks/useTaskFilters.js (shim)
export { useTaskFilters } from '../features/task-board/hooks/useTaskFilters';
```

```js
// src/hooks/useTaskSelection.js (shim)
export { useTaskSelection } from '../features/task-board/hooks/useTaskSelection';
```

```js
// src/hooks/useTaskPermissions.js (shim)
export { useTaskPermissions } from '../features/task-board/hooks/useTaskPermissions';
```

```js
// src/hooks/useTaskViewActions.js (shim)
export { useTaskViewActions } from '../features/task-board/hooks/useTaskViewActions';
```

Run `npm run build:staging`. If the build passes with the shims, then delete the
shim files. The shims guarantee zero consumer breakage during the transition.

Only delete the shim files AFTER a second successful build without them:
```powershell
Remove-Item src/hooks/useTaskController.js
Remove-Item src/hooks/useTaskFilters.js
Remove-Item src/hooks/useTaskSelection.js
Remove-Item src/hooks/useTaskPermissions.js
Remove-Item src/hooks/useTaskViewActions.js
```

---

## Step 5 — Verify hooks directory is clean

The following hooks MUST remain in `src/hooks/` (they are genuinely global):
```
useAssignees.js          ← used by task forms across multiple verticals
useClients.js            ← used by client forms
useEmployees.js          ← used by employee forms
useRBAC.js               ← used by App.jsx
useTasks.js              ← used by TaskBoardContext
useDailyTasks.js         ← used by TaskBoardContext
useDuplicateDetection.js ← used by task filters
useIsMobile.js           ← used by multiple layout components
useOTAUpdate.js          ← used by App.jsx
useScrollDirection.js    ← used by MasterPageHeader
useManagementUI.js       ← used by management pages
useHierarchyDnd.js       ← used by task list and tree views
useTaskForm.js           ← check if it belongs in features/ too
```

Check `useTaskForm.js`:
```powershell
Select-String -Recurse -Path "src" -Pattern "useTaskForm"
```
If only used by task form components inside ChargingHubs, move it to the feature folder.

---

## Step 6 — Verification

### 6a. Grep confirms no dead imports
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from '.*hooks/useTaskController'"
# Should return ZERO results

Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from '.*hooks/useTaskFilters'"
# Should return ZERO results

Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from '.*hooks/useTaskPermissions'"
# Should return ZERO results

Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from '.*hooks/useTaskSelection'"
# Should return ZERO results

Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "from '.*hooks/useTaskViewActions'"
# Should return ZERO results
```

### 6b. Build
```powershell
npm run build:staging
```

### 6c. Smoke tests
1. Hub Task Board → List view → task rows render with all action buttons ✓
2. Select tasks → bulk action bar appears ✓
3. Stage navigation arrows work ✓
4. Edit modal opens and saves ✓
5. Kanban view → cards render with action buttons ✓
6. Tree view → hierarchy renders correctly ✓

---

## Rollback

```powershell
# Restore hook files from git
git checkout src/hooks/useTaskController.js src/hooks/useTaskFilters.js
git checkout src/hooks/useTaskSelection.js src/hooks/useTaskPermissions.js
git checkout src/hooks/useTaskViewActions.js
# Restore consumers
git checkout src/components/TaskController.jsx src/components/TaskListView.jsx
git checkout src/components/TaskKanbanView.jsx src/components/TaskTreeView.jsx
# Delete new directory
Remove-Item -Recurse src/features/task-board/hooks
```

## Commit Checkpoint

After the build succeeds and all smoke tests pass:
```powershell
git add -A
git commit -m "refactor: RB-09 colocate task-board hooks"
```
