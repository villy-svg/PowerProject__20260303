# Runbook 02: Service & Board Mapping (Data Integrity)

## 1. Architectural Context
In the PowerProject task system, the `task_board` column in the `tasks` table is a `jsonb` array. This allows a single task to "live" on multiple boards (e.g., "Hubs" and "Escalations"). 

The `taskService.js` contains the source of truth for how different `verticalId` strings map to their default `task_board` entries. When we create a task from the Escalation Board, we need the system to automatically tag it with the `'Escalations'` board ID.

---

## 2. Pre-Implementation Checklist
- [ ] Read `src/services/tasks/taskService.js` to understand the `VERTICAL_BOARD_MAP` structure.
- [ ] Verify that you have access to the Supabase client for database verification.
- [ ] Ensure you understand the distinction between `vertical_id` (the domain) and `task_board` (the view).

---

## 3. Implementation Steps

### 3.1 Expanding the Board Mapping Registry
The `VERTICAL_BOARD_MAP` constant is used by the `addTask` and `fixAllTasks` functions to resolve board assignments. We must add the `escalation` keyword to this map.

**File**: `src/services/tasks/taskService.js`

1. Locate the `VERTICAL_BOARD_MAP` object (around line 40).
2. Add the `'escalation'` entry.

```javascript
/**
 * REVISION: 1.0
 * TARGET: src/services/tasks/taskService.js
 * ACTION: Add 'escalation' keyword to board mapping.
 */

const VERTICAL_BOARD_MAP = {
  'daily_hub': 'Hubs Daily',
  'escalation': 'Escalations', // <--- ADD THIS LINE
  'hub':       'Hubs',
  'client':    'Clients',
  'employee':  'Employees',
};
```

### 3.2 Verification of Board Inference Logic
The `addTask` function (around line 271) uses this map to populate the `task_board` if it's missing in the incoming request. 

**Logic Review**:
```javascript
// Inside addTask function (around line 307):
if (!Array.isArray(taskBoard) || taskBoard.length === 0) {
  const matchedKey = Object.keys(VERTICAL_BOARD_MAP).find(key => 
    resolvedVid.toLowerCase().includes(key)
  );
  // If resolvedVid is 'ESCALATION_TASKS', matchedKey will be 'escalation'
  // Resulting board will be ['Escalations']
  taskBoard = matchedKey ? [VERTICAL_BOARD_MAP[matchedKey]] : ['Hubs'];
}
```

---

## 4. Defensive Coding Standards

> [!IMPORTANT]
> **Priority over Hubs**: Because the string `escalation_tasks` contains the word `tasks` (and potentially `hub` if the user names it `hub_escalations`), the order in `VERTICAL_BOARD_MAP` matters. The more specific key (`escalation`) should ideally come before the more general key (`hub`) to ensure correct matching.

- **Deduplication**: When manually adding boards, always wrap them in `[...new Set(boards)]` to prevent duplicate board entries.
- **Case Sensitivity**: Always `.toLowerCase()` keys and values before comparison.
- **Defaulting**: Never let `task_board` be null; always default to `['Hubs']` for Hub-related verticals.

---

## 5. Verification Workflow

### 5.1 Unit Verification (Console/Scratch Script)
Run a script to verify the mapping logic works as expected for various vertical IDs.

```javascript
// Verification Script
const testVids = ['CHARGING_HUBS', 'ESCALATION_TASKS', 'DAILY_HUB_TASKS'];
const map = { 'daily_hub': 'Hubs Daily', 'escalation': 'Escalations', 'hub': 'Hubs' };

testVids.forEach(vid => {
  const matchedKey = Object.keys(map).find(key => vid.toLowerCase().includes(key));
  const result = matchedKey ? [map[matchedKey]] : ['Hubs'];
  console.log(`Input: ${vid} -> Output Board:`, result);
});
```

### 5.2 Database Integrity Check
After implementing, create a task through the UI (or a mock service call) and verify the row in Supabase.

**SQL Query**:
```sql
SELECT id, text, vertical_id, task_board 
FROM tasks 
WHERE text = 'Escalation Test Task' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 6. Troubleshooting & Gotchas

| Issue | Potential Cause | Fix |
| :--- | :--- | :--- |
| **Mapped to 'Hubs' instead of 'Escalations'** | Keyword order in `VERTICAL_BOARD_MAP` is wrong. | Move `'escalation'` above `'hub'`. |
| **Empty `task_board`** | `resolvedVid` didn't match any key. | Add a fallback or ensure the keyword exists in the `verticalId`. |
| **Duplicate Boards** | Mapping logic ran twice. | Add a `.filter(Boolean)` and `Set` wrapper. |

---

## 7. Rollback Plan
1. Remove the `'escalation'` key from `VERTICAL_BOARD_MAP`.
2. Any tasks created during the window will remain in the database but will likely default to the "Hubs" board during the next "Fix Tasks" run.

---

## 8. Progress Tracking
- [ ] Step 3.1: `VERTICAL_BOARD_MAP` updated.
- [ ] Step 3.2: Logic review confirmed.
- [ ] Step 5: Mapping verification complete.

**Next Runbook**: `03_DATA_FILTERING_AND_STATE.md`
