-- 0. Create Evolution Log Table if missing
CREATE TABLE IF NOT EXISTS public.database_evolution_log (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name  text         NOT NULL UNIQUE,
    summary         text,
    affected_tables text[],
    applied_at      timestamptz  NOT NULL DEFAULT now()
);

-- 1. Helper: Safe UUID Casting
CREATE OR REPLACE FUNCTION public.safe_uuid(p_val text)
RETURNS uuid AS $$
BEGIN
    IF p_val IS NULL OR p_val = '' OR p_val = '[]' OR p_val = '{}' OR p_val = 'null' THEN
        RETURN NULL;
    END IF;
    RETURN p_val::uuid;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. HARDENED ORCHESTRATION RPC
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
  v_perm_level      text;
  v_vertical_id     text;
  
  v_orphan_count    integer;
  v_orphan_names    text;
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

    -- 2. ORPHAN CHECK (The "Elegant Modal" Logic)
    -- If this is an update to an existing parent, check if any hubs/assignees
    -- are being removed that still have active child tasks.
    IF v_fan_out_targets IS NOT NULL AND jsonb_typeof(v_fan_out_targets) = 'array' THEN
        SELECT count(*), string_agg(h.name, ', ')
        INTO v_orphan_count, v_orphan_names
        FROM public.tasks child
        LEFT JOIN public.hubs h ON h.id = child.hub_id
        WHERE child.parent_task_id = v_parent_id
          AND (child.hub_id, child.assigned_to) NOT IN (
              SELECT 
                public.safe_uuid(t->>'hub_id'),
                public.safe_uuid(CASE 
                  WHEN jsonb_typeof(t->'assigned_to') = 'array' AND jsonb_array_length(t->'assigned_to') > 0 THEN t->'assigned_to'->>0
                  WHEN jsonb_typeof(t->'assigned_to') = 'string' THEN t->>'assigned_to'
                  ELSE NULL 
                END)
              FROM jsonb_array_elements(v_fan_out_targets) AS t
          );

        IF v_orphan_count > 0 THEN
            RAISE EXCEPTION 'ORPHAN_DETECTED: You are trying to remove hubs (%) that still have active sub-tasks. Please delete the sub-tasks first.', v_orphan_names;
        END IF;
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
      public.safe_uuid(v_task_data->>'hub_id'),
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

-- 3. REPAIR WORKFLOW GUARD (Protect Task Columns)
-- Standardizes the trigger to allow parent_task_id updates (cascade safety) 
-- and ensures it uses the correct vertical_id column name.
CREATE OR REPLACE FUNCTION public.protect_task_columns()
RETURNS TRIGGER AS $$
DECLARE
  -- parent_task_id added to whitelist for cascade-delete/restoration safety
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

-- Explicitly re-attach to clear any stale trigger/function bindings
DROP TRIGGER IF EXISTS trg_protect_task_columns ON public.tasks;
CREATE TRIGGER trg_protect_task_columns
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.protect_task_columns();

-- 4. UPDATE DATABASE INDEX
-- Log this repair in the forensic index
INSERT INTO public.database_evolution_log (migration_name, summary, affected_tables)
VALUES ('20260430103000_hardened_orchestration_v2', 'Hardened RPC for UUID safety and orphan protection; repaired Workflow Guard for cascade safety.', '{tasks, tasks_history}')
ON CONFLICT DO NOTHING;
