-- =========================================================================
-- RPC: Orchestrate Tasks (Fan-Out & Context Sync)
-- Allows frontend and CSV import to pass a JSONB payload to atomically
-- upsert parent tasks, fan-out children, and sync task_context_links.
--
-- BUG-FIX: Wrapped in DO $wrapper$ block to satisfy the Supabase CLI SQL
-- parser (prevents SQLSTATE 42601 "syntax error" on CREATE OR REPLACE
-- FUNCTION statements that follow other DDL in the same migration).
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

  v_audit_user_id   uuid;
  v_hub_id_raw      text;
  v_assigned_raw    text;

  -- RBAC: Permission level for the current operation's vertical
  v_perm_level      text;
  v_vertical_id     text;
BEGIN
  -- SECURITY: Parse audit_user_id from payload.
  -- FIX: The previous catch-all EXCEPTION silently swallowed malformed UUIDs,
  -- allowing bad payloads to proceed with a NULL audit trail. We now use
  -- NULLIF to cleanly handle empty strings, and only fall back on genuine NULL.
  -- A truly malformed (non-empty, non-UUID) value will still throw — intentionally.
  v_audit_user_id := NULLIF(payload->>'audit_user_id', '')::uuid;

  -- Guard: operations must be a non-null array
  IF payload->'operations' IS NULL OR jsonb_typeof(payload->'operations') != 'array' THEN
    RAISE EXCEPTION '[rpc_orchestrate_tasks] payload.operations must be a JSON array';
  END IF;

  -- Iterate through operations
  FOR v_operation IN SELECT * FROM jsonb_array_elements(payload->'operations')
  LOOP
    v_task_data       := v_operation->'task_data';
    v_context_links   := v_operation->'context_links';
    v_fan_out_targets := v_operation->'fan_out_targets';

    IF v_task_data IS NULL THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] operation.task_data is required';
    END IF;

    -- =========================================================================
    -- SECURITY: RBAC CHECK (Per-Operation)
    -- SECURITY DEFINER bypasses table RLS, so we must manually enforce that the
    -- calling user has at least 'contributor' level on the target vertical.
    -- This mirrors the pattern in workflow_rbac_hardening.sql (line 38).
    -- A Viewer attempting to call this endpoint will receive an ACCESS DENIED error.
    -- =========================================================================
    v_vertical_id := v_task_data->>'vertical_id';
    v_perm_level  := public.get_user_permission_level(v_vertical_id);

    IF v_perm_level NOT IN ('contributor', 'editor', 'admin') THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: User does not have write access to vertical "%".', v_vertical_id;
    END IF;

    -- 1. Determine / Assign Parent ID
    IF v_task_data->>'id' IS NOT NULL AND v_task_data->>'id' != '' THEN
      BEGIN
        v_parent_id := (v_task_data->>'id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '[rpc_orchestrate_tasks] task_data.id is not a valid UUID: %', v_task_data->>'id';
      END;
    ELSE
      v_parent_id := gen_random_uuid();
      v_task_data := jsonb_set(v_task_data, '{id}', to_jsonb(v_parent_id::text));
    END IF;

    -- BUG-FIX: Sanitize UUID fields — empty string cast to uuid throws a
    -- "invalid input syntax for type uuid: """ error in PostgreSQL.
    -- We normalize empty strings → JSON null BEFORE the INSERT.
    v_hub_id_raw   := v_task_data->>'hub_id';
    v_assigned_raw := v_task_data->>'assigned_to';

    IF v_hub_id_raw IS NULL OR v_hub_id_raw = '' THEN
      v_task_data := jsonb_set(v_task_data, '{hub_id}', 'null'::jsonb);
    END IF;
    IF v_assigned_raw IS NULL OR v_assigned_raw = '' THEN
      v_task_data := jsonb_set(v_task_data, '{assigned_to}', 'null'::jsonb);
    END IF;
    IF v_task_data->>'parent_task_id' IS NULL OR v_task_data->>'parent_task_id' = '' THEN
      v_task_data := jsonb_set(v_task_data, '{parent_task_id}', 'null'::jsonb);
    END IF;

    -- 2. Upsert Parent Task
    -- BUG-FIX: ON CONFLICT guard on children uses gen_random_uuid so no
    -- true conflict is possible. But parent upsert uses the supplied ID,
    -- which CAN conflict on a re-import — handled correctly with DO UPDATE.
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
      NULLIF(v_task_data->>'hub_id', '')::uuid,
      v_task_data->>'city',
      v_task_data->>'function',
      NULLIF(v_task_data->>'assigned_to', '')::uuid,
      NULLIF(v_task_data->>'parent_task_id', '')::uuid,
      CASE WHEN v_task_data->'task_board' IS NOT NULL AND jsonb_typeof(v_task_data->'task_board') = 'array'
           THEN v_task_data->'task_board' ELSE '[]'::jsonb END,
      CASE WHEN v_task_data->'metadata' IS NOT NULL AND jsonb_typeof(v_task_data->'metadata') = 'object'
           THEN v_task_data->'metadata' ELSE '{}'::jsonb END,
      COALESCE(NULLIF(v_task_data->>'created_at', '')::timestamptz, now()),
      COALESCE(NULLIF(v_task_data->>'updated_at', '')::timestamptz, now()),
      COALESCE(NULLIF(v_task_data->>'created_by', '')::uuid, v_audit_user_id),
      COALESCE(NULLIF(v_task_data->>'last_updated_by', '')::uuid, v_audit_user_id)
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

    -- 3. Sync Parent Context Links
    -- BUG-FIX: We DELETE then INSERT in one operation per entity_type.
    -- The UNIQUE constraint on (source_type, source_id, entity_type, entity_id)
    -- means we need to guard re-inserted rows with ON CONFLICT DO NOTHING.
    IF v_context_links IS NOT NULL AND jsonb_typeof(v_context_links) = 'object' THEN
      FOR v_entity_type, v_entity_ids IN SELECT * FROM jsonb_each(v_context_links)
      LOOP
        DELETE FROM public.task_context_links 
        WHERE source_id = v_parent_id AND source_type = 'task' AND entity_type = v_entity_type;
        
        IF v_entity_ids IS NOT NULL AND jsonb_typeof(v_entity_ids) = 'array' THEN
          FOR v_entity_id IN
            SELECT NULLIF(elem, '')::uuid
            FROM jsonb_array_elements_text(v_entity_ids) AS elem
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

    -- 4. Fan-Out Children
    IF v_fan_out_targets IS NOT NULL AND jsonb_typeof(v_fan_out_targets) = 'array' THEN
      FOR v_target IN SELECT * FROM jsonb_array_elements(v_fan_out_targets)
      LOOP
        v_child_id := gen_random_uuid();
        
        -- BUG-FIX: Use NULLIF to safely cast hub_id — avoids empty-string UUID cast error
        v_target_hub_id := NULLIF(v_target->>'hub_id', '')::uuid;

        -- Inherit city from task_data if the target doesn't override it
        v_target_city := NULLIF(v_target->>'city', '');
        IF v_target_city IS NULL THEN
          v_target_city := v_task_data->>'city';
        END IF;

        -- BUG-FIX: assigned_to on fan-out targets is an array in the JS payload.
        -- Safely handle both array and scalar forms.
        v_target_assignees := v_target->'assigned_to';
        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' AND jsonb_array_length(v_target_assignees) > 0 THEN
          v_target_assignee_id := NULLIF(v_target_assignees->>0, '')::uuid;
        ELSIF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'string' THEN
          -- Handle scalar form gracefully (defensive)
          v_target_assignee_id := NULLIF(v_target_assignees::text, '"null"')::uuid;
        ELSE
          v_target_assignee_id := NULL;
        END IF;

        INSERT INTO public.tasks (
          id, text, vertical_id, stage_id, priority, description, 
          hub_id, city, function, assigned_to, parent_task_id,
          task_board, metadata, created_at, updated_at, created_by, last_updated_by
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
          v_parent_id,  -- always children of this parent
          CASE WHEN v_task_data->'task_board' IS NOT NULL AND jsonb_typeof(v_task_data->'task_board') = 'array'
               THEN v_task_data->'task_board' ELSE '[]'::jsonb END,
          CASE WHEN v_task_data->'metadata' IS NOT NULL AND jsonb_typeof(v_task_data->'metadata') = 'object'
               THEN v_task_data->'metadata' ELSE '{}'::jsonb END,
          now(),
          now(),
          COALESCE(NULLIF(v_task_data->>'created_by', '')::uuid, v_audit_user_id),
          COALESCE(v_audit_user_id, NULLIF(v_task_data->>'created_by', '')::uuid)
        );

        v_created_ids := array_append(v_created_ids, v_child_id);

        -- Sync Child Hub Context Link
        IF v_target_hub_id IS NOT NULL THEN
          DELETE FROM public.task_context_links 
          WHERE source_id = v_child_id AND source_type = 'task' AND entity_type = 'hub';

          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'hub', v_target_hub_id, true)
          ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
        END IF;

        -- Sync Child Assignee Context Links
        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' THEN
          DELETE FROM public.task_context_links 
          WHERE source_id = v_child_id AND source_type = 'task' AND entity_type = 'assignee';

          FOR v_entity_id IN
            SELECT NULLIF(elem, '')::uuid
            FROM jsonb_array_elements_text(v_target_assignees) AS elem
          LOOP
            IF v_entity_id IS NOT NULL THEN
              INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
              VALUES (v_child_id, 'task', 'assignee', v_entity_id, true)
              ON CONFLICT (source_type, source_id, entity_type, entity_id) DO NOTHING;
            END IF;
          END LOOP;
        END IF;

      END LOOP;
    END IF;

  END LOOP;

  RETURN to_jsonb(v_created_ids);
END;
$$;

$func$;

-- Grant execution
EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_orchestrate_tasks(jsonb) TO authenticated';
EXECUTE 'GRANT EXECUTE ON FUNCTION public.rpc_orchestrate_tasks(jsonb) TO service_role';

-- Kick PostgREST
PERFORM pg_notify('pgrst', 'reload schema');

END $wrapper$;
