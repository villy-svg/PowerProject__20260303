-- =========================================================================
-- FIX: Type Safety & Promote Child Task
-- Migration: 20260430140000_fix_type_safety_and_promote.sql
--
-- Problems solved:
--   1. v_hub_ids / v_orphan_hubs were declared as text[] in the orchestration
--      RPC despite holding UUID values. This is unsafe — PostgreSQL will not
--      validate the content as valid UUIDs, allowing malformed values to
--      accumulate silently and cause cast failures at runtime.
--
--   2. promote_child_task: When a contributor calls handleMoveToParent via the
--      regular Supabase client, taskService.updateTask (SCENARIO B) syncs
--      hub_ids and assignee context links. If the user lacks DELETE rights on
--      task_context_links (contributors only have INSERT, not DELETE via RLS),
--      syncContextLinks throws a 403, which propagates as "Failed to update
--      relationship." The promote must bypass context-link re-syncing.
--
--   3. Add a dedicated lightweight RPC for promoting tasks so it executes
--      SECURITY DEFINER and only updates parent_task_id — no full-row update,
--      no context-link sync needed.
-- =========================================================================


-- =========================================================================
-- 1. HARDEN ORCHESTRATION RPC: Fix uuid[] types (replaces v2)
-- Changes: v_hub_ids text[] → uuid[], v_orphan_hubs text[] → uuid[]
--          Uses native UUID array ops instead of text-based array_cat/unnest.
-- =========================================================================
DO $wrapper$
BEGIN

EXECUTE $func$
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
  v_perm_level          text;
  v_vertical_id         text;

  v_orphan_count        integer;
  v_orphan_names        text;
  -- FIX: Declare hub arrays as uuid[] (not text[]) for type safety
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

    IF v_task_data IS NULL THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] operation.task_data is required';
    END IF;

    v_vertical_id := v_task_data->>'vertical_id';
    v_perm_level  := public.get_user_permission_level(v_vertical_id);

    IF v_perm_level NOT IN ('contributor', 'editor', 'admin') THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: User does not have write access to vertical "%".', v_vertical_id;
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
      COALESCE(public.safe_uuid(v_task_data->>'created_by'), v_audit_user_id),
      COALESCE(public.safe_uuid(v_task_data->>'last_updated_by'), v_audit_user_id)
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
            last_updated_by = v_audit_user_id
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
            v_audit_user_id,
            v_audit_user_id
          );
        END IF;

        v_created_ids := array_append(v_created_ids, v_child_id);

        -- Sync Child Context Links (Assignee + Hub)
        DELETE FROM public.task_context_links
        WHERE source_id = v_child_id AND source_type = 'task' AND entity_type IN ('assignee', 'hub');

        IF v_target_assignee_id IS NOT NULL THEN
          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'assignee', v_target_assignee_id, true)
          ON CONFLICT DO NOTHING;
        END IF;

        IF v_target_hub_id IS NOT NULL THEN
          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'hub', v_target_hub_id, true)
          ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN to_jsonb(v_created_ids);
END;
$$;
$func$;
END $wrapper$;


