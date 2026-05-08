# RB-05 — Split `taskService.js`

**Risk Level**: 🟠 Medium | **Depends On**: RB-01 complete | **Est. Time**: 1.5 hours

> ⚠️ **BACKEND SAFETY NOTE**: This runbook splits a service file into 3 files.
> The Supabase query logic is moved verbatim — no query changes, no column name changes,
> no RLS policy changes. The DB layer is completely untouched.
> Do NOT change any SQL, column names, or table names while doing this split.

---

## Problem

`src/services/tasks/taskService.js` is 785 lines combining 4 unrelated concerns:
1. **Normalizers**: `normalizeTask`, `mapTaskToRow`, `TASK_SELECT` (lines 46–158)
2. **CRUD operations**: `getTasks`, `updateTask`, `deleteTask`, `updateTaskStage`, `bulkUpdateTasks`
3. **Fan-out orchestration**: `addTask` (150 lines with fan-out RPC logic)
4. **Admin fix tool**: `fixAllTasks` (200 lines — entire board repair logic)

---

## Objective

Split into 3 focused files:
- `src/services/tasks/taskNormalizer.js` — pure mapping functions
- `src/services/tasks/taskFixService.js` — `fixAllTasks` standalone function
- Keep `src/services/tasks/taskService.js` — CRUD only (import from the above two)

---

## Pre-Flight Checks

Verify file size:
```powershell
(Get-Item "src/services/tasks/taskService.js").Length
# Should be around 30,000 bytes (785 lines)
```

Confirm consumers of `fixAllTasks`:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "fixAllTasks" | Select-Object Filename
# Should show: taskService.js, FixTasksButton.jsx
```

Confirm consumers of `normalizeTask`:
```powershell
Get-ChildItem -Recurse "src" -Include "*.jsx","*.js" | Select-String -Pattern "normalizeTask" | Select-Object Filename
# Should show: taskService.js, and possibly orchestrationService.js
```

Confirm `task_context_links` table is used in the current codebase:
```powershell
Get-ChildItem -Recurse "src" -Include "*.js" | Select-String -Pattern "task_context_links" | Select-Object Filename
# If this returns results, the table name is confirmed correct.
# If it returns ZERO results, do NOT use task_context_links in taskFixService.js —
# instead, copy the exact table name from wherever it appears in your codebase.
```

---

## Step 1 — Create `src/services/tasks/taskNormalizer.js`

This file contains ONLY pure mapping/normalization functions. No Supabase calls.

```js
/**
 * taskNormalizer.js
 * Pure mapping functions between Supabase DB row shape and the app's camelCase task shape.
 * No side effects. No Supabase imports.
 *
 * Canonical location: src/services/tasks/taskNormalizer.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseTaskBoard — normalizes task_board to always be an array.
 * Handles: array (passthrough), JSON string ('[...]'), scalar string, null.
 */
const parseTaskBoard = (boardData) => {
  if (Array.isArray(boardData)) return boardData;
  if (typeof boardData === 'string' && boardData.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(boardData);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) { /* fall through */ }
  }
  return boardData ? [boardData] : [];
};

// ─────────────────────────────────────────────────────────────────────────────
// PostgREST SELECT string
// Used in every Supabase query that fetches tasks with their joined relations.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TASK_SELECT — The Supabase PostgREST select string for fully-hydrated tasks.
 * Includes: assignees, hubs, clients, employees, submissions, children.
 */
export const TASK_SELECT = `
  *,
  assignees(id, full_name, badge_id, employee_roles(seniority_level)),
  hubs(id, name, hub_code, city),
  clients(id, name),
  employees(id, full_name),
  submissions(id, status, rejection_reason, submission_number, created_at, submitted_by),
  children:tasks!parent_task_id(id)
`;

// ─────────────────────────────────────────────────────────────────────────────
// normalizeTask
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeTask(row)
 * Maps a Supabase DB row (snake_case) to the camelCase shape the app expects.
 * Handles optional joined employee data, multi-hub, multi-assignee, submissions.
 *
 * @param {object} row - Raw Supabase row from tasks table with joins
 * @returns {object} Normalized task in app camelCase shape
 */
