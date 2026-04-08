DO $wrapper$
BEGIN
    -- =========================================================================
    -- HOT/COLD STORAGE: ATOMIC ENTITY CREATION RPC
    -- Wrapped in a single DO block to satisfy Supabase CLI parser (SQLSTATE 42601)
    -- =========================================================================

    -- 1. Create the function via dynamic SQL
    EXECUTE $function_body$
        CREATE OR REPLACE FUNCTION public.create_entity_atomic(
          p_entity_type text,
          p_metadata    jsonb DEFAULT '{}',
          p_domain_data jsonb DEFAULT '{}'
        ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
        DECLARE
          v_entity   public.entities%ROWTYPE;
          v_domain   jsonb;
          v_task_id  uuid;
          v_user_id  uuid;
        BEGIN
          -- Step 1: Validate entity_type is in the registry (fail fast)
          IF NOT EXISTS (
            SELECT 1 FROM public.entity_type_registry WHERE entity_type = p_entity_type
          ) THEN
            RAISE EXCEPTION 'Unknown entity_type: %', p_entity_type;
          END IF;

          -- Step 2: Insert entity record (defaults to 'hot')
          INSERT INTO public.entities (entity_type, metadata)
          VALUES (p_entity_type, COALESCE(p_metadata, '{}'))
          RETURNING * INTO v_entity;

          -- Step 3: Dispatch to the correct domain table
          CASE p_entity_type
            WHEN 'proof_of_work' THEN
              -- Validate required domain fields
              v_task_id := (p_domain_data->>'task_id')::uuid;
              v_user_id := (p_domain_data->>'submitted_by')::uuid;

              IF v_task_id IS NULL THEN
                RAISE EXCEPTION 'proof_of_work domain insert requires task_id';
              END IF;
              IF v_user_id IS NULL THEN
                RAISE EXCEPTION 'proof_of_work domain insert requires submitted_by';
              END IF;

              -- Insert the submission record linked to the entity
              INSERT INTO public.submissions (
                task_id,
                submitted_by,
                comment,
                links,
                entity_id
              ) VALUES (
                v_task_id,
                v_user_id,
                p_domain_data->>'comment',
                COALESCE(p_domain_data->'links', '[]'::jsonb),
                v_entity.id
              );

              -- Fetch the newly created submission back as JSON
              SELECT to_jsonb(s) INTO v_domain
              FROM public.submissions s
              WHERE s.entity_id = v_entity.id
              LIMIT 1;

            ELSE
              RAISE EXCEPTION 'Unknown entity_type: %', p_entity_type;
          END CASE;

          -- Step 4: Return both the entity and domain records
          RETURN jsonb_build_object(
            'entity', to_jsonb(v_entity),
            'domain', v_domain
          );
        END;
        $$;
    $function_body$;

    -- 2. Grant execute to service_role (Edge Functions use service role)
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_entity_atomic(text, jsonb, jsonb) TO service_role';

    -- 3. Notify PostgREST to reload schema
    PERFORM pg_notify('pgrst', 'reload schema');

END $wrapper$;
