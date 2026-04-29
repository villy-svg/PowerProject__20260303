# Runbook 5.2 — Board Nesting UI

## Phase 5: Frontend UI/UX Implementation
## Subphase 5.2: Add hierarchy nesting to the Daily Task Board

---

## Objective

Update the Daily Task Kanban Board (rendered inside `VerticalWorkspace.jsx` / `TaskController.jsx`) to:
1. Visually nest sub-tasks under their parent on the board.
2. Allow expanding/collapsing parent tasks to show/hide sub-tasks.
3. Show a parent task badge with child count.
4. Ensure sub-task stage changes propagate correctly in the UI.

---

## Prerequisites

- [ ] [Runbook 4.3](./09_REACT_HOOKS.md) complete (hook provides `parentTasks`, `getSubTasks`).
- [ ] [Runbook 5.1](./10_TEMPLATE_WIZARD_UI.md) complete (templates can create sub-tasks).
- [ ] Read [Adaptive UI Strategy](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/adaptive-ui-strategy/SKILL.md).

---

## Files Affected

| File | Action |
|---|---|
| `src/components/TaskController.jsx` or equivalent board renderer | MODIFY |
| `src/components/TaskCard.jsx` or equivalent card component | MODIFY |
| CSS file for the board | MODIFY |

> **Note**: The exact filenames depend on how the daily task board is rendered. The patterns below are framework-agnostic and should be adapted to the actual component structure.

---

## Architecture Decision: Rendering Strategy

### Option A: Filter-and-Nest (Recommended)
- The board iterates `parentTasks` (not `tasks`).
- For each parent in a column, render the parent card.
- If expanded, render its `getSubTasks(parent.id)` as indented child cards below it.
- Sub-tasks that are in a **different column** (different stage) than their parent still appear under their parent's section with a stage badge.

### Option B: Flat with Visual Linking
- The board renders ALL tasks flat (current behavior).
- Sub-tasks get a visual indent and a "↳ Sub-task of: {parent.text}" label.
- Simpler to implement, but less visually clear.

**Recommendation**: Start with **Option B** (minimal risk) and iterate to Option A.

---

## Step 5.2.1: Task Card — Sub-Task Indicator

### For parent tasks (childCount > 0):
```jsx
{task.childCount > 0 && (
  <div className="parent-task-badge" onClick={(e) => {
    e.stopPropagation();
    toggleExpanded(task.id);
  }}>
    <span className="child-count">
      {expanded[task.id] ? '▼' : '▶'} {task.childCount} sub-tasks
    </span>
  </div>
)}
```

### For sub-tasks (isSubTask = true):
```jsx
{task.isSubTask && (
  <div className="subtask-indicator">
    ↳ <span className="parent-ref">Sub-task</span>
  </div>
)}
```

---

## Step 5.2.2: Expand/Collapse State

In the board component:

```javascript
const [expandedParents, setExpandedParents] = useState({});

const toggleExpanded = useCallback((parentId) => {
  setExpandedParents(prev => ({
    ...prev,
    [parentId]: !prev[parentId],
  }));
}, []);

const isExpanded = (parentId) => expandedParents[parentId] || false;
```

---

## Step 5.2.3: Board Column Rendering (Option B — Flat with Indent)

### Current pattern (simplified):
```jsx
{tasksInColumn.map(task => (
  <TaskCard key={task.id} task={task} />
))}
```

### Updated pattern:
```jsx
{tasksInColumn.map(task => (
  <TaskCard
    key={task.id}
    task={task}
    isSubTask={task.isSubTask}
    childCount={task.childCount}
    isExpanded={isExpanded(task.id)}
    onToggleExpand={() => toggleExpanded(task.id)}
    className={task.isSubTask ? 'subtask-card' : ''}
  />
))}
```

---

## Step 5.2.4: CSS for Hierarchy Visuals

```css
/* Parent task badge */
.parent-task-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(var(--brand-green-rgb), 0.15);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--brand-green);
  margin-top: 4px;
  transition: background 0.2s ease;
}
.parent-task-badge:hover {
  background: rgba(var(--brand-green-rgb), 0.25);
}

/* Sub-task card indentation */
.subtask-card {
  margin-left: 16px;
  border-left: 2px solid var(--brand-green);
  opacity: 0.9;
}

/* Sub-task indicator label */
.subtask-indicator {
  font-size: 0.65rem;
  color: var(--brand-green);
  opacity: 0.7;
  margin-bottom: 4px;
}
```

---

## Step 5.2.5: Sorting — Parents Before Children

To ensure visual grouping, sort tasks so children immediately follow their parent:

```javascript
const sortedTasksForColumn = useMemo(() => {
  const parents = tasksInColumn.filter(t => !t.isSubTask);
  const result = [];
  parents.forEach(parent => {
    result.push(parent);
    // Insert children directly after parent (only if in same column)
    const children = tasksInColumn.filter(t => t.parentTaskId === parent.id);
    result.push(...children);
  });
  // Add orphan sub-tasks (parent is in a different column)
  const orphans = tasksInColumn.filter(t =>
    t.isSubTask && !parents.some(p => p.id === t.parentTaskId)
  );
  result.push(...orphans);
  return result;
}, [tasksInColumn]);
```

---

## Step 5.2.6: Mobile Considerations

Per the [Adaptive UI Strategy](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/adaptive-ui-strategy/SKILL.md):

- **Desktop**: Show full hierarchy with expand/collapse.
- **Mobile**: Show flat list with sub-task indicator badges (no expand/collapse — screen too small).
- Use `useMediaQuery` or equivalent to switch rendering modes.

---

## Validation

### V5.2.1: Parent tasks show child count badge
1. Run the generator to create a template with sub-tasks.
2. Open the Daily Task Board.
3. Verify parent tasks show "▶ N sub-tasks" badge.

### V5.2.2: Sub-tasks are visually indented
1. Look for sub-tasks in the same column as their parent.
2. Verify left indent and green border.

### V5.2.3: Expand/collapse works
1. Click the parent badge.
2. Verify children visibility toggles.
3. Click again to collapse.

### V5.2.4: Stage change on sub-task
1. Drag a sub-task to a different column (stage change).
2. Verify the sub-task appears in the new column.
3. The parent remains in its original column.
4. No errors in console.

### V5.2.5: Delete parent — children become orphans
1. Delete a parent task.
2. Verify child tasks are NOT deleted (ON DELETE SET NULL).
3. Children should appear as top-level tasks (no longer indented).

### V5.2.6: Mobile rendering
1. Resize to mobile viewport.
2. Verify sub-tasks show indicator badge but no expand/collapse.

---

## Future Enhancements (Out of Scope for Phase 5)

1. **Drag-and-drop re-parenting**: Allow users to drag a task onto another to make it a child.
2. **Aggregate progress**: Show parent task progress as "3/5 sub-tasks complete".
3. **Bulk stage transitions**: Moving a parent to DONE auto-completes remaining sub-tasks.
4. **Senior Manager dashboard**: Dedicated view showing all templates the manager oversees.

---

## End of Runbook Series

All 11 runbooks are complete. Return to the [Master Index](./00_INDEX.md) to track overall progress.
