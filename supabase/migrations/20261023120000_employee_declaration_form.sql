-- =========================================================================
-- POWERPROJECT: EMPLOYEE DECLARATION FORM (+ "DEC NA" tag support)
-- Plan:  docs/features/employee_declaration_form.md
-- Idempotent: Safe to re-run. Additive only (no drops of existing objects).
--
-- What this migration does:
--   1. submissions.document_type ('general' | 'declaration') - also on submissions_backup
--      (archival uses positional SELECT *, so BOTH tables must stay in column parity).
--   2. employees.declaration_uploaded boolean - drives the "DEC NA" tag, no extra query.
--   3. SECURITY DEFINER trigger that keeps employees.declaration_uploaded in sync
--      (runs for Contributors who have no UPDATE right on employees).
--   4. create_entity_atomic: same body as 20260608181500 + reads document_type
--      and tags employee documents so the archiver never purges their files.
--   5. Backfill: tag existing hot employee-document entities as protected.
-- =========================================================================

-- 1. Document classification ------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'general'
  CHECK (document_type IN ('general', 'declaration'));

-- Keep archival backup schema in sync (prevents 42601 column-count crash)
ALTER TABLE public.submissions_backup
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'general';

-- 2. Declaration flag on employees ------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS declaration_uploaded boolean NOT NULL DEFAULT false;

-- 3. Partial index for the trigger lookup
CREATE INDEX IF NOT EXISTS idx_submissions_employee_declaration
  ON public.submissions(employee_id)
  WHERE document_type = 'declaration';

-- 4. Trigger: keep employees.declaration_uploaded accurate -------------------
-- SECURITY DEFINER: a Contributor can insert submissions but cannot UPDATE employees.
-- "Uploaded" = at least one declaration row that still has files in links[].
CREATE OR REPLACE FUNCTION public.sync_employee_declaration_uploaded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp_id uuid;
BEGIN
  -- Avoid referencing OLD on INSERT or NEW on DELETE (PL/pgSQL evaluates both sides of CASE/AND)
  IF TG_OP = 'DELETE' THEN
    v_emp_id := OLD.employee_id;
  ELSE
    v_emp_id := NEW.employee_id;
  END IF;

  IF v_emp_id IS NOT NULL THEN
    UPDATE public.employees
    SET declaration_uploaded = EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.employee_id = v_emp_id
        AND s.document_type = 'declaration'
        AND jsonb_array_length(COALESCE(s.links, '[]'::jsonb)) > 0
    )
    WHERE id = v_emp_id;
  END IF;

  -- Row re-pointed to another employee on UPDATE: recompute the previous owner too
  IF TG_OP = 'UPDATE' THEN
    IF OLD.employee_id IS NOT NULL AND OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
      UPDATE public.employees
      SET declaration_uploaded = EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.employee_id = OLD.employee_id
          AND s.document_type = 'declaration'
          AND jsonb_array_length(COALESCE(s.links, '[]'::jsonb)) > 0
      )
      WHERE id = OLD.employee_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_declaration_uploaded ON public.submissions;
CREATE TRIGGER trg_sync_employee_declaration_uploaded
  AFTER INSERT OR DELETE OR UPDATE OF links, document_type, employee_id
  ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_declaration_uploaded();

-- 5. create_entity_atomic: body identical to 20260608181500, plus:
--    * reads optional document_type (default 'general', validated)
--    * employee documents are tagged metadata.context = 'employee_document'
--      so entity-archive skips them (their files must stay in Supabase Storage).
CREATE OR REPLACE FUNCTION public.create_entity_atomic(
  p_entity_type text,
  p_metadata    jsonb DEFAULT '{}',
  p_domain_data jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $fn$
DECLARE
  v_entity       public.entities%ROWTYPE;
  v_domain       jsonb;
  v_task_id      uuid;
  v_employee_id  uuid;
  v_user_id      uuid;
  v_doc_type     text;
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
      -- Parse domain fields
      v_task_id     := (p_domain_data->>'task_id')::uuid;
      v_employee_id := (p_domain_data->>'employee_id')::uuid;
      v_user_id     := (p_domain_data->>'submitted_by')::uuid;
      v_doc_type    := COALESCE(NULLIF(p_domain_data->>'document_type', ''), 'general');

      -- Guard: must have at least one parent context
      IF v_task_id IS NULL AND v_employee_id IS NULL THEN
        RAISE EXCEPTION 'proof_of_work domain insert requires task_id or employee_id';
      END IF;

      -- Guard: submitter is always required
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'proof_of_work domain insert requires submitted_by';
      END IF;

      -- Guard: document_type must be a known value
      IF v_doc_type NOT IN ('general', 'declaration') THEN
        RAISE EXCEPTION 'proof_of_work domain insert: invalid document_type %', v_doc_type;
      END IF;

      -- Insert the submission record linked to the entity
      INSERT INTO public.submissions (
        task_id,
        employee_id,
        submitted_by,
        comment,
        links,
        entity_id,
        document_type
      ) VALUES (
        v_task_id,
        v_employee_id,
        v_user_id,
        p_domain_data->>'comment',
        COALESCE(p_domain_data->'links', '[]'::jsonb),
        v_entity.id,
        v_doc_type
      );

      -- Employee HR documents must never be archived off Supabase Storage
      -- (archive_after_days for proof_of_work is 7 and the archiver purges files).
      IF v_employee_id IS NOT NULL THEN
        UPDATE public.entities
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('context', 'employee_document')
        WHERE id = v_entity.id
        RETURNING * INTO v_entity;
      END IF;

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
$fn$;

GRANT EXECUTE ON FUNCTION public.create_entity_atomic(text, jsonb, jsonb) TO service_role;

-- 6. Backfill: protect already-uploaded (still hot) employee documents
UPDATE public.entities e
SET metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object('context', 'employee_document')
FROM public.submissions s
WHERE s.entity_id = e.id
  AND s.employee_id IS NOT NULL
  AND e.storage_tier = 'hot'
  AND e.archived_at IS NULL
  AND COALESCE(e.metadata->>'context', '') <> 'employee_document';

-- 7. PostgreSQL Kick
NOTIFY pgrst, 'reload schema';
