-- Add updated_at to user_profiles to support the sync_user_permissions RPC
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. FIX TCL RLS POLICIES (Idempotent Repair)
-- Ensures anyone who can UPDATE a task (Editors, Admins, Creators, and ALL Assignees)
-- can also manage its context links without triggering 409 Conflict errors.

CREATE OR REPLACE FUNCTION public.get_task_created_by(p_task_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT created_by FROM public.tasks WHERE id = p_task_id;
$$;

CREATE OR REPLACE FUNCTION public.is_task_assignee(p_task_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.task_context_links tcl
    JOIN public.user_profiles up ON up.employee_id = tcl.entity_id
    WHERE tcl.source_id = p_task_id 
      AND tcl.entity_type = 'assignee' 
      AND up.id = p_user_id
  );
END;
$$;

DROP POLICY IF EXISTS "tcl DELETE" ON public.task_context_links;
CREATE POLICY "tcl DELETE" ON public.task_context_links
FOR DELETE USING (
    (source_type IN ('task', 'daily_task') AND (
        public.get_user_permission_level(public.get_task_vertical_id(source_id)) IN ('editor', 'admin')
        OR public.get_task_assigned_to(source_id) = auth.uid()
        OR public.get_task_created_by(source_id) = auth.uid()
        OR public.is_task_assignee(source_id, auth.uid())
    ))
    OR source_type = 'template'
);

DROP POLICY IF EXISTS "tcl INSERT" ON public.task_context_links;
CREATE POLICY "tcl INSERT" ON public.task_context_links
FOR INSERT WITH CHECK (
    (source_type IN ('task', 'daily_task') AND (
        public.get_user_permission_level(public.get_task_vertical_id(source_id)) IN ('contributor', 'editor', 'admin')
        OR public.get_task_assigned_to(source_id) = auth.uid()
        OR public.get_task_created_by(source_id) = auth.uid()
        OR public.is_task_assignee(source_id, auth.uid())
    ))
    OR source_type = 'template'
);

-- 3. FIX SECURITY AUDIT LOG CONSTRAINTS (Idempotent Repair)
-- Relaxes target_id and actor_id foreign keys to reference public.user_profiles instead of auth.users.
-- This prevents 409 Conflict sync failures when user records are slightly out of sync.
ALTER TABLE public.security_audit_logs 
    DROP CONSTRAINT IF EXISTS security_audit_logs_actor_id_fkey,
    DROP CONSTRAINT IF EXISTS security_audit_logs_target_id_fkey;

ALTER TABLE public.security_audit_logs
    ADD CONSTRAINT security_audit_logs_actor_id_fkey 
    FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.security_audit_logs
    ADD CONSTRAINT security_audit_logs_target_id_fkey 
    FOREIGN KEY (target_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- 4. IMPLEMENT TASKS AUDIT LOGGING (Lean & Secure Repair)
-- Tracks all changes with JSON diffing to prevent database bloat.

CREATE TABLE IF NOT EXISTS public.tasks_history (
    id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id       uuid,        -- The source record ID
    source_type   text,        -- 'task', 'daily_task', 'template'
    vertical_id   text,        -- For fast per-department filtering
    actor_id      uuid        REFERENCES public.user_profiles(id),
    action        text        NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE', 'LINK_ADD', 'LINK_REMOVE'
    entity_id     uuid,        -- For LINK_ADD/REMOVE (the target employee/hub/client)
    old_payload   jsonb,       -- For UPDATE: only old values of changed fields
    new_payload   jsonb,       -- For UPDATE: only new values of changed fields
    client_info   jsonb,       -- { ip, user_agent }
    changed_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (Admin Only)
ALTER TABLE public.tasks_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_history Admin Read" ON public.tasks_history;
CREATE POLICY "tasks_history Admin Read" ON public.tasks_history
    FOR SELECT USING (public.get_user_permission_level('ADMIN_VERTICAL_ID') = 'admin' OR public.is_master_admin());

-- Trigger Function for Lean Auditing
CREATE OR REPLACE FUNCTION public.log_task_history()
RETURNS TRIGGER AS $$
DECLARE
    v_old_json jsonb;
    v_new_json jsonb;
    v_diff_old jsonb := '{}'::jsonb;
    v_diff_new jsonb := '{}'::jsonb;
    v_col      text;
    v_client   jsonb;
BEGIN
    -- Capture Client Info (IP and User Agent from PostgREST/Supabase headers)
    BEGIN
        v_client := jsonb_build_object(
            'ip', current_setting('request.headers', true)::json->>'x-real-ip',
            'user_agent', current_setting('request.headers', true)::json->>'user-agent'
        );
    EXCEPTION WHEN OTHERS THEN
        v_client := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.tasks_history (task_id, source_type, vertical_id, actor_id, action, new_payload, client_info)
        VALUES (NEW.id, 'task', NEW.vertical_id, auth.uid(), 'INSERT', to_jsonb(NEW), v_client);
    
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old_json := to_jsonb(OLD);
        v_new_json := to_jsonb(NEW);

        -- Compute Diff: Only store columns that actually changed
        FOR v_col IN SELECT jsonb_object_keys(v_new_json) LOOP
            IF v_old_json->v_col IS DISTINCT FROM v_new_json->v_col THEN
                v_diff_old := v_diff_old || jsonb_build_object(v_col, v_old_json->v_col);
                v_diff_new := v_diff_new || jsonb_build_object(v_col, v_new_json->v_col);
            END IF;
        END LOOP;

        -- Only log if a change was detected
        IF v_diff_new != '{}'::jsonb THEN
            INSERT INTO public.tasks_history (task_id, source_type, vertical_id, actor_id, action, old_payload, new_payload, client_info)
            VALUES (NEW.id, 'task', NEW.vertical_id, auth.uid(), 'UPDATE', v_diff_old, v_diff_new, v_client);
        END IF;

    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.tasks_history (task_id, source_type, vertical_id, actor_id, action, old_payload, client_info)
        VALUES (OLD.id, 'task', OLD.vertical_id, auth.uid(), 'DELETE', to_jsonb(OLD), v_client);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger Function for Context Link Auditing
CREATE OR REPLACE FUNCTION public.log_tcl_history()
RETURNS TRIGGER AS $$
DECLARE
    v_client   jsonb;
    v_v_id     text;
BEGIN
    -- Resolve Vertical ID from source
    IF (TG_TABLE_NAME = 'task_context_links') THEN
        v_v_id := public.get_task_vertical_id(COALESCE(NEW.source_id, OLD.source_id));
    END IF;

    -- Capture Client Info
    BEGIN
        v_client := jsonb_build_object(
            'ip', current_setting('request.headers', true)::json->>'x-real-ip',
            'user_agent', current_setting('request.headers', true)::json->>'user-agent'
        );
    EXCEPTION WHEN OTHERS THEN
        v_client := NULL;
    END;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.tasks_history (task_id, source_type, vertical_id, actor_id, action, entity_id, new_payload, client_info)
        VALUES (NEW.source_id, NEW.source_type, v_v_id, auth.uid(), 'LINK_ADD', NEW.entity_id, to_jsonb(NEW), v_client);
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.tasks_history (task_id, source_type, vertical_id, actor_id, action, entity_id, old_payload, client_info)
        VALUES (OLD.source_id, OLD.source_type, v_v_id, auth.uid(), 'LINK_REMOVE', OLD.entity_id, to_jsonb(OLD), v_client);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Triggers
DROP TRIGGER IF EXISTS trg_audit_tasks ON public.tasks;
CREATE TRIGGER trg_audit_tasks
    AFTER INSERT OR UPDATE OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.log_task_history();

DROP TRIGGER IF EXISTS trg_audit_tcl ON public.task_context_links;
CREATE TRIGGER trg_audit_tcl
    AFTER INSERT OR DELETE ON public.task_context_links
    FOR EACH ROW EXECUTE FUNCTION public.log_tcl_history();

-- 5. HARDEN ORCHESTRATION RPC (Idempotent Child Support)
-- Upgrades the RPC to handle updates gracefully. Instead of always creating
-- new children, it matches existing children by parent_task_id and hub/assignee identity.

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

  v_perm_level      text;
  v_vertical_id     text;
BEGIN
  v_audit_user_id := NULLIF(payload->>'audit_user_id', '')::uuid;

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
    IF v_task_data->>'id' IS NOT NULL AND v_task_data->>'id' != '' THEN
      v_parent_id := (v_task_data->>'id')::uuid;
    ELSE
      v_parent_id := gen_random_uuid();
      v_task_data := jsonb_set(v_task_data, '{id}', to_jsonb(v_parent_id::text));
    END IF;

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
    IF v_context_links IS NOT NULL AND jsonb_typeof(v_context_links) = 'object' THEN
      FOR v_entity_type, v_entity_ids IN SELECT * FROM jsonb_each(v_context_links)
      LOOP
        DELETE FROM public.task_context_links 
        WHERE source_id = v_parent_id AND source_type = 'task' AND entity_type = v_entity_type;
        
        IF v_entity_ids IS NOT NULL AND jsonb_typeof(v_entity_ids) = 'array' THEN
          FOR v_entity_id IN SELECT NULLIF(elem, '')::uuid FROM jsonb_array_elements_text(v_entity_ids) AS elem
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
        v_target_hub_id := NULLIF(v_target->>'hub_id', '')::uuid;
        
        v_target_assignees := v_target->'assigned_to';
        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' AND jsonb_array_length(v_target_assignees) > 0 THEN
          v_target_assignee_id := NULLIF(v_target_assignees->>0, '')::uuid;
        ELSIF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'string' THEN
          v_target_assignee_id := NULLIF(v_target_assignees::text, '"null"')::uuid;
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

        IF v_child_id IS NULL THEN
          v_child_id := gen_random_uuid();
        END IF;

        v_target_city := NULLIF(v_target->>'city', '');
        IF v_target_city IS NULL THEN v_target_city := v_task_data->>'city'; END IF;

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
          v_parent_id,
          CASE WHEN v_task_data->'task_board' IS NOT NULL AND jsonb_typeof(v_task_data->'task_board') = 'array'
               THEN v_task_data->'task_board' ELSE '[]'::jsonb END,
          CASE WHEN v_task_data->'metadata' IS NOT NULL AND jsonb_typeof(v_task_data->'metadata') = 'object'
               THEN v_task_data->'metadata' ELSE '{}'::jsonb END,
          now(), now(),
          COALESCE(NULLIF(v_task_data->>'created_by', '')::uuid, v_audit_user_id),
          COALESCE(v_audit_user_id, NULLIF(v_task_data->>'created_by', '')::uuid)
        )
        ON CONFLICT (id) DO UPDATE SET
          text = EXCLUDED.text,
          description = EXCLUDED.description,
          priority = EXCLUDED.priority,
          stage_id = EXCLUDED.stage_id,
          updated_at = now(),
          last_updated_by = EXCLUDED.last_updated_by;

        v_created_ids := array_append(v_created_ids, v_child_id);

        -- Sync Child Context Links
        IF v_target_hub_id IS NOT NULL THEN
          DELETE FROM public.task_context_links WHERE source_id = v_child_id AND source_type = 'task' AND entity_type = 'hub';
          INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
          VALUES (v_child_id, 'task', 'hub', v_target_hub_id, true) ON CONFLICT DO NOTHING;
        END IF;

        IF v_target_assignees IS NOT NULL AND jsonb_typeof(v_target_assignees) = 'array' THEN
          DELETE FROM public.task_context_links WHERE source_id = v_child_id AND source_type = 'task' AND entity_type = 'assignee';
          FOR v_entity_id IN SELECT NULLIF(elem, '')::uuid FROM jsonb_array_elements_text(v_target_assignees) AS elem
          LOOP
            IF v_entity_id IS NOT NULL THEN
              INSERT INTO public.task_context_links (source_id, source_type, entity_type, entity_id, is_active)
              VALUES (v_child_id, 'task', 'assignee', v_entity_id, true) ON CONFLICT DO NOTHING;
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

GRANT EXECUTE ON FUNCTION public.rpc_orchestrate_tasks(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';

END $wrapper$;
