# Runbook 04: Layout Node Prop Wiring

> **STANDALONE.** Drill the computed `canAddSubtask` authorization capability safely through visual hierarchy modules down to action triggers in every view.

---

## 1. Architectural Blueprint & Purpose

### Why This Step is Critical
The `canAddSubtask` capability developed in Runbook 02 and bound to the controller in Runbook 03 allows assigned field staff to create subtasks. However, this capability remains **invisible** until the UI components expose the "Add Subtask" button (`+`) based on this new permission, while *retaining* restrictions on hierarchy modification buttons (Promote, Drag-and-Drop) which still require `canManageHierarchy`.

### The Core Design Change
**Before this runbook:** The `+` (Add Subtask) button was wrapped inside the `canManageHierarchy` guard — meaning only managers and task creators could see it.

**After this runbook:** The `+` button is controlled by `canAddSubtask` — which also grants access to assignees. The hierarchy promotion actions (diagonal up arrow, promote to top) remain inside `canManageHierarchy`.

### Critical Concept: `canAddSubtask` Is a Function, Not a Boolean

> [!IMPORTANT]
> `canAddSubtask` as it arrives from `useTaskController` → `useTaskPermissions` is a **function**: `canAddSubtask(task) => boolean`.
>
> **Different views handle this differently:**
>
> | Component | How it receives `canAddSubtask` | How it uses it |
> | :--- | :--- | :--- |
> | `TaskController.jsx` | As a function from `useTaskController` | Passes function down to views |
> | `TaskKanbanView.jsx` | As a function prop | Evaluates per task: `canAddSubtask(task)` and passes **boolean** to `TaskCard` |
> | `TaskListView.jsx` | As a function prop | Passes **function** to `ListViewRow`; `ListViewRow` evaluates `canAddSubtask(task)` |
> | `TaskTreeView.jsx` | As a function prop → closure | `TreeRow` accesses `canAddSubtask` from **outer scope** (no prop passing needed) |
> | `TaskCard.jsx` | As a **boolean** prop (pre-evaluated) | Renders button if `canAddSubtask === true` |

---

## 2. Target Files & Current State

### Files to Modify in Order:
1. **`src/components/TaskController.jsx`** — Root layout aggregator
2. **`src/components/TaskKanbanView.jsx`** — Kanban view container
3. **`src/components/TaskListView.jsx`** — List view + `ListViewRow` sub-component
4. **`src/components/TaskTreeView.jsx`** — Tree view + `TreeRow` sub-component (closure)
5. **`src/components/TaskCard.jsx`** — Primary Kanban card component

### Prerequisites:
- [ ] Runbook 01 completed (`taskUtils.js` exports `isAssignee`, `isManager`, `isCreator`)
- [ ] Runbook 02 completed (`useTaskPermissions.js` defines and returns `canAddSubtask`)
- [ ] Runbook 03 completed (`useTaskController.js` destructures and uses `canAddSubtask`)

---

## 3. Step 1: Update `src/components/TaskController.jsx`

### Location
- **Absolute path:** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\TaskController.jsx`

### Current State to Know
The controller destructures from the `controller` object at line 44. The current destructure ends around line 73:
```javascript
  const {
    ...
    canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy,
    ...
    canEditTask
  } = controller;
```

The view rendering happens starting around line 288. Three view components are rendered: `<TaskKanbanView>`, `<TaskListView>`, and `<TaskTreeView>`.

### Sub-Step A: Add `canAddSubtask` to the Destructure

Find the line (around line 62) that reads:
```javascript
    canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy,
```

Add `canAddSubtask` to this line:
```javascript
    canUserCreate, canUserUpdate, canUserDelete, canManageHierarchy, canAddSubtask,
```

### Sub-Step B: Pass `canAddSubtask` to All Three View Components

Find the `<TaskKanbanView>` block (around line 289). It currently has:
```javascript
            canManageHierarchy={canManageHierarchy}
