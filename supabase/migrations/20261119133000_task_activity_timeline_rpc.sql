-- =========================================================================
-- POWERPROJECT: Unified Task Activity Timeline Index & Scoped Read RPC
-- Migration: 20261119133000_task_activity_timeline_rpc.sql
--
-- Skill compliance:
--   database-migration-policy §2 (Idempotent), §3 (Timestamped file),
--                             §5 (PostgreSQL Kick)
--   rbac-security-system §3 (Authorization inside SECURITY DEFINER RPC)
--
-- SUMMARY OF WHAT THIS MIGRATION DOES
--   1. Adds composite B-Tree index `idx_tasks_history_task_id_changed_at`
--      on `public.tasks_history (task_id, changed_at DESC, id DESC)` so
--      per-task timeline and keyset-paginated queries use an Index Scan.
--   2. Creates `public.get_task_activity_timeline(p_task_id, p_limit,
--      p_before, p_before_id)` as a hardened `SECURITY DEFINER` RPC
--      (`SET search_path = public`) that:
--      - Enforces active-user + task visibility parity with `public.tasks`
--        SELECT RLS (vertical RBAC + employee assignee + task_context_links
--        + multi-hub junction) without opening `public.tasks_history` RLS.
--      - Joins `public.user_profiles` for actor attribution (`actor_name`,
--        `actor_email`) and strips private `client_info` (IP / User-Agent).
--      - Clamps `p_limit` to [1, 250] and supports lossless keyset cursor
--        pagination via `(p_before, p_before_id)`.
-- =========================================================================

-- 1. Composite Performance Index on public.tasks_history
CREATE INDEX IF NOT EXISTS idx_tasks_history_task_id_changed_at
  ON public.tasks_history USING btree (task_id, changed_at DESC, id DESC);

-- 2. Scoped Read RPC (Sanitized, RLS-Parity Authorized, Keyset-Paginated)
-- Drop legacy 3-arg signature if present so PostgREST never sees ambiguous overloads
DROP FUNCTION IF EXISTS public.get_task_activity_timeline(uuid, integer, timestamptz);

CREATE OR REPLACE FUNCTION public.get_task_activity_timeline(
  p_task_id   uuid,
  p_limit     integer     DEFAULT 100,
  p_before    timestamptz DEFAULT NULL,
  p_before_id uuid        DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  task_id     uuid,
  source_type text,
  action      text,
  entity_id   uuid,
  old_payload jsonb,
  new_payload jsonb,
  actor_id    uuid,
  actor_name  text,
  actor_email text,
  changed_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid := auth.uid();
  v_task       record;
  v_authorized boolean := false;
  v_safe_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
BEGIN
  -- Reject unauthenticated callers or missing task IDs silently (0 rows)
  IF v_caller_id IS NULL OR p_task_id IS NULL THEN
    RETURN;
  END IF;

  -- Enforce active-user gate
  IF NOT (public.is_master_admin() OR public.is_active_user()) THEN
    RETURN;
  END IF;

  -- Fetch target task metadata; deleted/non-existent tasks return 0 rows
  -- (Master admins retain direct table-level forensic read via "tasks_history Admin Read")
  SELECT t.id, t.vertical_id, t.assigned_to
  INTO v_task
  FROM public.tasks t
  WHERE t.id = p_task_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Authorization parity with public.tasks SELECT RLS policies:
  --   1. Master Admin override
  --   2. Vertical RBAC ("Permit SELECT based on role")
  --   3. Direct assignment via linked employees.id (tasks.assigned_to -> employees.id)
  --   4. Active assignee link in task_context_links ("Permit SELECT based on hybrid junction")
  --   5. Multi-hub / role junction ("check_task_junction")
  v_authorized := (
    public.is_master_admin()
    OR public.get_user_permission_level(v_task.vertical_id) IN ('viewer', 'contributor', 'editor', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = v_caller_id
        AND up.employee_id IS NOT NULL
        AND up.employee_id = v_task.assigned_to
    )
    OR EXISTS (
      SELECT 1
      FROM public.task_context_links tcl
      JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
      WHERE tcl.source_id = v_task.id
        AND tcl.entity_type = 'assignee'
        AND tcl.is_active = true
        AND up.id = v_caller_id
    )
    OR public.check_task_junction(v_task.id)
  );

  IF NOT v_authorized THEN
    RETURN;
  END IF;

  -- Return sanitized timeline rows (client_info intentionally omitted)
  -- Keyset filter on (changed_at, id) prevents skipping same-transaction ties
  RETURN QUERY
  SELECT
    th.id,
    th.task_id,
    th.source_type,
    th.action,
    th.entity_id,
    th.old_payload,
    th.new_payload,
    th.actor_id,
    up.name  AS actor_name,
    up.email AS actor_email,
    th.changed_at
  FROM public.tasks_history th
  LEFT JOIN public.user_profiles up ON up.id = th.actor_id
  WHERE th.task_id = p_task_id
    AND (
      p_before IS NULL
      OR th.changed_at < p_before
      OR (p_before_id IS NOT NULL AND th.changed_at = p_before AND th.id < p_before_id)
    )
  ORDER BY th.changed_at DESC, th.id DESC
  LIMIT v_safe_limit;
END;
$$;

-- 3. Restrict Execute Permissions
REVOKE ALL ON FUNCTION public.get_task_activity_timeline(uuid, integer, timestamptz, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_task_activity_timeline(uuid, integer, timestamptz, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_task_activity_timeline(uuid, integer, timestamptz, uuid) TO authenticated;

COMMENT ON FUNCTION public.get_task_activity_timeline(uuid, integer, timestamptz, uuid) IS
  'Returns sanitized tasks_history rows for a task (omitting client_info) if the authenticated caller is authorized to view the task.';

-- 4. Evolution Ledger Log
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20261119133000_task_activity_timeline_rpc',
  'Unified Task History Runbook 5: Added composite index idx_tasks_history_task_id_changed_at on tasks_history(task_id, changed_at DESC, id DESC) and scoped SECURITY DEFINER RPC public.get_task_activity_timeline(p_task_id, p_limit, p_before, p_before_id) enforcing tasks SELECT RLS parity with lossless keyset pagination while stripping client_info.',
  ARRAY['tasks_history']
)
ON CONFLICT DO NOTHING;

-- 5. PostgreSQL Kick (refresh PostgREST schema cache)
NOTIFY pgrst, 'reload schema';
