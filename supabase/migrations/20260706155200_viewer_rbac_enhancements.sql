-- =========================================================================
-- POWERPROJECT: Viewer RBAC Enhancements + Escalation Support + RPC Fix
-- Migration: 20260706155200_viewer_rbac_and_escalation_fix.sql
--
-- Merges (replaces):
--   20260706155200_viewer_rbac_enhancements.sql
--   20260706182000_allow_viewers_escalations.sql
--   20260707100000_fix_orchestrate_scalar_bug.sql
--
-- Skill compliance:
--   rbac-security-system     §3  (Standard RLS Pattern)
--   database-migration-policy §2 (Repair-Safe Idempotency)
--   database-migration-policy §5 (PostgreSQL Kick)
-- =========================================================================


-- =========================================================================
-- 1. Decommission legacy `daily_tasks` table and related dependencies
-- =========================================================================

-- A. Clean up orphaned polymorphic records (Idempotent — DELETE is always safe)
DELETE FROM public.task_context_links WHERE source_type = 'daily_task';

-- B. SECURITY DEFINER helper: fetches vertical_id from tasks bypassing RLS.
--    This breaks the recursion cycle:
--      tcl RLS → tasks subquery → tasks RLS → tcl RLS → ∞
--    By using SECURITY DEFINER the subquery runs as the function owner and
--    never re-enters the caller's RLS evaluation stack.
--    (CREATE OR REPLACE is idempotent by definition)
CREATE OR REPLACE FUNCTION public.get_task_vertical_id(p_task_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT vertical_id FROM public.tasks WHERE id = p_task_id LIMIT 1;
$$;

-- C. Rebuild task_context_links RLS policies using the helper (idempotent via DROP IF EXISTS)
-- CRITICAL: Must be done BEFORE dropping daily_tasks to prevent Postgres from
-- re-validating old policies that reference the now-missing table.
DROP POLICY IF EXISTS "tcl SELECT" ON public.task_context_links;
CREATE POLICY "tcl SELECT" ON public.task_context_links
FOR SELECT USING (
    (source_type = 'task'
     AND public.get_user_permission_level(public.get_task_vertical_id(source_id))
         IN ('viewer','contributor','editor','admin'))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl INSERT" ON public.task_context_links;
CREATE POLICY "tcl INSERT" ON public.task_context_links
FOR INSERT WITH CHECK (
    (source_type = 'task'
     AND public.get_user_permission_level(public.get_task_vertical_id(source_id))
         IN ('contributor','editor','admin'))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl DELETE" ON public.task_context_links;
CREATE POLICY "tcl DELETE" ON public.task_context_links
FOR DELETE USING (
    (source_type = 'task'
     AND public.get_user_permission_level(public.get_task_vertical_id(source_id))
         IN ('editor','admin'))
    OR source_type = 'template'
);

-- C. Drop legacy table (CASCADE removes dependents — idempotent via IF EXISTS)
DROP TABLE IF EXISTS public.daily_tasks CASCADE;


-- =========================================================================
-- 2. Tasks Table: Permit INSERT for Escalations by anyone (including viewers)
-- =========================================================================
DROP POLICY IF EXISTS "Permit INSERT based on role" ON public.tasks;
CREATE POLICY "Permit INSERT based on role" ON public.tasks
FOR INSERT WITH CHECK (
    public.get_user_permission_level(vertical_id) IN ('contributor','editor','admin')
    OR (
        task_board @> '["Escalations"]'::jsonb
        AND public.get_user_permission_level(vertical_id) = 'viewer'
    )
);


-- =========================================================================
-- 3. Fix infinite RLS recursion (42P17) on tasks table
-- =========================================================================
-- Root Cause:
--   Fetching tasks with `assignees(...)` or `children:tasks!parent_task_id`
--   triggers a 3-step cycle:
--     tasks SELECT RLS → assignees() queries task_context_links
--     → "tcl SELECT" RLS does EXISTS(SELECT 1 FROM tasks ...) → loop.
--
-- Fix: Add SECURITY DEFINER to assignees(tasks) so its internal
--   task_context_links query bypasses RLS, breaking the cycle.
--   Safe: the function only exposes employees linked to a task row the
--   caller already has SELECT access to (the parent task is the input).
-- (CREATE OR REPLACE is idempotent by definition)
CREATE OR REPLACE FUNCTION public.assignees(t public.tasks)
RETURNS SETOF public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.* FROM public.employees e
    JOIN public.task_context_links tcl ON tcl.entity_id = e.id
    WHERE tcl.source_id = t.id
      AND tcl.source_type = 'task'
      AND tcl.entity_type = 'assignee';
$$;


-- =========================================================================
-- 4. Daily Attendances: Permit SELECT for own records for Viewers
-- =========================================================================
DROP POLICY IF EXISTS "Attendance: SELECT for contributor+" ON public.daily_attendances;
DROP POLICY IF EXISTS "Attendance: SELECT for contributor+ or own record" ON public.daily_attendances;

CREATE POLICY "Attendance: SELECT for contributor+ or own record"
  ON public.daily_attendances
  FOR SELECT
  USING (
    public.get_user_permission_level('EMPLOYEES') IN ('contributor', 'editor', 'admin')
    OR (
      public.get_user_permission_level('EMPLOYEES') = 'viewer'
      AND employee_id = (SELECT employee_id FROM public.user_profiles WHERE id = auth.uid())
    )
  );


-- =========================================================================
-- 5. rpc_orchestrate_tasks: Full replacement with viewer escalation support
--    and scalar-safe jsonb_array_length guard
--    (CREATE OR REPLACE is idempotent by definition)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_orchestrate_tasks(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation       jsonb;
  v_task_data       jsonb;
  v_context_links   jsonb;
  v_fan_out_targets jsonb;

  v_parent_id          uuid;
  v_child_id           uuid;
  v_created_ids        uuid[] := '{}';

  v_entity_type     text;
  v_entity_ids      jsonb;
  v_entity_id       uuid;

  v_target              jsonb;
  v_target_hub_id       uuid;
  v_target_city         text;
  v_target_assignees    jsonb;
  v_target_assignee_id  uuid;

  v_audit_user_id       uuid;
  v_effective_audit_id  uuid;  -- per-operation audit user (scoped to avoid multi-op bleed)
  v_perm_level          text;
  v_vertical_id         text;

  v_hub_ids             uuid[];
  v_hub_id_scalar       uuid;
  v_orphan_hubs         uuid[];
BEGIN
  v_audit_user_id := public.safe_uuid(payload->>'audit_user_id');

  IF payload->'operations' IS NULL OR jsonb_typeof(payload->'operations') != 'array' THEN
    RAISE EXCEPTION '[rpc_orchestrate_tasks] payload.operations must be a JSON array';
  END IF;

  FOR v_operation IN SELECT * FROM jsonb_array_elements(payload->'operations')
  LOOP
    v_task_data       := v_operation->'task_data';
    v_context_links   := v_operation->'context_links';
    v_fan_out_targets := v_operation->'fan_out_targets';

    -- Reset per-operation effective audit ID from the payload default each iteration
    v_effective_audit_id := v_audit_user_id;

    IF v_task_data IS NULL THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] operation.task_data is required';
    END IF;

    v_vertical_id := v_task_data->>'vertical_id';
    v_perm_level  := public.get_user_permission_level(v_vertical_id);

    IF v_perm_level NOT IN ('contributor', 'editor', 'admin') THEN
      -- Allow viewers to submit escalations (taskService coerces to CHARGING_HUBS but adds 'Escalations' to task_board)
      IF v_perm_level = 'viewer'
         AND v_task_data->'task_board' IS NOT NULL
         AND jsonb_typeof(v_task_data->'task_board') = 'array'
         AND v_task_data->'task_board' @> '["Escalations"]'::jsonb
      THEN

        -- SECURITY MITIGATION 1: Unauthenticated safeguard
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: Unauthenticated users cannot create tasks.';
        END IF;

        -- SECURITY MITIGATION 2: Prevent viewers from hijacking or updating existing tasks.
        -- They are only allowed to CREATE new escalations.
        IF v_task_data->>'id' IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM public.tasks WHERE id = public.safe_uuid(v_task_data->>'id')) THEN
            RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: Viewers cannot update existing tasks via orchestration.';
          END IF;
        END IF;

        -- SECURITY MITIGATION 3: Prevent payload spoofing (framing, backdating, bypasses)
        -- Use v_effective_audit_id (not v_audit_user_id) so we don't bleed across
        -- multiple operations in the same payload call.
        v_effective_audit_id := auth.uid();
        v_task_data := jsonb_set(v_task_data, '{created_by}',      to_jsonb(auth.uid()::text));
        v_task_data := jsonb_set(v_task_data, '{last_updated_by}', to_jsonb(auth.uid()::text));
        v_task_data := jsonb_set(v_task_data, '{created_at}',      to_jsonb(now()));
        v_task_data := jsonb_set(v_task_data, '{updated_at}',      to_jsonb(now()));

        -- SECURITY MITIGATION 4: Hard Payload Size Limit (Prevent Flood Bypass)
        -- Guard: check jsonb_typeof before calling jsonb_array_length to avoid scalar crash.
        IF jsonb_array_length(payload->'operations') > 5
           OR (jsonb_typeof(v_fan_out_targets) = 'array' AND jsonb_array_length(v_fan_out_targets) > 5)
        THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Payload Size Limit Exceeded: Viewers cannot orchestrate massive payloads.';
        END IF;

        -- SECURITY MITIGATION 5: Rate limit viewers to max 100 tasks per hour
        IF (SELECT count(*) FROM public.tasks WHERE created_by = auth.uid() AND created_at > now() - interval '1 hour') >= 100 THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Rate Limit Exceeded: Viewers cannot create more than 100 tasks per hour.';
        END IF;

      ELSE
        RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: User does not have write access to vertical "%".', v_vertical_id;
      END IF;
    END IF;

    -- 1. Determine / Assign Parent ID
    v_parent_id := public.safe_uuid(v_task_data->>'id');
    IF v_parent_id IS NULL THEN
      v_parent_id := gen_random_uuid();
      v_task_data := jsonb_set(v_task_data, '{id}', to_jsonb(v_parent_id::text));
    END IF;

    -- 1.1 Pre-fetch incoming hub list as uuid[] (safe cast via safe_uuid)
    SELECT array_agg(DISTINCT public.safe_uuid(elem))
    INTO v_hub_ids
    FROM jsonb_array_elements_text(COALESCE(v_context_links->'hub', '[]'::jsonb)) AS elem
    WHERE public.safe_uuid(elem) IS NOT NULL;

    -- 2. ORPHAN CHECK (Self-Healing Logic)
    -- Identify hubs being removed from this parent that still have active children.
    IF v_fan_out_targets IS NOT NULL AND jsonb_typeof(v_fan_out_targets) = 'array' THEN
        SELECT array_agg(DISTINCT child.hub_id)
        INTO v_orphan_hubs
        FROM public.tasks child
        WHERE child.parent_task_id = v_parent_id
          AND child.hub_id IS NOT NULL
          AND child.hub_id NOT IN (
              SELECT public.safe_uuid(t->>'hub_id')
              FROM jsonb_array_elements(v_fan_out_targets) AS t
              WHERE public.safe_uuid(t->>'hub_id') IS NOT NULL
          );

        -- SELF-HEALING: Auto-append orphan hub UUIDs back to the hub list
        IF v_orphan_hubs IS NOT NULL AND array_length(v_orphan_hubs, 1) > 0 THEN
          RAISE WARNING '[Orchestrator] Self-Healed orphan hubs: %', v_orphan_hubs;
          -- Native uuid[] union: no text casting needed
          SELECT array_agg(DISTINCT x)
          INTO v_hub_ids
          FROM unnest(array_cat(COALESCE(v_hub_ids, '{}'), v_orphan_hubs)) x
          WHERE x IS NOT NULL;
        END IF;
    END IF;

    -- 2.1 Calculate Parent Hub Scalar
    IF v_hub_ids IS NOT NULL AND array_length(v_hub_ids, 1) > 1 THEN
      v_hub_id_scalar := NULL;  -- Multi-hub: parent has no single hub
    ELSIF v_hub_ids IS NOT NULL AND array_length(v_hub_ids, 1) = 1 THEN
      v_hub_id_scalar := v_hub_ids[1];  -- Direct UUID, no cast needed
    ELSE
      v_hub_id_scalar := public.safe_uuid(v_task_data->>'hub_id');
    END IF;

    -- 3. Upsert Parent Task
    INSERT INTO public.tasks (
      id, text, vertical_id, stage_id, priority, description,
      hub_id, city, function, assigned_to, parent_task_id,
      task_board, metadata, created_at, updated_at, created_by, last_updated_by
    ) VALUES (
      v_parent_id,
      v_task_data->>'text',
      v_task_data->>'vertical_id',
      COALESCE(v_task_data->>'stage_id', 'BACKLOG'),
      COALESCE(v_task_data->>'priority', 'Medium'),
      v_task_data->>'description',
      v_hub_id_scalar,
      v_task_data->>'city',
      v_task_data->>'function',
      public.safe_uuid(v_task_data->>'assigned_to'),
      public.safe_uuid(v_task_data->>'parent_task_id'),
      CASE WHEN v_task_data->'task_board' IS NOT NULL AND jsonb_typeof(v_task_data->'task_board') = 'array'
           THEN v_task_data->'task_board' ELSE '[]'::jsonb END,
      CASE WHEN v_task_data->'metadata' IS NOT NULL AND jsonb_typeof(v_task_data->'metadata') = 'object'
           THEN v_task_data->'metadata' ELSE '{}'::jsonb END,
      COALESCE(NULLIF(v_task_data->>'created_at', '')::timestamptz, now()),
      COALESCE(NULLIF(v_task_data->>'updated_at', '')::timestamptz, now()),
      COALESCE(public.safe_uuid(v_task_data->>'created_by'), v_effective_audit_id),
      COALESCE(public.safe_uuid(v_task_data->>'last_updated_by'), v_effective_audit_id)
    )
    ON CONFLICT (id) DO UPDATE SET
      text             = EXCLUDED.text,
      vertical_id      = EXCLUDED.vertical_id,
      stage_id         = EXCLUDED.stage_id,
      priority         = EXCLUDED.priority,
      description      = EXCLUDED.description,
      hub_id           = EXCLUDED.hub_id,
      city             = EXCLUDED.city,
      function         = EXCLUDED.function,
      assigned_to      = EXCLUDED.assigned_to,
      parent_task_id   = EXCLUDED.parent_task_id,
      task_board       = EXCLUDED.task_board,
      metadata         = EXCLUDED.metadata,
      updated_at       = EXCLUDED.updated_at,
      last_updated_by  = EXCLUDED.last_updated_by;

    v_created_ids := array_append(v_created_ids, v_parent_id);

    -- 4. Sync Parent Context Links
    IF v_context_links IS NOT NULL AND jsonb_typeof(v_context_links) = 'object' THEN
      FOR v_entity_type, v_entity_ids IN SELECT * FROM jsonb_each(v_context_links)
      LOOP
        DELETE FROM public.task_context_links
        WHERE source_id = v_parent_id AND source_type = 'task' AND entity_type = v_entity_type;

        IF v_entity_ids IS NOT NULL AND jsonb_typeof(v_entity_ids) = 'array' THEN
          FOR v_entity_id IN SELECT public.safe_uuid(elem) FROM jsonb_array_elements_text(v_entity_ids) AS elem
          LOOP
            IF v_entity_id IS NOT NULL THEN
              INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
              VALUES (v_parent_id, 'task', v_entity_type, v_entity_id, true)
              ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
            END IF;
          END LOOP;
        END IF;
      END LOOP;
    END IF;

    -- 5. Fan-Out Children
    IF v_fan_out_targets IS NOT NULL AND jsonb_typeof(v_fan_out_targets) = 'array' THEN
      FOR v_target IN SELECT * FROM jsonb_array_elements(v_fan_out_targets)
      LOOP
        v_target_hub_id := public.safe_uuid(v_target->>'hub_id');
        v_target_city   := v_target->>'city';

        v_target_assignees := v_target->'assigned_to';
        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' AND jsonb_array_length(v_target_assignees) > 0 THEN
          v_target_assignee_id := public.safe_uuid(v_target_assignees->>0);
        ELSIF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'string' THEN
          v_target_assignee_id := public.safe_uuid(v_target_assignees->>0);
        ELSE
          v_target_assignee_id := NULL;
        END IF;

        -- IDEMPOTENT CHILD MATCHING: Avoid creating duplicates for the same hub/assignee
        SELECT id INTO v_child_id
        FROM public.tasks
        WHERE parent_task_id = v_parent_id
          AND hub_id IS NOT DISTINCT FROM v_target_hub_id
          AND assigned_to IS NOT DISTINCT FROM v_target_assignee_id
        LIMIT 1;

        IF v_child_id IS NOT NULL THEN
          UPDATE public.tasks SET
            text            = v_task_data->>'text',
            description     = v_task_data->>'description',
            priority        = COALESCE(v_task_data->>'priority', 'Medium'),
            stage_id        = COALESCE(v_task_data->>'stage_id', 'BACKLOG'),
            city            = v_target_city,
            updated_at      = now(),
            last_updated_by = v_effective_audit_id
          WHERE id = v_child_id;
        ELSE
          v_child_id := gen_random_uuid();
          INSERT INTO public.tasks (
            id, text, vertical_id, stage_id, priority, description,
            hub_id, city, function, assigned_to, parent_task_id,
            task_board, metadata, created_by, last_updated_by
          ) VALUES (
            v_child_id,
            v_task_data->>'text',
            v_task_data->>'vertical_id',
            COALESCE(v_task_data->>'stage_id', 'BACKLOG'),
            COALESCE(v_task_data->>'priority', 'Medium'),
            v_task_data->>'description',
            v_target_hub_id,
            v_target_city,
            v_task_data->>'function',
            v_target_assignee_id,
            v_parent_id,
            CASE WHEN v_task_data->'task_board' IS NOT NULL AND jsonb_typeof(v_task_data->'task_board') = 'array'
                 THEN v_task_data->'task_board' ELSE '[]'::jsonb END,
            CASE WHEN v_task_data->'metadata' IS NOT NULL AND jsonb_typeof(v_task_data->'metadata') = 'object'
                 THEN v_task_data->'metadata' ELSE '{}'::jsonb END,
            v_effective_audit_id,
            v_effective_audit_id
          );
        END IF;

        v_created_ids := array_append(v_created_ids, v_child_id);

        -- Sync Child Context Links (Assignee + Hub)
        DELETE FROM public.task_context_links
        WHERE source_id = v_child_id AND source_type = 'task' AND entity_type IN ('assignee', 'hub');

        IF v_target_assignee_id IS NOT NULL THEN
          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'assignee', v_target_assignee_id, true)
          ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
        END IF;

        IF v_target_hub_id IS NOT NULL THEN
          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'hub', v_target_hub_id, true)
          ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN to_jsonb(v_created_ids);
END;
$$;


-- =========================================================================
-- 6. Evolution Log — single consolidated entry (idempotent via ON CONFLICT)
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260706155200_viewer_rbac_and_escalation_fix',
  'Decommissioned legacy daily_tasks table; introduced get_task_vertical_id() SECURITY DEFINER helper '
  || 'to break tcl→tasks→tcl RLS recursion cycle; rebuilt task_context_links RLS policies to use helper '
  || 'instead of direct tasks subquery; allowed viewers to INSERT escalations via tasks INSERT policy; '
  || 'allowed viewers to read their own attendance records; '
  || 'replaced rpc_orchestrate_tasks to permit viewer escalation orchestration with 5 security mitigations; '
  || 'fixed scalar jsonb_array_length crash in viewer payload-size guard; '
  || 'fixed infinite RLS recursion (42P17) on tasks by adding SECURITY DEFINER to assignees(tasks) computed column.',
  ARRAY['daily_tasks','task_context_links','tasks','daily_attendances']
)
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------------------------
-- PostgreSQL Kick (MANDATORY per database-migration-policy §5)
-- -------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