```

Add directly after that line:
```javascript
            canManageHierarchy={canManageHierarchy}
            canAddSubtask={canAddSubtask}
```

Find the `<TaskListView>` block (around line 322). It currently has:
```javascript
            canManageHierarchy={canManageHierarchy}
```

Add directly after that line:
```javascript
            canManageHierarchy={canManageHierarchy}
            canAddSubtask={canAddSubtask}
```

Find the `<TaskTreeView>` block (around line 350). It currently has:
```javascript
            canManageHierarchy={canManageHierarchy}
```

Add directly after that line:
```javascript
            canManageHierarchy={canManageHierarchy}
            canAddSubtask={canAddSubtask}
```

> [!IMPORTANT]
> All three view components must receive `canAddSubtask` as a prop. Missing even one will result in that view's `+` button never rendering for assignees.

---

## 4. Step 2: Update `src/components/TaskKanbanView.jsx`

### Location
- **Absolute path:** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\TaskKanbanView.jsx`

### Current State to Know
The `TaskKanbanView` functional component props are destructured starting at line 56. The current list does NOT include `canAddSubtask`. The `<TaskCard>` is rendered inside a map at around line 250. Currently:
```javascript
                    <TaskCard
                      ...
                      canManageHierarchy={canManageHierarchy(task)}
                      ...
```

### Sub-Step A: Add `canAddSubtask` to Props Destructuring

Find the props destructure for `TaskKanbanView` (around line 56-88). The current list includes `canManageHierarchy` at around line 74. Add `canAddSubtask` directly after it:

**Before:**
```javascript
  canManageHierarchy,
  updateTaskStage,
```

**After:**
```javascript
  canManageHierarchy,
  canAddSubtask,      // <-- Add here
  updateTaskStage,
```

### Sub-Step B: Pass Pre-Evaluated Boolean to `<TaskCard>`

Find the `<TaskCard>` render inside the `stageTasks.map` (around line 250). Locate the `canManageHierarchy={canManageHierarchy(task)}` prop and add `canAddSubtask` directly after it:

**Before:**
```javascript
                      canManageHierarchy={canManageHierarchy(task)}
```

**After:**
```javascript
                      canManageHierarchy={canManageHierarchy(task)}
                      canAddSubtask={canAddSubtask ? canAddSubtask(task) : false}
```

> [!IMPORTANT]
> **Why the ternary guard?** `canAddSubtask` is a function prop arriving from `TaskController`. If something goes wrong upstream and it arrives as `undefined` or `null`, calling it directly (`canAddSubtask(task)`) would throw a runtime error. The ternary `canAddSubtask ? canAddSubtask(task) : false` makes this safe. `TaskCard` receives a **boolean**, not the function.

---

## 5. Step 3: Update `src/components/TaskListView.jsx`

