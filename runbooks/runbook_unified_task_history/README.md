# Runbooks: Unified Task & Submission History Timeline

## Goal
Upgrade the existing `SubmissionHistory` tab in task modals (`HubTaskForm.jsx`, `EmployeeRemarkForm.jsx`) from showing **only** proof-of-work submissions (`public.submissions`) to showing a **unified, chronological Task & Submission History timeline** combining `public.submissions` and `public.tasks_history`, sorted **latest update at the top**.

Because the unified timeline is sorted newest-first, stage changes triggered by approving or rejecting a submission (e.g., `REVIEW → COMPLETED` or `REVIEW → IN_PROGRESS`) automatically appear directly above the submission with exact timestamps and actor attribution.

---

## Execution Order (Lowest Impact First → Migrations Last)

Every runbook is designed to be **independently mergeable and deployable** without breaking production at any intermediate step.

| Order | Runbook | Target Area | Impact / Risk | Live State After Completion |
|---|---|---|---|---|
| **1** | [01_history_formatter_and_merger.md](./01_history_formatter_and_merger.md) | `src/utils/taskHistoryFormatter.js` (new) | **Zero** (pure functions, unused) | Unchanged |
| **2** | [02_task_history_service_and_resolver.md](./02_task_history_service_and_resolver.md) | `src/services/tasks/taskHistoryService.js` (new) | **Zero** (read-only service, unused) | Unchanged |
| **3** | [03_history_event_row_ui.md](./03_history_event_row_ui.md) | `src/components/tasks/TaskHistoryEventRow.jsx` (new) + `SubmissionHistory.css` | **Zero** (unmounted component + additive CSS) | Unchanged |
| **4** | [04_integrate_unified_timeline.md](./04_integrate_unified_timeline.md) | `src/components/tasks/SubmissionHistory.jsx` | **Medium** (existing UI) | Unified UI live; gracefully falls back to submissions-only until Runbook 5 lands |
| **5** | [05_supabase_migration_history_rpc.md](./05_supabase_migration_history_rpc.md) | `supabase/migrations/` + `DATABASE_INDEX.sql` | **Highest** (DB index + RPC) | Full task history unlocks for all authorized users |

---

## Shared Timeline Event Contract (Cross-Runbook Interface)

All runbooks agree on a single normalized shape for timeline items:

```js
/**
 * @typedef {Object} UnifiedTimelineItem
 * @property {string} id            - Prefixed unique key: `sub_<uuid>` | `hist_<uuid>` | `synth_created_<taskId>`
 * @property {'submission'|'history'} kind
 * @property {string} timestamp     - ISO-8601 string (`created_at` or `changed_at`)
 * @property {number} sortKey       - Numeric epoch ms (`Date.parse(timestamp) || 0`)
 * @property {string|null} actorId  - `submitted_by` or `actor_id`
 * @property {string} actorName     - Resolved display name (or `'YOU'`, `'System'`, `'Unknown'`)
 * @property {Object} data          - Raw submission object (for `submission`) OR FormattedHistoryEvent (for `history`)
 */
```

Prefixing `id` with `sub_` / `hist_` / `synth_` prevents React key collisions and guarantees `expandedId` accordion state never collides between a submission and a history row.

---

## Rollback Strategy
- **Runbooks 1–3:** Delete the newly added files (zero references in production code).
- **Runbook 4:** Revert `SubmissionHistory.jsx` (submissions continue working untouched).
- **Runbook 5:** Drop the RPC (`DROP FUNCTION IF EXISTS public.get_task_activity_timeline(uuid);`); because Runbook 2 catches missing-RPC errors and returns `[]`, the frontend degrades cleanly to submissions-only with zero crash.
