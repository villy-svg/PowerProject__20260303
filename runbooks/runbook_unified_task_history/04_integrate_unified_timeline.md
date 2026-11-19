# Runbook 4: Integrate Unified Timeline into `SubmissionHistory.jsx`

**Impact:** Medium (modifies existing UI component `SubmissionHistory.jsx`)  
**Target File:** `src/components/tasks/SubmissionHistory.jsx`  
*(Read-only check of consumers: `src/verticals/ChargingHubs/HubTaskForm.jsx`, `src/verticals/Employees/EmployeeRemarkForm.jsx`)*

---

## 1. Objective
Wire Runbooks 1, 2, and 3 into `SubmissionHistory.jsx` so the tab renders a **unified, newest-first Task & Submission History timeline** while preserving 100% of existing submission, approval/rejection, bank-update, and employee-deactivation functionality.

---

## 2. Exact Logic to Build

### 2.1 Parallel, Fault-Isolated Data Fetching
Replace the single `getSubmissionsForTask(taskId)` call with `Promise.allSettled`:
```js
const [subResult, histResult] = await Promise.allSettled([
  getSubmissionsForTask(taskId),
  getTaskHistory(taskId),
]);
```
- **Hard guarantee:** If `getTaskHistory(taskId)` rejects or returns `degraded: true` (for example, before Runbook 5's DB migration is applied), `submissions` still load and render normally.
- Track a request counter / mounted ref (`fetchSeqRef`) so stale responses from a previously opened task can never overwrite the currently open task.

### 2.2 Timeline Assembly & Filter State
- Add filter state: `const [activeFilter, setActiveFilter] = useState('all');` (`'all' | 'submissions' | 'changes'`).
- Compute `unifiedTimeline` via `useMemo` calling `mergeUnifiedTimeline({ submissions, historyRows, lookupMaps, task, currentUser })`.
- Apply `activeFilter`:
  - `'all'` → all items (newest at top)
  - `'submissions'` → `item.kind === 'submission'`
  - `'changes'` → `item.kind === 'history'`
- **Auto-expand behavior:** Keep the existing UX where the newest **submission** (`sub_<id>`) is auto-expanded on initial load (if one exists), while history rows start collapsed so the timeline stays scannable.

### 2.3 Refreshing After Approve / Reject (Why Latest-at-Top Works Automatically)
When a manager clicks **Approve** or **Reject** on a submission (or approves/rejects a Bank Update / Deactivation request):
1. `updateSubmissionStatus(...)` updates `public.submissions`.
2. `await onStatusUpdate(submissionId, newStatus)` triggers the parent handler (`onSubmissionReview`), which moves the task stage in `public.tasks` (triggering `trg_audit_tasks` → inserting a new `UPDATE` row into `public.tasks_history`).
3. **Critical step:** If the modal stays open after `onStatusUpdate`, re-fetch `fetchTimeline()` so the new stage-transition row (`REVIEW → COMPLETED` or `REVIEW → IN_PROGRESS`) immediately appears at the very top of the unified timeline above the submission card!

### 2.4 Header, Badges & Empty States
- Update header title to **Task & Submission History** (or **Activity & Submissions**).
- Render filter pills (`All (N)`, `Submissions (M)`, `Changes (K)`) in the header when there is at least 1 timeline item (or hide `Changes` count if `degraded === true`).
- **Keep `onCountLoad(submissions.length)` unchanged** so parent tab counters in `HubTaskForm.jsx` and `EmployeeRemarkForm.jsx` continue reflecting proof-of-work submission counts without unexpected jumps.
- Update the empty-state guard: only show `"No activity or submissions yet."` when `unifiedTimeline.length === 0 && !bankUpdatePayload && !deactivationPayload`.
- If the user clicks the `Submissions` filter on a task that has history edits but 0 submissions, show a filter-specific empty message (`"No proof-of-work submissions yet."`) instead of hiding the filter bar.

---

## 3. Corner Cases & Potential Bugs
1. **Stale closure / stale `expandedId` across task switches:** When `taskId` changes (switching between tasks in the same modal), reset `expandedId` to `null` and `activeFilter` to `'all'` before fetching so the new task auto-expands its own latest submission cleanly.
2. **Double-tap / in-flight guard (`inFlightRef`):** Do NOT weaken or remove `inFlightRef` on `handleStatusUpdate`, `handleBankApproval`, or `handleDeactivationApproval`.
3. **Bank Update & Employee Deactivation tasks:**
   - These tasks encode JSON in `task.description`. Because Runbook 1 redacts structured JSON diffs, the timeline will cleanly show `"Created task"` and `"Moved stage from REVIEW → COMPLETED"` alongside the pinned approval card at the top—never leaking raw bank account JSON into the timeline.
4. **Parent modal closes immediately on `onStatusUpdate`:** If `onStatusUpdate` unmounts `SubmissionHistory`, calling `setState` after `await onStatusUpdate()` on an unmounted component is a classic React bug. Guard with an `isMountedRef` before calling `fetchTimeline()` post-update.
5. **Re-fetching history when the task itself is edited in Tab 1 (`Details`) and user switches to Tab 2 (`History`):**
   - In `HubTaskForm.jsx` / `EmployeeRemarkForm.jsx`, `SubmissionHistory` mounts when switching to the History tab, which automatically triggers `useEffect` and fetches fresh history. If a consumer ever keeps `SubmissionHistory` mounted while `task.updated_at` changes, include `task?.updated_at` (or `task?.updatedAt`) in the fetch dependency or refresh trigger so edits immediately show up.
6. **Pre-migration deployment safety:** Between deploying Runbook 4 and Runbook 5, non-admins (and admins) will get `degraded: true` / `[]` from `getTaskHistory`. Verify that the UI looks completely clean (no broken empty filter pills, no error toasts, submissions work 100%).

---

## 4. Potential Future Needs
- **Pagination UI ("Load older activity"):** If a task has >100 history rows, render a `"Show older updates"` button at the bottom of the timeline calling `getTaskHistory(taskId, { beforeTimestamp })`.
- **Realtime updates:** In the future, a Supabase Realtime subscription on `tasks_history` filtered by `task_id=eq.${taskId}` could push live collaborator edits into the open modal without manual refresh.
- **Reusable across Employee Documents / Daily Tasks:** Keeping `SubmissionHistory` driven by normalized `UnifiedTimelineItem`s makes it straightforward to reuse the same timeline pattern for `daily_tasks` later.