### Location
- **Absolute path:** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\TaskListView.jsx`

### Current State to Know
This file contains TWO components:
1. **`ListViewRow`** — defined at the top (line 22), renders a single task row. Props include `canManageHierarchy` and `canCreate`.
2. **`TaskListView`** — defined further down (line 337), renders all stages and maps tasks. Props include `canManageHierarchy` and `canCreate`.

Currently, the `+` (Add Subtask) button (around line 246) is nested INSIDE the `{!task.isContextOnly && canManage && (` block. The `canManage` variable is computed as `const canManage = canManageHierarchy(task);`. This means field staff who are assignees but not managers cannot see the `+` button even though they should be able to.

### Sub-Step A: Add `canAddSubtask` to `ListViewRow` Props

Find the `ListViewRow` component definition (starting at line 22). Find where `canCreate` appears in the props (around line 41):
```javascript
  canCreate,
```

Add `canAddSubtask` directly after `canManageHierarchy`:
```javascript
  canManageHierarchy,
  canAddSubtask,      // <-- Add here (receives the function, not a boolean)
```

> [!NOTE]
> `canAddSubtask` inside `ListViewRow` is the **function**, not a pre-evaluated boolean. `ListViewRow` will call it as `canAddSubtask(task)` when deciding whether to show the button.

### Sub-Step B: Decouple the `+` Button from `canManage`

Find the subtask button logic inside `ListViewRow` (around line 215-256). The current structure:
```javascript
          {!task.isContextOnly && canManage && (
            <>
              {task.parentTask && (
                <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                  {/* promote buttons */}
                </div>
              )}
              {canCreate && (
                <button
                  className="card-add-sub-button"
                  onClick={(e) => { e.stopPropagation(); tva.handleAddSubtask(task.id); }}
                  title="Add Subtask Under This"
                >
                  <IconPlus size={14} />
                </button>
              )}
            </>
          )}
```

**Replace the entire block above with:**
```javascript
          {!task.isContextOnly && (
            <>
              {/* Hierarchy Promotion Actions — restricted to managers/creators only */}
              {canManage && task.parentTask && (
                <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                  {tasks?.find(t => t.id === task.parentTask)?.parentTask && (
                    <button
                      className="card-nav-button promote-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const parent = tasks.find(t => t.id === task.parentTask);
                        if (parent) onMoveToParent(task.id, parent.parentTask);
                      }}
                      title="Promote to Parent's Sibling (Promote to Grandparent)"
                      style={{ color: 'var(--brand-blue)' }}
                    >
                      <IconDiagonalUp size={14} />
                    </button>
                  )}
                  <button
                    className="card-nav-button promote-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveToParent(task.id, null);
                    }}
                    title="Make Top Level Task"
                    style={{ color: 'var(--brand-blue)' }}
                  >
                    <IconPromote size={14} />
                  </button>
                </div>
              )}
              {/* Subtask Creation — available to managers, creators, AND assignees */}
              {canAddSubtask && canAddSubtask(task) && (
                <button
                  className="card-add-sub-button"
                  onClick={(e) => { e.stopPropagation(); tva.handleAddSubtask(task.id); }}
                  title="Add Subtask Under This"
                >
                  <IconPlus size={14} />
                </button>
              )}
            </>
          )}