export const normalizeTask = (row) => {
  // Submissions: sort by submission_number desc, take latest
  const submissions = Array.isArray(row.submissions) ? row.submissions : [];
  const latestSubmission = submissions.length > 0
    ? [...submissions].sort((a, b) => (b.submission_number || 0) - (a.submission_number || 0))[0]
    : null;

  // Multi-hub data
  const rawHubs = Array.isArray(row.hubs) ? row.hubs : (row.hubs ? [row.hubs] : []);
  const hubData = rawHubs.filter(Boolean);

  // Assignee data (PostgREST returns via 'assignees' computed relationship)
  const rawAssignees = Array.isArray(row.assignees)
    ? row.assignees
    : (row.assignees ? [row.assignees] : []);
  const validAssignees = rawAssignees.filter(Boolean);

  const assigneeNames = validAssignees.map(e => e.full_name).filter(Boolean).join(', ');

  // Flatten nested employee_roles seniority_level for each assignee
  const assigneeMeta = validAssignees.map(e => ({
    ...e,
    seniority_level: e?.employee_roles?.seniority_level || 1,
  }));

  return {
    id: row.id,
    text: row.text,
    verticalId: row.vertical_id,
    stageId: row.stage_id,
    priority: row.priority,
    description: row.description,

    // Hub Relationships
    hub_id: row.hub_id,
    hub_ids: hubData.map(h => h.id).filter(Boolean),
    hubNames: hubData.map(h => h.name).filter(Boolean),
    hubCodes: hubData.map(h => h.hub_code).filter(Boolean),
    hubData: hubData,
    city: row.city,

    function: row.function,

    // Assignee Relationships
    assigned_to: validAssignees.length > 0
      ? validAssignees.map(a => a.id).filter(Boolean)
      : (Array.isArray(row.assigned_to) ? row.assigned_to : (row.assigned_to ? [row.assigned_to] : [])),
    assigneeName: assigneeNames,
    assigneeMeta,

    // Hierarchy
    parentTask: row.parent_task_id || null,
    childCount: row.children?.length || 0,
    isSubTask: !!row.parent_task_id,

    // Meta & Audit
    task_board: parseTaskBoard(row.task_board),
    isDailyTask: parseTaskBoard(row.task_board).includes('Hubs Daily'),

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    lastUpdatedBy: row.last_updated_by,

    // Entity Links
    client_id: Array.isArray(row.clients)
      ? row.clients.map(c => c?.id).filter(Boolean)
      : (row.metadata?.entity_links?.client_id || []),
    employee_id: Array.isArray(row.employees)
      ? row.employees.map(e => e?.id).filter(Boolean)
      : (row.metadata?.entity_links?.employee_id || []),
    partner_id: row.metadata?.entity_links?.partner_id || [],
    vendor_id: row.metadata?.entity_links?.vendor_id || [],

    latestSubmission,
    submissionBy: latestSubmission?.submitted_by || row.metadata?.submission_by,
    metadata: row.metadata || {},
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// mapTaskToRow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * mapTaskToRow(task)
 * Maps the app's camelCase task shape back to Supabase DB column names for inserts/updates.
 *
 * CONTRACT NOTE: tasks.assigned_to is a SCALAR UUID in the DB column.
 * It stores only the primary (first) assignee for legacy compatibility.
 * Multi-assignee relationships live exclusively in task_context_links.
 * Do NOT use tasks.assigned_to for multi-assignee logic.
 *
 * @param {object} task - App camelCase task shape
 * @returns {object} DB snake_case row shape
 */
export const mapTaskToRow = (task) => ({
  text: task.text,
  vertical_id: task.verticalId,
  stage_id: task.stageId,
  priority: task.priority || null,
  description: task.description || null,
  hub_id: task.hub_id === '' ? null : (task.hub_id || null),
  city: task.city || null,
  function: task.function || null,
  assigned_to: Array.isArray(task.assigned_to)
    ? task.assigned_to[0]
    : (task.assigned_to || null),
  parent_task_id: task.parentTask || null,
  last_updated_by: task.lastUpdatedBy || null,
  task_board: task.task_board || [],
  metadata: {
    ...(task.metadata || {}),
    entity_links: {
      client_id: Array.isArray(task.client_id)
        ? task.client_id
        : (task.client_id ? [task.client_id] : []),
      partner_id: Array.isArray(task.partner_id)
        ? task.partner_id
        : (task.partner_id ? [task.partner_id] : []),
      vendor_id: Array.isArray(task.vendor_id)
        ? task.vendor_id
        : (task.vendor_id ? [task.vendor_id] : []),
      employee_id: Array.isArray(task.employee_id)
        ? task.employee_id
        : (task.employee_id ? [task.employee_id] : []),
    },
    submission_by: task.submissionBy || null,
  },
});
```

---

## Step 2 — Create `src/services/tasks/taskFixService.js`

```js
/**
 * taskFixService.js
 * Admin-only tool: scans all tasks and repairs incorrect field values in bulk.
 * Extracted from taskService.js to keep the CRUD service focused.
 *
 * Canonical location: src/services/tasks/taskFixService.js
 * Called by: src/components/FixTasksButton.jsx
 */
import { supabase } from '../core/supabaseClient';

const VALID_VERTICALS = [
  'CHARGING_HUBS', 'CLIENTS', 'EMPLOYEES',
  'PARTNERS', 'VENDORS', 'DATA_MANAGER',
];
const CHUNK_SIZE = 100;

/**
 * fixAllTasks()
 * Scans every task in the DB and fixes:
 *   A. Invalid vertical_id values
 *   B. Missing or malformed task_board arrays
 *   C. Missing city (derived from hub_id)
 *   D. Null stage_id (defaults to 'TODO')
 *   E. Null priority (defaults to 'Medium')
 *   F. Missing hub context links in task_context_links
 *
 * Uses batched upserts to avoid N+1 DB calls.
 * @returns {number} count of fixed records
 */
export async function fixAllTasks() {
  // 1. Fetch ALL tasks (raw, no joins needed)
  const { data: allTasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*');
  if (tasksError) throw tasksError;

  // 2. Fetch ALL hubs for city mapping
  const { data: allHubs, error: hubsError } = await supabase
    .from('hubs')
    .select('id, city');
  if (hubsError) throw hubsError;

  const hubCityMap = (allHubs || []).reduce((acc, hub) => {
    if (hub.id && hub.city) acc[hub.id] = hub.city;
    return acc;
  }, {});

  // 3. Fetch all existing hub context links for dedup
  const { data: existingLinks } = await supabase
    .from('task_context_links')
    .select('source_id, entity_id')
    .eq('source_type', 'task')
    .eq('entity_type', 'hub');

  const linkedSet = new Set(
    (existingLinks || []).map(l => `${l.source_id}::${l.entity_id}`)
  );

  // 4. Collect patches
  const taskPatches = [];
  const newLinkRows = [];

  for (const task of (allTasks || [])) {
    const patch = { id: task.id };
    let hasPatch = false;

    // Parse stringified task_board
    let taskBoard = task.task_board;
    if (typeof taskBoard === 'string' && taskBoard.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(taskBoard);
        if (Array.isArray(parsed)) {
          taskBoard = parsed;
          patch.task_board = taskBoard;
          hasPatch = true;
        }
      } catch (e) { /* skip */ }
    }

    const boards = Array.isArray(taskBoard) ? taskBoard : [];

    // A. Fix vertical_id
    const currentVid = (task.vertical_id || '').toUpperCase();
    let correctVid = task.vertical_id;
    if (!VALID_VERTICALS.includes(currentVid)) {
      hasPatch = true;
      if (boards.includes('Hubs') || boards.includes('Hubs Daily') || task.hub_id) {
        correctVid = 'CHARGING_HUBS';
      } else if (boards.includes('Clients')) {
        correctVid = 'CLIENTS';
      } else if (boards.includes('Employees')) {
        correctVid = 'EMPLOYEES';
      } else {
        correctVid = 'CHARGING_HUBS';
      }
      patch.vertical_id = correctVid;
    }

    // B. Fix task_board
    if (boards.length === 0) {
      hasPatch = true;
      const vidCheck = (correctVid || task.vertical_id || '').toLowerCase();
      if (vidCheck.includes('hub'))      patch.task_board = ['Hubs'];
      else if (vidCheck.includes('client'))   patch.task_board = ['Clients'];
      else if (vidCheck.includes('employee')) patch.task_board = ['Employees'];
      else                                     patch.task_board = ['Hubs'];
    }

    // C. Fix city from hub_id
    if (!task.city && task.hub_id) {
      const mappedCity = hubCityMap[task.hub_id];
      if (mappedCity) { hasPatch = true; patch.city = mappedCity; }
    }

    // D. Fix stage_id
    if (!task.stage_id) { hasPatch = true; patch.stage_id = 'TODO'; }

    // E. Fix priority
    if (!task.priority) { hasPatch = true; patch.priority = 'Medium'; }

    if (hasPatch) taskPatches.push(patch);

    // F. Collect missing hub context links
    if (task.hub_id && !linkedSet.has(`${task.id}::${task.hub_id}`)) {
      newLinkRows.push({
        source_id: task.id, source_type: 'task',
        entity_type: 'hub', entity_id: task.hub_id,
      });
      linkedSet.add(`${task.id}::${task.hub_id}`);
    }
  }

  // 5. Bulk upsert task patches in chunks
  let updateCount = 0;
  for (let i = 0; i < taskPatches.length; i += CHUNK_SIZE) {
    const chunk = taskPatches.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('tasks').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('[taskFixService] upsert error:', error);
    else updateCount += chunk.length;
  }

  // 6. Insert missing hub context links in chunks
  for (let i = 0; i < newLinkRows.length; i += CHUNK_SIZE) {
    const chunk = newLinkRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('task_context_links').insert(chunk);
    if (error) console.error('[taskFixService] link insert error:', error);
    else updateCount += chunk.length;
  }

  return updateCount;
}
```

---

## Step 3 — Update `src/services/tasks/taskService.js`

### 3a. Replace the normalizer code with imports

At the TOP of `taskService.js`, add:
```js
import { normalizeTask, mapTaskToRow, TASK_SELECT } from './taskNormalizer';
import { fixAllTasks } from './taskFixService';
```

### 3b. DELETE from taskService.js

Remove these blocks verbatim from the file:
1. The `parseTaskBoard` internal helper function
2. The `normalizeTask` export function (entire block, lines ~46–115)
3. The `mapTaskToRow` export function (entire block, lines ~120–148)
4. The `TASK_SELECT` export constant (lines ~150–158)
5. The `fixAllTasks` method body inside the `taskService` object (lines ~628–783)

### 3c. In the taskService object, replace fixAllTasks with delegation

```js
export const taskService = {
  // ... all existing methods (getTasks, addTask, updateTask, etc.) ...

  /** Fix all tasks — delegated to taskFixService for separation of concerns */
  fixAllTasks,
};
```

---

## Step 4 — Update `src/components/FixTasksButton.jsx`

Open the file. If it imports `fixAllTasks` from `taskService`, the import still works
because `taskService.fixAllTasks` is now a delegation. No change needed.

However, if it imports `fixAllTasks` directly (not via `taskService`):
```js
// If this exists, update path:
import { fixAllTasks } from '../services/tasks/taskFixService';
```

Grep to check:
```powershell
Select-String "src/components/FixTasksButton.jsx" -Pattern "fixAllTasks"
```

---

## Step 5 — Check for circular imports

Potential circular dependency:
- `taskService.js` imports `taskNormalizer.js`
- `taskNormalizer.js` must NOT import from `taskService.js`
- `taskFixService.js` imports `supabaseClient.js` — fine
- `taskFixService.js` must NOT import from `taskService.js`

Verify:
```powershell
Select-String "src/services/tasks/taskNormalizer.js" -Pattern "import"
# Should only show: no imports (it's a pure module)

Select-String "src/services/tasks/taskFixService.js" -Pattern "import"
# Should show only: supabaseClient
```

---

## Step 6 — Verify `orchestrationService.js` still works

```powershell
Get-ChildItem "src/services/tasks" -Filter "orchestrationService.js" | Select-String -Pattern "normalizeTask|TASK_SELECT"
```

If it imports these from `taskService`, update to import from `taskNormalizer`:
```js
import { normalizeTask, TASK_SELECT } from './taskNormalizer';
```

---

## Step 7 — Verification

```powershell
npm run build:staging
```

Functional tests:
- **FixTasksButton works** (master_admin only — test by clicking it)
- **Add task** works and new task appears on board
- **Edit task** saves and updates correctly
- **Delete task** removes from board

File size check:
```powershell
(Get-Item "src/services/tasks/taskService.js").Length
# Should be significantly smaller (under 15,000 bytes)
(Get-Item "src/services/tasks/taskNormalizer.js").Length
# Should be around 5,000 bytes
(Get-Item "src/services/tasks/taskFixService.js").Length
# Should be around 6,000 bytes
```

---

## Rollback

```powershell
git checkout src/services/tasks/taskService.js
# Delete: taskNormalizer.js, taskFixService.js
```

## Commit Checkpoint

After the build succeeds:
```powershell
git add -A
git commit -m "refactor: RB-05 split taskService into taskNormalizer + taskFixService"
```
