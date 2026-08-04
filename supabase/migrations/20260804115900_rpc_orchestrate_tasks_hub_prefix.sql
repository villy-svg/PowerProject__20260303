-- 20260804115900_rpc_orchestrate_tasks_hub_prefix.sql
-- =========================================================================
-- rpc_orchestrate_tasks: Update child sub-task title with target hub_code
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
  v_effective_audit_id  uuid;  
  v_perm_level          text;
  v_vertical_id         text;

  v_hub_ids             uuid[];
  v_hub_id_scalar       uuid;
  v_orphan_hubs         uuid[];

  v_child_text          text;
  v_child_hub_code      text;
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

    v_effective_audit_id := v_audit_user_id;

    IF v_task_data IS NULL THEN
      RAISE EXCEPTION '[rpc_orchestrate_tasks] operation.task_data is required';
    END IF;

    v_vertical_id := v_task_data->>'vertical_id';
    v_perm_level  := public.get_user_permission_level(v_vertical_id);

    IF v_perm_level NOT IN ('contributor', 'editor', 'admin') THEN
      IF v_perm_level = 'viewer'
         AND v_task_data->'task_board' IS NOT NULL
         AND jsonb_typeof(v_task_data->'task_board') = 'array'
         AND v_task_data->'task_board' @> '["Escalations"]'::jsonb
      THEN
        IF auth.uid() IS NULL THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: Unauthenticated users cannot create tasks.';
        END IF;

        IF v_task_data->>'id' IS NOT NULL THEN
          IF EXISTS (SELECT 1 FROM public.tasks WHERE id = public.safe_uuid(v_task_data->>'id')) THEN
            RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: Viewers cannot update existing tasks via orchestration.';
          END IF;
        END IF;

        v_effective_audit_id := auth.uid();
        v_task_data := jsonb_set(v_task_data, '{created_by}',      to_jsonb(auth.uid()::text));
        v_task_data := jsonb_set(v_task_data, '{last_updated_by}', to_jsonb(auth.uid()::text));
        v_task_data := jsonb_set(v_task_data, '{created_at}',      to_jsonb(now()));
        v_task_data := jsonb_set(v_task_data, '{updated_at}',      to_jsonb(now()));

        IF jsonb_array_length(payload->'operations') > 5
           OR (jsonb_typeof(v_fan_out_targets) = 'array' AND jsonb_array_length(v_fan_out_targets) > 5)
        THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Payload Size Limit Exceeded: Viewers cannot orchestrate massive payloads.';
        END IF;

        IF (SELECT count(*) FROM public.tasks WHERE created_by = auth.uid() AND created_at > now() - interval '1 hour') >= 100 THEN
          RAISE EXCEPTION '[rpc_orchestrate_tasks] Rate Limit Exceeded: Viewers cannot create more than 100 tasks per hour.';
        END IF;

      ELSE
        RAISE EXCEPTION '[rpc_orchestrate_tasks] Access Denied: User does not have write access to vertical "%".', v_vertical_id;
      END IF;
    END IF;

    v_parent_id := public.safe_uuid(v_task_data->>'id');
    IF v_parent_id IS NULL THEN
      v_parent_id := gen_random_uuid();
      v_task_data := jsonb_set(v_task_data, '{id}', to_jsonb(v_parent_id::text));
    END IF;

    SELECT array_agg(DISTINCT public.safe_uuid(elem))
    INTO v_hub_ids
    FROM jsonb_array_elements_text(COALESCE(v_context_links->'hub', '[]'::jsonb)) AS elem
    WHERE public.safe_uuid(elem) IS NOT NULL;

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

        IF v_orphan_hubs IS NOT NULL AND array_length(v_orphan_hubs, 1) > 0 THEN
          RAISE WARNING '[Orchestrator] Self-Healed orphan hubs: %', v_orphan_hubs;
          SELECT array_agg(DISTINCT x)
          INTO v_hub_ids
          FROM unnest(array_cat(COALESCE(v_hub_ids, '{}'), v_orphan_hubs)) x
          WHERE x IS NOT NULL;
        END IF;
    END IF;

    IF v_hub_ids IS NOT NULL AND array_length(v_hub_ids, 1) > 1 THEN
      v_hub_id_scalar := NULL; 
    ELSIF v_hub_ids IS NOT NULL AND array_length(v_hub_ids, 1) = 1 THEN
      v_hub_id_scalar := v_hub_ids[1]; 
    ELSE
      v_hub_id_scalar := public.safe_uuid(v_task_data->>'hub_id');
    END IF;

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

    IF v_fan_out_targets IS NOT NULL AND jsonb_typeof(v_fan_out_targets) = 'array' THEN
      FOR v_target IN SELECT * FROM jsonb_array_elements(v_fan_out_targets)
      LOOP
        v_target_hub_id := public.safe_uuid(v_target->>'hub_id');
        v_target_city   := v_target->>'city';

        v_target_assignees := v_target->'assigned_to';
        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' AND jsonb_array_length(v_target_assignees) > 0 THEN
          v_target_assignee_id := public.safe_uuid(v_target_assignees->>0);
        ELSIF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'string' THEN
          v_target_assignee_id := public.safe_uuid(v_target->>'assigned_to');
        ELSE
          v_target_assignee_id := NULL;
        END IF;
        
        v_child_text := v_task_data->>'text';
        IF v_target_hub_id IS NOT NULL AND v_child_text LIKE '%MULTI : %' THEN
          SELECT hub_code INTO v_child_hub_code FROM public.hubs WHERE id = v_target_hub_id;
          IF v_child_hub_code IS NOT NULL THEN
            v_child_text := replace(v_child_text, 'MULTI :', v_child_hub_code || ' :');
          END IF;
        END IF;

        SELECT id INTO v_child_id
        FROM public.tasks
        WHERE parent_task_id = v_parent_id
          AND hub_id IS NOT DISTINCT FROM v_target_hub_id
          AND assigned_to IS NOT DISTINCT FROM v_target_assignee_id
        LIMIT 1;

        IF v_child_id IS NOT NULL THEN
          UPDATE public.tasks SET
            text            = v_child_text,
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
            v_child_text,
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
-- Evolution Log & Schema Kick
-- =========================================================================
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES (
  '20260804115900_rpc_orchestrate_tasks_hub_prefix',
  'Updated rpc_orchestrate_tasks to dynamically replace MULTI prefix with specific hub code for sub-tasks during fan-out.',
  ARRAY['tasks']
)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