```

> [!IMPORTANT]
> **Double-guard pattern:** `{canAddSubtask && canAddSubtask(task) && (` — the first `canAddSubtask` checks that the prop is not undefined (in case of a wiring error upstream); the second `canAddSubtask(task)` calls the function with the task to get the boolean result. This prevents runtime crashes from undefined prop.

### Sub-Step C: Add `canAddSubtask` to `TaskListView` Props

Find the `TaskListView` component definition (around line 337). Current props include `canManageHierarchy` and `canCreate`:
```javascript
  canManageHierarchy,
  canDelete,
```

Add `canAddSubtask` directly after `canManageHierarchy`:
```javascript
  canManageHierarchy,
  canAddSubtask,      // <-- Add here
  canDelete,
```

### Sub-Step D: Pass `canAddSubtask` to `<ListViewRow>`

Find where `<ListViewRow>` is rendered inside `TaskListView` (around line 472). Currently it passes:
```javascript
                  canManageHierarchy={canManageHierarchy}
```

Add `canAddSubtask` directly after it:
```javascript
                  canManageHierarchy={canManageHierarchy}
                  canAddSubtask={canAddSubtask}
```

---

## 6. Step 4: Update `src/components/TaskTreeView.jsx`

### Location
- **Absolute path:** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\TaskTreeView.jsx`

### Current State to Know — Architecture Is Different Here!

> [!IMPORTANT]
> **`TaskTreeView` has a unique architectural pattern**: `TreeRow` is **defined as a closure inside `TaskTreeView`**. This means `TreeRow` already has access to all variables in `TaskTreeView`'s outer scope WITHOUT receiving them as props. Variables like `canManageHierarchy`, `canCreate`, `tasks`, `permissions`, etc. are accessed via closure.
>
> This means you do **NOT** need to pass `canAddSubtask` as a prop to `TreeRow`. You just need to:
> 1. Accept `canAddSubtask` in `TaskTreeView`'s props destructure.
> 2. Use it directly inside `TreeRow`'s JSX (it will be in scope via closure).

### Sub-Step A: Add `canAddSubtask` to `TaskTreeView` Props

Find the `TaskTreeView` functional component definition (starting at line 23). Current props include `canCreate` around line 38:
```javascript
  canCreate,
  permissions = {},
```

Add `canAddSubtask` directly after `canManageHierarchy`:
```javascript
  canManageHierarchy,
  canAddSubtask,      // <-- Add here (will be in closure scope for TreeRow)
  canDelete,
```

### Sub-Step B: Decouple the `+` Button Inside `TreeRow`

Find the controls section inside `TreeRow` (around line 275). The current structure:
```javascript
            {!task.isContextOnly && effectiveCanUpdate && canManageHierarchy(task) && (
              <React.Fragment>
                {task.parentTask && (
                  <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                    {/* promote buttons */}
                  </div>
                )}
                {canCreate && (
                  <button
                    className="card-add-sub-button"
                    onClick={(e) => { e.stopPropagation(); tva.handleAddSubtask(task.id); }}
                    title="Add Subtask Under This"
                    style={{ color: 'var(--brand-green)' }}
                  >
                    <IconPlus size={14} />
                  </button>
                )}
              </React.Fragment>
            )}
```

**Replace the entire block above with:**
```javascript
            {!task.isContextOnly && (
              <React.Fragment>
                {/* Hierarchy Actions — restricted to managers/creators (canManageHierarchy) */}
                {effectiveCanUpdate && canManageHierarchy(task) && task.parentTask && (
                  <div className="hierarchy-nav-group" style={{ display: 'flex', gap: '4px' }}>
                    {tasks.find(t => t.id === task.parentTask)?.parentTask && (
                      <button
                        className="card-nav-button promote-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const parent = tasks.find(t => t.id === task.parentTask);
                          if (parent) onMoveToParent(task.id, parent.parentTask);
                        }}
                        title="Move to Parent's Sibling (Promote to Grandparent)"
                        style={{ color: 'var(--brand-blue)' }}
                      >
                        <IconDiagonalUp size={14} />
                      </button>
                    )}
                    <button
                      className="card-nav-button promote-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToParent(task.id, null);
                      }}
                      title="Make Top Level Task"
                      style={{ color: 'var(--brand-blue)' }}
                    >
                      <IconPromote size={14} />
                    </button>
                  </div>
                )}
                {/* Subtask Creation — available to managers, creators, AND assignees */}
                {canAddSubtask && canAddSubtask(task) && (
                  <button
                    className="card-add-sub-button"
                    onClick={(e) => { e.stopPropagation(); tva.handleAddSubtask(task.id); }}
                    title="Add Subtask Under This"
                    style={{ color: 'var(--brand-green)' }}
                  >
                    <IconPlus size={14} />
                  </button>
                )}
              </React.Fragment>
            )}
```

> [!NOTE]
> `canAddSubtask` here is accessed from the outer `TaskTreeView` scope via closure — it is the same function that was passed as a prop to `TaskTreeView`. No prop drilling to `TreeRow` is needed.

---

## 7. Step 5: Update `src/components/TaskCard.jsx`

### Location
- **Absolute path:** `c:\Users\villy\OneDrive\Documents\PowerPod New\Coding Practice\PowerProject\src\components\TaskCard.jsx`

### Current State to Know
`TaskCard` props are destructured starting at line 27. The current list includes `canManageHierarchy = false` (with a default) but does NOT include `canAddSubtask`. The hierarchy + subtask button block is around line 211:

```javascript
        {!task.isContextOnly && canManageHierarchy && showHierarchy && (
          <>
            {task.parentTask && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {/* promote buttons */}
              </div>
            )}
            <button
              className="action-icon-btn"
              style={{ color: 'var(--brand-green)' }}
              onClick={() => tva.handleAddSubtask(task.id)}
              title="Add Subtask Under This"
            >
              <IconPlus size={14} />
            </button>
          </>
        )}
```

### Sub-Step A: Add `canAddSubtask` to Props Destructuring

Find the props destructure (around line 27). Find `canManageHierarchy = false`:
```javascript
  canManageHierarchy = false,
  updateTaskStage,
```

Add `canAddSubtask` with a default of `false` directly after `canManageHierarchy`:
```javascript
  canManageHierarchy = false,
  canAddSubtask = false,   // <-- New prop. This is a PRE-EVALUATED BOOLEAN (not a function).
  updateTaskStage,
```

> [!IMPORTANT]
> **`canAddSubtask` in `TaskCard` is a boolean, not a function.** It arrives pre-evaluated from `TaskKanbanView` which does `canAddSubtask={canAddSubtask ? canAddSubtask(task) : false}`. Do NOT call `canAddSubtask(task)` inside `TaskCard` — it's already been evaluated upstream.

### Sub-Step B: Decouple the `+` Button from `canManageHierarchy`

Find the full hierarchy+subtask block (around line 211). The current code:
```javascript
        {!task.isContextOnly && canManageHierarchy && showHierarchy && (
          <>
            {task.parentTask && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {tasks.find(t => t.id === task.parentTask)?.parentTask && (
                  <button
                    className="action-icon-btn"
                    style={{ color: 'var(--brand-blue)' }}
                    onClick={() => {
                      const parent = tasks.find(t => t.id === task.parentTask);
                      if (parent) onMoveToParent(task.id, parent.parentTask);
                      if (parent) onPromote(task.id, parent.parentTask);
                    }}
                    title="Promote to Parent's Sibling (Promote to Grandparent)"
                  >
                    <IconDiagonalUp size={14} />
                  </button>
                )}
                <button
                  className="action-icon-btn"
                  style={{ color: 'var(--brand-green)' }}
                  onClick={(e) => { e.stopPropagation(); onPromote(task.id, null); }}
                  title="Promote to Top Level"
                >
                  <IconPromote size={14} />
                </button>
              </div>
            )}
            <button
              className="action-icon-btn"
              style={{ color: 'var(--brand-green)' }}
              onClick={() => tva.handleAddSubtask(task.id)}
              title="Add Subtask Under This"
            >
              <IconPlus size={14} />
            </button>
          </>
        )}
```

**Replace with two separate, independent blocks:**
```javascript
        {/* Hierarchy Navigation (Promote buttons) — restricted to managers/creators */}
        {!task.isContextOnly && canManageHierarchy && showHierarchy && task.parentTask && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {tasks.find(t => t.id === task.parentTask)?.parentTask && (
              <button
                className="action-icon-btn"
                style={{ color: 'var(--brand-blue)' }}
                onClick={() => {
                  const parent = tasks.find(t => t.id === task.parentTask);
                  if (parent) onMoveToParent(task.id, parent.parentTask);
                  if (parent) onPromote(task.id, parent.parentTask);
                }}
                title="Promote to Parent's Sibling (Promote to Grandparent)"
              >
                <IconDiagonalUp size={14} />
              </button>
            )}
            <button
              className="action-icon-btn"
              style={{ color: 'var(--brand-green)' }}
              onClick={(e) => { e.stopPropagation(); onPromote(task.id, null); }}
              title="Promote to Top Level"
            >
              <IconPromote size={14} />
            </button>
          </div>
        )}

        {/* Subtask Creation Trigger — available to managers, creators, AND assignees */}
        {!task.isContextOnly && canAddSubtask && showHierarchy && (
          <button
            className="action-icon-btn"
            style={{ color: 'var(--brand-green)' }}
            onClick={() => tva.handleAddSubtask(task.id)}
            title="Add Subtask Under This"
          >
            <IconPlus size={14} />
          </button>
        )}
```

> [!IMPORTANT]
> **`showHierarchy` gate must remain on the subtask button.** `showHierarchy` is controlled by `permissions.canViewKanbanHierarchy` and determines whether hierarchy features are enabled on this particular board instance. Without this gate, the `+` button could appear on boards where hierarchy is intentionally disabled.

---

## 8. Verification Protocol

Execute the following multi-persona validation to test security boundaries:

### Persona A: Manager (Role `admin` or `editor`, Seniority > 6)
- Log in and navigate to the task board.
- Open a task not assigned to you.
- Verify the `+` (Add Subtask) button **appears**.
- Verify hierarchy promotion arrows (diagonal up, promote to top) **also appear**.

### Persona B: Assignee (Role `contributor`, Seniority ≤ 6)
- Log in and find a task **assigned to you**.
- Verify the `+` button **appears**.
- Verify hierarchy promotion arrows **do NOT appear** (canManageHierarchy should return false for a non-creator field staff user).

### Persona C: Non-Assigned Field Staff (Role `contributor`, Seniority ≤ 6)
- Log in and find a task **NOT assigned to you** and **NOT created by you**.
- Verify the `+` button **does NOT appear**.

### Dev Server / Build Checks
- [ ] `npm run dev` shows zero red errors after saving all files.
- [ ] No console errors of type: `canAddSubtask is not a function`, `Cannot read property of undefined`
- [ ] `npm run build` completes successfully.

---

## 9. Summary of All Changes

| File | Change Summary |
| :--- | :--- |
| `TaskController.jsx` | Destructure `canAddSubtask` from controller; pass it to all 3 view components |
| `TaskKanbanView.jsx` | Accept `canAddSubtask` prop; evaluate per task before passing boolean to `TaskCard` |
| `TaskListView.jsx` | Accept `canAddSubtask` in both `TaskListView` and `ListViewRow`; decouple `+` button from `canManage` |
| `TaskTreeView.jsx` | Accept `canAddSubtask` in `TaskTreeView`; use from closure in `TreeRow`; decouple `+` button |
| `TaskCard.jsx` | Accept `canAddSubtask = false` boolean prop; render `+` button independently from hierarchy buttons |

---

## 10. Common Mistakes to Avoid

| Mistake | Consequence | How to Avoid |
| :--- | :--- | :--- |
| Passing `canAddSubtask` as a boolean to `TaskListView` (pre-evaluating before the view) | All rows get same boolean — no per-task evaluation | Pass the **function** to list and tree views; only pass boolean to `TaskCard` |
| Trying to pass `canAddSubtask` as a prop to `TreeRow` | Structural mismatch — TreeRow is a closure | Access `canAddSubtask` from outer scope in `TreeRow` directly |
| Calling `canAddSubtask(task)` inside `TaskCard` | Runtime error — `TaskCard` receives a boolean, not a function | In `TaskCard`, use `canAddSubtask` directly as a boolean |
| Removing `showHierarchy` from the `+` button condition in `TaskCard` | Button shows on hierarchy-disabled boards | Keep `&& showHierarchy` on the subtask button |
| Forgetting to update `TaskTreeView` props after updating `TaskController` | `canAddSubtask` is `undefined` inside TreeView | All three views must be updated in `TaskController.jsx` |

---

## 11. Handoff

This is the final runbook in the series. Once all files are updated and all personas verified, the subtask permissions feature is complete.

**Final Series-Wide Definition of Done:**
- [ ] Assignee (field staff) can click `+` on their assigned tasks to create subtasks.
- [ ] Non-assignee field staff cannot see the `+` button on tasks they don't own or aren't assigned to.
- [ ] Managers can see both the `+` button AND hierarchy promotion buttons on all tasks.
- [ ] `npm run dev` and `npm run build` complete without errors.
