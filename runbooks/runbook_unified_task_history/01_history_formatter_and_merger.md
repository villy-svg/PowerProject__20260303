# Runbook 1: Pure History Formatter & Unified Timeline Merger

**Impact:** Zero (isolated pure utility module, not imported anywhere yet)  
**Target File:** `src/utils/taskHistoryFormatter.js` (new)

---

## 1. Objective
Build a pure, side-effect-free transformation module that converts raw `public.tasks_history` rows and `public.submissions` rows into a clean, human-readable, newest-first `UnifiedTimelineItem[]` array.

---

## 2. Exact Logic to Build

### 2.1 Noise Column Filtering
Maintain an explicit `IGNORED_HISTORY_FIELDS` set:
- `updated_at`, `updatedat`
- `last_updated_by`
- `created_at`, `createdat`
- `user_id`

For `action === 'UPDATE'`:
1. Intersect keys of `new_payload` (and `old_payload`), removing any key in `IGNORED_HISTORY_FIELDS`.
2. If zero meaningful keys remain, **drop the row**.

### 2.2 Burst-Collapse for `task_context_links` Delete-and-Reinsert Syncs
In `src/services/tasks/taskService.js` (around line 74), updating context links executes `DELETE` on all links for `(source_id, source_type, entity_type)` followed by `INSERT` of the new set. `trg_audit_tcl` logs a `LINK_REMOVE` for every existing link and a `LINK_ADD` for every link in the new set—even unchanged ones.

**Collapse Algorithm:**
1. Group consecutive `LINK_REMOVE` / `LINK_ADD` events by `(actor_id, entity_type)` within a tight time window (e.g., `<= 2500ms`).
2. Within each burst, build a map keyed by `entity_id`:
   - If the same `entity_id` has **both** `LINK_REMOVE` and `LINK_ADD` in the same burst → **cancel both out** (it was an unchanged link re-inserted during sync).
   - Keep only the **net added** and **net removed** `entity_id`s.
3. This turns a noisy 7-row burst into a single clean `"Linked hub: Koramangala"` event.

### 2.3 Sensitive / Structured Field Redaction
- **`description` containing internal JSON payloads** (`"BANK_UPDATE"` or `"EMPLOYEE_DEACTIVATION"`):
  - Never print raw JSON (which contains bank account numbers, IFSC, PAN) in the timeline diff.
  - Display `"Updated structured request details"` instead.
- **`metadata` / `task_board` JSONB columns:**
  - Never dump raw JSON strings inline. Map known keys if present, or summarize as `"Updated task metadata"` / `"Updated board placement"`.

### 2.4 Human-Readable Action Formatting
Given a `lookupMaps` object (`{ users, employees, hubs, clients, partners, vendors, stages }`):
- **`INSERT`:** Summary `"Created task"` (details drawer shows initial Stage, Priority, Assignee if present).
- **`UPDATE` (1 changed field):** Inline human sentence:
  - `stage_id` / `stageid`: `"Moved stage from Backlog → In Progress"`
  - `priority`: `"Changed priority from Medium → High"`
  - `assigned_to`: `"Reassigned from Alice → Bob"` (or `"Assigned to Bob"` / `"Unassigned from Alice"`)
  - `hub_id`: `"Changed hub from Hub A → Hub B"`
  - `text`: `"Renamed task"` (expandable diff shows old title → new title)
  - `description`: `"Updated description"` (expandable diff, truncated preview with full text on expand)
  - `city`, `function`, `parent_task_id`: clean labeled `Old → New`
  - Unknown future columns: fallback `"Updated <snake_case converted to Title Case>"` so adding new columns to `tasks` never crashes the formatter.
- **`UPDATE` (multiple changed fields):** Summary `"Updated N fields"` (e.g. `"Updated 3 fields: Stage, Priority, Assignee"`) with expandable `Before → After` list.
- **`LINK_ADD` / `LINK_REMOVE`:** `"Linked <entity_type>: <resolvedName>"` / `"Unlinked <entity_type>: <resolvedName>"`.
- **`DELETE`:** `"Deleted task"`.