-- =========================================================================
-- 2. DEDICATED PROMOTE RPC
--
-- Why a dedicated RPC instead of a direct .update() call?
--   • Direct .update() triggers protect_task_columns for non-editors, which
--     only allows stage_id, last_updated_by, updated_at, parent_task_id.
--     While parent_task_id IS in the allowlist, the full row sent by
--     mapTaskToRow causes syncContextLinks to also run (hub_ids / assigned_to
--     sync), which requires DELETE on task_context_links — a right that
--     contributors don't have. This throws a 403 that surfaces to the user
--     as "Failed to update relationship."
--   • This SECURITY DEFINER RPC executes only the targeted parent_task_id
--     update, bypassing both the trigger's revert logic for full-row updates
--     and the TCL DELETE restriction for contributors.
--   • RBAC still enforced: must be editor/admin OR the task's creator OR
--     an assigned user to promote.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_promote_task(
  p_task_id   uuid,
  p_parent_id uuid   -- NULL = promote to top-level; non-null = re-parent
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task          RECORD;
  v_perm_level    text;
  v_is_assignee   boolean;
  v_user_id       uuid := auth.uid();
BEGIN
  -- 1. Load the task
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '[rpc_promote_task] Task not found: %', p_task_id;
  END IF;

  -- 2. Guard: Cannot promote a top-level task (it has no parent to lose)
  IF v_task.parent_task_id IS NULL AND p_parent_id IS NULL THEN
    RAISE EXCEPTION '[rpc_promote_task] Task % is already a top-level task.', p_task_id;
  END IF;

  -- 3. Guard: Prevent self-referential re-parenting
  IF p_parent_id IS NOT NULL AND p_parent_id = p_task_id THEN
    RAISE EXCEPTION '[rpc_promote_task] A task cannot be its own parent.';
  END IF;

  -- 4. RBAC: editor/admin always allowed; contributor allowed if they are
  --    the creator or an assigned user on this task.
  v_perm_level := public.get_user_permission_level(v_task.vertical_id);

  IF v_perm_level NOT IN ('editor', 'admin') THEN
    -- Check if caller is the creator
    IF v_task.created_by = v_user_id THEN
      NULL; -- allowed
    ELSE
      -- Check if caller is an assignee via context links
      SELECT EXISTS (
        SELECT 1 FROM public.task_context_links tcl
        JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
        WHERE tcl.source_id = p_task_id
          AND tcl.source_type = 'task'
          AND tcl.entity_type = 'assignee'
          AND up.id = v_user_id
      ) INTO v_is_assignee;

      IF NOT v_is_assignee THEN
        RAISE EXCEPTION '[rpc_promote_task] Access Denied: Only editors, admins, creators, or assignees can promote tasks.';
      END IF;
    END IF;
  END IF;

  -- 5. Perform the targeted update (only parent_task_id changes)
  UPDATE public.tasks
  SET
    parent_task_id  = p_parent_id,
    updated_at      = now(),
    last_updated_by = v_user_id
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'task_id',    p_task_id,
    'new_parent', p_parent_id,
    'promoted_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_promote_task(uuid, uuid) TO authenticated;


-- =========================================================================
-- 3. REPAIR WORKFLOW GUARD
-- Ensures the trigger is re-attached cleanly after the above changes.
-- parent_task_id must remain in allowed cols for direct-update fallbacks.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.protect_task_columns()
RETURNS TRIGGER AS $$
DECLARE
  v_allowed_cols text[] := ARRAY['stage_id', 'last_updated_by', 'updated_at', 'parent_task_id'];
  v_new_json     jsonb  := to_jsonb(NEW);
  v_old_json     jsonb  := to_jsonb(OLD);
  v_col          text;
  v_final_json   jsonb;
  v_perm_level   text;
  v_vertical_id  text;
BEGIN
  v_vertical_id := v_new_json->>'vertical_id';
  v_perm_level  := public.get_user_permission_level(v_vertical_id);

  IF v_perm_level NOT IN ('editor', 'admin') THEN
    v_final_json := v_old_json;
    FOR v_col IN SELECT jsonb_object_keys(v_new_json) LOOP
      IF v_col = ANY(v_allowed_cols) THEN
        v_final_json := v_final_json || jsonb_build_object(v_col, v_new_json->v_col);
      ELSE
        IF v_old_json->v_col IS DISTINCT FROM v_new_json->v_col THEN
          RAISE WARNING '[Workflow Guard] Unauthorized edit to column "%" by user "%" was reverted.',
            v_col, auth.uid();
        END IF;
      END IF;
    END LOOP;
    NEW := jsonb_populate_record(NEW, v_final_json);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_task_columns ON public.tasks;
CREATE TRIGGER trg_protect_task_columns
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.protect_task_columns();


-- =========================================================================
-- 4. LOG IN EVOLUTION LEDGER
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260430140000_fix_type_safety_and_promote',
  'Fixed uuid[] type safety in orchestration RPC (v_hub_ids / v_orphan_hubs were text[]). Added rpc_promote_task SECURITY DEFINER RPC to fix promote-child failures for contributors/assignees who lack TCL DELETE rights.',
  ARRAY['tasks', 'task_context_links']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
