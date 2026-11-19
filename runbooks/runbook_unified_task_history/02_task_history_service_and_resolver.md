# Runbook 2: Read-Only Task History Service & Batched UUID Resolver

**Impact:** Zero (new read-only service file, not imported anywhere yet)  
**Target File:** `src/services/tasks/taskHistoryService.js` (new)

---

## 1. Objective
Create a resilient, read-only service that fetches `public.tasks_history` rows for a task via the Runbook 5 RPC and resolves all referenced UUIDs (users, employees, hubs, clients, partners, vendors) into human-readable names in minimal round-trips.

---

## 2. Exact Logic to Build

### 2.1 `getTaskHistory(taskId, options = {})`
1. Guard: if `!taskId`, return `{ rows: [], lookupMaps: emptyMaps, degraded: false }`.
2. Call `supabase.rpc('get_task_activity_timeline', { p_task_id: taskId, p_limit: options.limit ?? 100 })`.
3. **Graceful Pre-Migration & Permission Fallback:**
   - If the RPC returns PostgreSQL error `42883` (`function does not exist` — before Runbook 5 is deployed) or `PGRST202` (PostgREST schema cache miss) or `42501` (insufficient privilege):
     - Log a single `console.warn(...)` (never `alert`, never throw).
     - Return `{ rows: [], lookupMaps: emptyMaps, degraded: true }`.
   - This guarantees Runbook 4 can be deployed to production **before** Runbook 5 without any user-facing error.

### 2.2 Batched UUID Collector (`extractReferencedIds(rows)`)
Scan all returned `rows` once to collect unique UUIDs grouped by entity table:
- **User profiles / Employees (`assigned_to`, `created_by`, `entity_type === 'assignee' | 'employee'`):** collect into `userIds` / `employeeIds`.
- **Hubs (`hub_id`, `entity_type === 'hub'`):** collect into `hubIds`.
- **Clients (`entity_type === 'client'`):** collect into `clientIds`.
- **Partners / Vendors (`entity_type === 'partner' | 'vendor'`):** collect into `partnerIds` / `vendorIds`.

### 2.3 Batched Name Resolution (`resolveEntityNames(idBuckets)`)
- Only query tables whose bucket is non-empty! (If a task only has stage and priority changes, make **zero** extra lookup queries.)
- Run all needed `.in('id', ids)` queries in parallel via `Promise.allSettled` so a failure or RLS restriction on one lookup table (e.g., `clients`) never breaks resolution for `hubs` or `employees`.
- **Module-level TTL cache (e.g., 5 minutes):** Cache resolved `id -> name` maps in memory keyed by table (`hubs`, `employees`, `user_profiles`, etc.) so opening multiple tasks in a session avoids redundant Supabase queries.
- **Fallback for deleted or unreadable records:** If a UUID is not returned by the lookup query (hard-deleted row or RLS-hidden), fall back to `"Former Member"` / `"Deleted Hub"` / short ID (`#a1b2c3`) rather than showing a raw 36-character UUID.

---

## 3. Corner Cases & Potential Bugs
1. **`assigned_to` vs `employees` vs `user_profiles` ID mismatch:**
   - Verify whether `tasks.assigned_to` and `task_context_links (entity_type = 'assignee')` store `employees.id` or `user_profiles.id` (in `20260101000002_foreign_keys_indexes.sql`, check the exact FK target!).
   - **Prevention:** Resolve against the exact FK table first, and if missing, optionally check the fallback table so neither employee-ID nor user-profile-ID links ever render as raw UUIDs.
2. **Large `.in()` arrays:** If a heavily edited task references 100+ unique UUIDs over months, chunk `.in()` queries in batches of 50 to avoid PostgREST URL length limits.
3. **Impersonation / Auth Switching:**
   - Because PowerProject supports admin impersonation (`AuthContext`), an in-memory cache could leak names across sessions if not careful, or return stale names after an employee rename.
   - **Fix:** Keep cache TTL short (2–5 min) and expose a `clearTaskHistoryCache()` helper (or only cache immutable/non-sensitive display names).
4. **Race conditions on rapid task switching:** If a user opens Task A, closes it, and opens Task B before Task A's fetch resolves, stale results could overwrite state.
   - **Fix:** Support an `AbortSignal` or request-ID check in the consumer (Runbook 4) and keep `getTaskHistory` stateless per call.
5. **Non-UUID strings in legacy payloads:** Validate strings with a UUID regex before passing them into `.in('id', ...)` so Postgres never throws `22P02: invalid input syntax for type uuid`.

---

## 4. Potential Future Needs
- **Pagination ("Load older history"):** Accept `{ limit = 100, beforeTimestamp = null }` in `getTaskHistory` from day one so very old/long-lived tasks can load older pages without refactoring the service signature.
- **Server-side name resolution:** In the future, if entity resolution becomes heavy, the RPC in Runbook 5 can return pre-resolved names in a JSONB field, and `taskHistoryService.js` can skip client-side lookups for any ID already present in the RPC response.
- **Daily Tasks & Templates:** `tasks_history` already has a `source_type` column (`'task'`, `'daily_task'`, `'template'`). Accepting an optional `sourceType = 'task'` parameter makes this service reusable for Daily Tasks later.
