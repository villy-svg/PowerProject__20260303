# Task Permissions Refactor — Master Index

> **Series Goal:** Consolidate access heuristics (`isAssignee`, `isCreator`, `isManager`) into the unified `taskUtils` engine, integrate a new `canAddSubtask` capability into `useTaskPermissions`, and safely drill this capability down to layout nodes. This unlocks authorization for assignees to create sub-records while preserving strict hierarchy security.

> [!IMPORTANT]
> **Breaking Change Risk:** Modifying `canManageHierarchy` and introducing `canAddSubtask` directly affects who can see the `+` (Add Subtask) button on cards. Ensure you execute all verification steps to prevent access leaks or accidental lockouts.

---

## Prerequisites for Interns

Before you touch any code, ensure your local development environment is ready.
1. **Open Terminal:** Open your command prompt or VS Code terminal.
2. **Navigate to Workspace:** Ensure you are in the root directory: `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject`
3. **Start Dev Server:** Run `npm run dev`. Keep this terminal open to watch for syntax errors.

---

## Why This Exists

Historically, task authorization logic was scattered across individual components, leading to mismatched evaluation criteria. A user might be able to edit a task in the modal but not move it on the Kanban board.

This series enforces the **Centralized Security Pattern**:
- **Heuristics** live in `taskUtils.js`.
- **Capabilities** are computed in `useTaskPermissions.js`.
- **Controllers** consume capabilities in `useTaskController.js`.
- **Layouts** enforce UI visibility based on drilled props.

---

## Series Directory

```
.agent/runbooks_master/runbook_subtasks_permissions/
├── 00_INDEX.md                               ← THIS FILE — Architecture + series guide
├── 01_MODULAR_ACCESS_HELPERS.md              ← Export evaluation methods in taskUtils.js
├── 02_PERMISSION_CAPABILITY_INTEGRATION.md   ← Add canAddSubtask to useTaskPermissions.js
├── 03_STATE_AND_CONTROLLER_MAPPING.md        ← Wire bounds into useTaskController.js
└── 04_LAYOUT_NODE_WIRING.md                  ← Prop drill capability to UI layout nodes
```

> **Absolute path (Windows):**
> `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\.agent\runbooks_master\runbook_subtasks_permissions\`

**Execution order:** `01 → 02 → 03 → 04`

Each runbook is **100% standalone** — a model with zero project context can execute it.

---

## Architecture

```
+-----------------------+
|      taskUtils.js     | <--- Atomic Heuristics (isAssignee, isCreator, isManager)
+-----------------------+
           |
           v
+-----------------------+
|  useTaskPermissions.js | <--- Capability Integration (canAddSubtask)
+-----------------------+
           |
           v
+-----------------------+
|  useTaskController.js  | <--- State Orchestration (handleAddSubtask)
+-----------------------+
           |
           v
+-----------------------------------------------------+
| TaskController.jsx (Root)                           | <--- Destructures canAddSubtask from controller
+-----------------------------------------------------+
           |
           ├── <TaskKanbanView canAddSubtask={canAddSubtask} />
           │         └── <TaskCard canAddSubtask={canAddSubtask(task)} />
           │
           ├── <TaskListView canAddSubtask={canAddSubtask} />
           │         └── <ListViewRow canAddSubtask={canAddSubtask} />
           │                   └── {canAddSubtask && canAddSubtask(task) && <button>}
           │
           └── <TaskTreeView canAddSubtask={canAddSubtask} />
                     └── TreeRow (closure) uses canAddSubtask directly from scope
```

> [!IMPORTANT]
> **Critical Architecture Note on `canAddSubtask`:**
> `canAddSubtask` is a **function**, not a boolean. It accepts a `task` object and returns a `boolean`.
> - In `useTaskPermissions.js`: `canAddSubtask = useCallback((task) => { ... }, [canUserCreate, user])`
> - When passing to `<TaskCard>` (which expects a boolean), evaluate it: `canAddSubtask={canAddSubtask ? canAddSubtask(task) : false}`
> - When passing to `<TaskListView>` and `<TaskTreeView>` (which receive the function and evaluate per row), pass the function directly: `canAddSubtask={canAddSubtask}`

---

## Data Flow: How `canAddSubtask` Reaches the `+` Button

Understanding this flow is critical. Follow the chain exactly:

1. `useTaskPermissions.js` → defines `canAddSubtask` as a `useCallback` function
2. `useTaskController.js` → destructures it from `useTaskPermissions`, includes it in return object via `...permissionsInfo` spread
3. `TaskController.jsx` → destructures `canAddSubtask` from `controller` object
4. `<TaskKanbanView>` → receives `canAddSubtask` as prop, evaluates it per task when passing to `<TaskCard>`
5. `<TaskListView>` → receives `canAddSubtask` as function prop, passes it down to `<ListViewRow>`, which evaluates it
6. `<TaskTreeView>` → receives `canAddSubtask` as function prop; `TreeRow` (a closure defined inside `TaskTreeView`) accesses it from outer scope
7. `<TaskCard>` → receives a pre-evaluated boolean `canAddSubtask`, renders `+` button if true

---

## Definition of Done (Series-Wide)

- [ ] `taskUtils.js` exports `isAssignee`, `isManager`, and `isCreator` as methods on the `taskUtils` object.
- [ ] `useTaskPermissions.js` implements and exports `canAddSubtask`.
- [ ] `useTaskController.js` destructures `canAddSubtask` and uses it inside `handleAddSubtask`.
- [ ] `TaskController.jsx` destructures `canAddSubtask` and passes it to all three view components.
- [ ] `TaskKanbanView.jsx` receives `canAddSubtask` and evaluates it when passing to `TaskCard`.
- [ ] `TaskListView.jsx` (both `TaskListView` and `ListViewRow`) receives `canAddSubtask` function and uses it correctly.
- [ ] `TaskTreeView.jsx` receives `canAddSubtask`, `TreeRow` uses it from closure scope.
- [ ] `TaskCard.jsx` accepts `canAddSubtask` boolean and renders the `+` button independently from `canManageHierarchy`.
- [ ] `npm run dev` shows zero errors.
- [ ] Manual regression testing verifies assignees can add subtasks.

---

## Series Execution Guide for AI Models & Interns

Follow this workflow sequentially. Do not skip runbooks.

### Phase 1: Core Logic (Runbooks 01 - 02)
1. Open `01_MODULAR_ACCESS_HELPERS.md` and export security primitives.
2. Open `02_PERMISSION_CAPABILITY_INTEGRATION.md` and build the capability hook.

### Phase 2: Integration (Runbooks 03 - 04)
3. Open `03_STATE_AND_CONTROLLER_MAPPING.md` to enforce logic at the controller level.
4. Open `04_LAYOUT_NODE_WIRING.md` to update UI presentation layers safely.
