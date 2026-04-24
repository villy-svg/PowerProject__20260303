# Runbook 6.2 — Board Hierarchy & Nesting UI

## Phase 6: Frontend UI
## Subphase 6.2: Display parent-child hierarchy and multi-hub badges on the task board

---

## Objective

Update the Kanban board rendering to:
1. Show multi-hub badges on task cards.
2. Visually nest child tasks under their parent.
3. Allow expanding/collapsing parent tasks.
4. Show fan-out mode indicator on parent task cards.

---

## Prerequisites

- [ ] [Runbook 6.1](./11_TASK_FORM_UI.md) complete.
- [ ] Read [Adaptive UI Strategy](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/adaptive-ui-strategy/SKILL.md).

---

## Files Affected

| File | Action |
|---|---|
| `src/hooks/useTasks.js` | MODIFY (add hierarchy computed values) |
| Task card component (e.g. `HubTaskTile.jsx`) | MODIFY |
| Task board/column renderer (e.g. `TaskController.jsx`) | MODIFY |
| CSS files for card and board | MODIFY |

---

## Step 6.2.1: Add Hierarchy Computed Values to `useTasks.js`

Add after existing state declarations:

```javascript
import { useState, useCallback, useMemo } from 'react';

// ... inside useTasks hook ...

// Hierarchy: computed from flat task list
const parentTasks = useMemo(() =>
  tasks.filter(t => !t.isSubTask),
  [tasks]
);

const subTasksByParent = useMemo(() => {
  const map = {};
  tasks.forEach(t => {
    if (t.parentTask) {
      if (!map[t.parentTask]) map[t.parentTask] = [];
      map[t.parentTask].push(t);
    }
  });
  return map;
}, [tasks]);

const getSubTasks = useCallback((parentId) =>
  subTasksByParent[parentId] || [],
  [subTasksByParent]
);

// Add to return object:
return {
  // ... existing returns ...
  parentTasks,
  subTasksByParent,
  getSubTasks,
};
```

---

## Step 6.2.2: Multi-Hub Badges on Task Card

In the task card component (e.g. `HubTaskTile.jsx`), show hub badges:

```jsx
{/* Hub badges — show all linked hubs */}
<div className="task-hub-badges">
  {(task.hubCodes || []).map((code, i) => (
    <span key={i} className="hub-badge">{code}</span>
  ))}
  {(task.hubCodes || []).length === 0 && task.hub_id && (
    <span className="hub-badge">📍</span>
  )}
</div>
```

---

## Step 6.2.3: Parent Task Expand/Collapse

```jsx
{/* Parent task indicator */}
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

{/* Sub-task indicator */}
{task.isSubTask && (
  <div className="subtask-indicator">
    ↳ <span className="parent-ref">Sub-task</span>
  </div>
)}
```

State management in the board component:
```javascript
const [expandedParents, setExpandedParents] = useState({});
const toggleExpanded = useCallback((parentId) => {
  setExpandedParents(prev => ({
    ...prev,
    [parentId]: !prev[parentId],
  }));
}, []);
```

---

## Step 6.2.4: Column Rendering — Sort Parents Before Children

```javascript
const sortedTasksForColumn = useMemo(() => {
  const parents = tasksInColumn.filter(t => !t.isSubTask);
  const result = [];

  parents.forEach(parent => {
    result.push(parent);
    // Insert children directly after parent (only if expanded and in same column)
    if (expandedParents[parent.id]) {
      const children = tasksInColumn.filter(t => t.parentTask === parent.id);
      result.push(...children);
    }
  });

  // Add orphan sub-tasks (parent in different column)
  const orphans = tasksInColumn.filter(t =>
    t.isSubTask && !parents.some(p => p.id === t.parentTask)
  );
  result.push(...orphans);

  return result;
}, [tasksInColumn, expandedParents]);
```

---

## Step 6.2.5: CSS for Hierarchy Visuals

```css
/* Hub badges */
.task-hub-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.hub-badge {
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(var(--brand-green-rgb), 0.12);
  color: var(--brand-green);
  font-weight: 600;
}

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

## Step 6.2.6: Mobile Considerations

Per the [Adaptive UI Strategy](file:///c:/Users/villy/OneDrive/Documents/PowerPod%20New/Coding%20Practice/PowerProject/.agent/skills/adaptive-ui-strategy/SKILL.md):

- **Desktop**: Full expand/collapse with indented children.
- **Mobile**: Show flat list with sub-task indicator badges only. No expand/collapse (screen too small).

```css
@media (max-width: 768px) {
  .subtask-card { margin-left: 8px; }
  .parent-task-badge { font-size: 0.65rem; padding: 2px 6px; }
}
```

---

## Validation

### V6.2.1: Hub badges appear
1. Create a task linked to 2 hubs.
2. Verify both hub codes appear as badges on the task card.

### V6.2.2: Parent shows child count
1. Run the generator with a Mode 2 or Mode 3 template.
2. Verify parent task shows "▶ N sub-tasks" badge.

### V6.2.3: Expand/collapse works
1. Click the parent badge.
2. Children appear indented below.
3. Click again to collapse.

### V6.2.4: Sub-task stage drag
1. Drag a sub-task to a different column.
2. Verify it moves independently of the parent.
3. No console errors.

### V6.2.5: Delete parent → children become orphans
1. Delete a parent task.
2. Verify children are NOT deleted (`ON DELETE SET NULL`).
3. Children appear as top-level tasks.

### V6.2.6: Mobile rendering
1. Resize to mobile viewport.
2. Sub-tasks show indicator but no expand/collapse.

---

## End of Runbook Series

All 12 runbooks complete. Return to [Master Index](./00_INDEX.md) to track overall progress.
