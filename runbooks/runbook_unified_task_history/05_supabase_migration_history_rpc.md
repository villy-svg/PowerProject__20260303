# Runbook 5 (LAST): Supabase Migration — Index & Scoped Read RPC

**Impact:** Highest (Database schema / index / RPC — deploy to **staging** first, verify all roles, then production)  
**Target Files:**
- `supabase/migrations/<TIMESTAMP>_task_activity_timeline_rpc.sql` (new single atomic migration)
- `supabase/migrations/20260101000000_DATABASE_INDEX.sql` (register new index & RPC)

---

## 1. Objective
Unlock fast, secure, non-admin-safe read access to `public.tasks_history` for any user who is authorized to view a given task—**without** loosening table-level RLS on `public.tasks_history` and **without** exposing sensitive `client_info` (IP addresses / user agents) to non-admin users.

---

## 2. Exact Logic to Build

### 2.1 Composite Performance Index
Currently, `public.tasks_history` has no index on `task_id`. Every per-task query would do a sequential scan.
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_history_task_id_changed_at
  ON public.tasks_history USING btree (task_id, changed_at DESC);
```

### 2.2 Scoped Read RPC: `public.get_task_activity_timeline(p_task_id uuid, p_limit int DEFAULT 100, p_before timestamptz DEFAULT NULL)`
**Why an RPC instead of opening `tasks_history` RLS directly?**
1. `tasks_history` contains `client_info` (`{ ip, user_agent }`), which is private admin telemetry and must **not** be readable by regular contributors/viewers.
2. An RPC lets us join `public.user_profiles` cleanly and return a lean, stable contract (`id`, `task_id`, `source_type`, `action`, `entity_id`, `old_payload`, `new_payload`, `actor_id`, `actor_name`, `actor_email`, `changed_at`) with `client_info` omitted.

**Authorization Gate Inside the RPC (Critical Security Design):**
- Do **NOT** blindly query `tasks_history` inside a `SECURITY DEFINER` function without verifying the caller's access to `p_task_id`!
- **Recommended 2-step pattern:**
  - Create a lightweight `SECURITY INVOKER` wrapper (or check inside an `INVOKER` helper) that runs:
    ```sql
    SELECT EXISTS (SELECT 1 FROM public.tasks WHERE id = p_task_id)
    ```
    Because it executes as `SECURITY INVOKER`, PostgreSQL automatically enforces **all existing `public.tasks` RLS policies** (vertical RBAC + Sphere of Influence + hub/assignee rules) with **zero duplicated policy logic**!
  - Only if that `INVOKER` check returns `TRUE` does it call the internal `SECURITY DEFINER` reader (or execute the `tasks_history` query) to return the sanitized rows.
  - If the caller cannot see `p_task_id` in `public.tasks`, return **0 rows** (never reveal whether the task exists).

### 2.3 Permissions & `search_path` Hardening
- Set `SET search_path = public` on any `SECURITY DEFINER` function (prevents search-path hijacking).
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC;`
- `GRANT EXECUTE ON FUNCTION public.get_task_activity_timeline(uuid, int, timestamptz) TO authenticated;`
- Clamp `p_limit` safely inside the function: `LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250)` so no client can request 1,000,000 rows.

### 2.4 Update `DATABASE_INDEX.sql`
Add the new index and RPC entry to `supabase/migrations/20260101000000_DATABASE_INDEX.sql` per the Database Migration Policy.

---

## 3. Corner Cases & Potential Bugs
1. **Impersonation mode in PowerProject:**
   - Remember that PowerProject's admin impersonation runs in the frontend using the admin's real Supabase JWT (unless using scoped tokens), meaning `auth.uid()` is the real signed-in user. The `SECURITY INVOKER` check against `public.tasks` behaves identically to how `public.tasks` itself behaves during impersonation—consistent and predictable.
2. **Deleted tasks (`action = 'DELETE'`):**
   - If a task is deleted from `public.tasks`, `EXISTS (SELECT 1 FROM public.tasks WHERE id = p_task_id)` returns `FALSE`, so regular users cannot query history of deleted tasks (good for security). Master admins still have direct table-level `SELECT` via `"tasks_history Admin Read"` if they ever need forensic recovery.
3. **`SECURITY DEFINER` vs `SECURITY INVOKER` pitfall:**
   - A common Postgres bug is writing `EXISTS (SELECT 1 FROM public.tasks ...)` *directly inside* a `SECURITY DEFINER` function—inside `SECURITY DEFINER`, RLS is bypassed for the function owner (`postgres`), so the check would ALWAYS return `TRUE` for any authenticated user!
   - **Mandatory fix:** The `public.tasks` visibility check MUST run in a `SECURITY INVOKER` function, which then delegates to a private `SECURITY DEFINER` helper (with `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` on the private helper—or better yet, `public.get_task_activity_timeline` is `SECURITY INVOKER` and only calls a restricted internal helper, wait: if `authenticated` can't call the helper directly, the `INVOKER` wrapper wouldn't be able to call it either! So instead: inside the `SECURITY DEFINER` function, either verify via `public.can_user_view_task(p_task_id)` if one exists, OR check the exact RLS helper functions already used on `public.tasks`—we MUST inspect `public.tasks` SELECT RLS policy in `supabase/migrations/` before writing the SQL in Runbook 5!).
   - *Action item before executing Runbook 5:* Read the active `SELECT` RLS policy on `public.tasks` and verify the exact helper function / condition it uses so there is zero authorization gap.
4. **Sensitive fields inside `old_payload` / `new_payload`:**
   - `tasks_history` stores `description` in `old_payload`/`new_payload`. Anyone who can already `SELECT` that task from `public.tasks` can already read `tasks.description`, so access parity matches `public.tasks`. Still, stripping `client_info` in the RPC ensures IP/User-Agent is never leaked.
5. **Migration parity (Staging → Production):**
   - Test on staging with 3 real roles: `master_admin`, vertical `editor`, and `viewer`/`contributor` (including a user who does **NOT** have access to a task in another vertical, confirming they receive `0` rows).
   - Verify `EXPLAIN ANALYZE` uses `idx_tasks_history_task_id_changed_at` (Index Scan, not Seq Scan).

---

## 4. Potential Future Needs
- **Archiving / Retention of `tasks_history`:** Because `tasks_history` grows on every task edit, the new `(task_id, changed_at DESC)` index also supports future Hot-Cold archival or retention policies (e.g., archiving history rows older than 12 months).
- **Separate Admin Forensic RPC:** If Master Admins later need an Audit Log screen showing `client_info` (IP/User-Agent) across all tasks, keep `"tasks_history Admin Read"` intact for that—do not mix admin telemetry into the general task timeline RPC.
- **Submission review trigger (optional future):** If you ever want approval/rejection of a submission that does *not* change the task stage to also produce a history entry, a lightweight `AFTER UPDATE OF status ON public.submissions` trigger can insert into `tasks_history` and will automatically appear in this same RPC with zero frontend changes.