### 2.5 Legacy Task Synthetic Anchor
Tasks created before `2026-04-29` (when `tasks_history` was created) have no `INSERT` audit row.
- If the history list does **not** contain an `action === 'INSERT'` row, and `task?.created_at` (or `task?.createdAt`) exists:
  - Synthesize a single event: `{ id: 'synth_created_' + task.id, kind: 'history', timestamp: task.created_at, actorId: task.created_by, summary: 'Created task', isSynthetic: true }`.

### 2.6 Unified Merge & Tie-Breaking Sort (Latest at Top)
1. Normalize `submissions[]` (`kind: 'submission'`, `timestamp: s.created_at`) and formatted `history[]` (`kind: 'history'`, `timestamp: h.changed_at`).
2. Sort descending by `sortKey = Date.parse(timestamp) || 0`.
3. **Deterministic tie-breaker** when a submission and a stage move (`moveToReview = true`) share the exact same millisecond:
   - Place `history` stage-change (`REVIEW`) **above** the `submission` that triggered it (or order by `kind` weight) so the causal sequence reads top-down as *"Moved to Review → Submitted Proof #2"*.

---

## 3. Corner Cases & Potential Bugs
1. **Null / malformed JSON payloads:** Older or edge-case rows could have `old_payload: null` or `new_payload: null`. Always guard with `row.old_payload ?? {}` and `row.new_payload ?? {}`.
2. **Legacy camelCase vs standardized snake_case keys:** `tasks` columns were renamed in `20260423102600_standardize_task_schemas.sql` (`stageid → stage_id`, `verticalid → vertical_id`, `parent_task → parent_task_id`, `createdat → created_at`). Support both key spellings in the formatter map so any legacy payload still renders cleanly.
3. **Duplicate display of `assigned_to` + `task_context_links (entity_type: 'assignee')`:** When a task's assignee changes, both `tasks.assigned_to` (`UPDATE`) and `task_context_links` (`LINK_ADD`/`LINK_REMOVE` for `assignee`) may fire within milliseconds.
   - **Fix:** If an `UPDATE` on `assigned_to` occurs within `2500ms` of a matching `assignee` `LINK_ADD`/`LINK_REMOVE` by the same actor for the same UUID, suppress the redundant `LINK_*` row so the user sees one clean `"Reassigned"` event instead of two.
4. **`actor_id === null`:** Automated actions (cron jobs, Edge Functions like `public-support-request`, service-role updates, or `ON DELETE SET NULL`) produce `actor_id = null`. Display `"System"` (or `"Public Submission"` when appropriate) instead of crashing or showing `"Unknown"`.
5. **Invalid or missing timestamps:** `Date.parse(null)` returns `NaN`, which breaks `Array.prototype.sort` stability. Always coalesce `Number.isFinite(ts) ? ts : 0`.
6. **Extremely long descriptions:** Truncate inline previews to ~120 chars and render full text safely as plain text (never `dangerouslySetInnerHTML`) to prevent layout blowouts and XSS.

---

## 4. Potential Future Needs
- **Submission review audit events:** If `public.submissions` later logs `reviewed_at`/`reviewed_by` or gets its own trigger, the normalized `UnifiedTimelineItem` contract accepts new `kind` or `eventType` values without rewriting the sort/merge layer.
- **Task comments / mentions:** Future comment rows can be plugged straight into `mergeUnifiedTimeline({ submissions, history, comments })`.
- **CSV / PDF audit export:** Because this module is pure JS with no React dependencies, the exact same formatter can power an admin "Export Task Audit Trail" button later.
- **Date-group bucketing helper:** Include a pure `groupTimelineByDate(items)` helper (e.g., `"Today"`, `"Yesterday"`, `"18 Nov 2026"`) so Runbook 3/4 can toggle date dividers effortlessly.
