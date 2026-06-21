-- =========================================================================
-- POWERPROJECT: EMPLOYEE DOCUMENTS & SUBMISSIONS INTEGRATION
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. Alter submissions.task_id to be nullable
ALTER TABLE public.submissions ALTER COLUMN task_id DROP NOT NULL;

-- 2. Add employee_id to public.submissions linking to public.employees
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 2.1 Keep archival backup schema in sync to prevent 42601 crash
ALTER TABLE public.submissions_backup ADD COLUMN IF NOT EXISTS employee_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'submissions' AND constraint_name = 'submissions_employee_id_fkey'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_submissions_employee_id ON public.submissions(employee_id) WHERE employee_id IS NOT NULL;

-- 4. Update set_submission_number() trigger to support employee_id
CREATE OR REPLACE FUNCTION public.set_submission_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_id IS NOT NULL THEN
    SELECT COALESCE(MAX(submission_number), 0) + 1
      INTO NEW.submission_number
      FROM public.submissions
      WHERE task_id = NEW.task_id;
  ELSIF NEW.employee_id IS NOT NULL THEN
    SELECT COALESCE(MAX(submission_number), 0) + 1
      INTO NEW.submission_number
      FROM public.submissions
      WHERE employee_id = NEW.employee_id;
  ELSE
    -- Guard: every submission must belong to either a task or an employee
    RAISE EXCEPTION 'set_submission_number: submission requires task_id or employee_id to be non-null';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update RLS policies to handle EMPLOYEES vertical permissions
-- Drop old policies
DROP POLICY IF EXISTS "Submissions SELECT via task vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions INSERT via task vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions UPDATE via task vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions DELETE via task vertical" ON public.submissions;

DROP POLICY IF EXISTS "Submissions SELECT via vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions INSERT via vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions UPDATE via vertical" ON public.submissions;
DROP POLICY IF EXISTS "Submissions DELETE via vertical" ON public.submissions;

-- SELECT POLICY: Allow if task is accessible OR employee is accessible (via EMPLOYEES vertical)
CREATE POLICY "Submissions SELECT via vertical" ON public.submissions
  FOR SELECT USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.vertical_id) IN ('viewer','contributor','editor','admin')
    ))
    OR
    (employee_id IS NOT NULL AND public.get_user_permission_level('EMPLOYEES') IN ('viewer','contributor','editor','admin'))
  );

-- INSERT POLICY: Allow contributor+
CREATE POLICY "Submissions INSERT via vertical" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by
    AND (
      (task_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND public.get_user_permission_level(t.vertical_id) IN ('contributor','editor','admin')
      ))
      OR
      (employee_id IS NOT NULL AND public.get_user_permission_level('EMPLOYEES') IN ('contributor','editor','admin'))
    )
  );

-- UPDATE POLICY: Allow editor+
CREATE POLICY "Submissions UPDATE via vertical" ON public.submissions
  FOR UPDATE USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.vertical_id) IN ('editor','admin')
    ))
    OR
    (employee_id IS NOT NULL AND public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'))
  ) WITH CHECK (
    (CASE WHEN status = 'approved' THEN auth.uid() != submitted_by ELSE true END)
    AND (
      (task_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND public.get_user_permission_level(t.vertical_id) IN ('editor','admin')
      ))
      OR
      (employee_id IS NOT NULL AND public.get_user_permission_level('EMPLOYEES') IN ('editor','admin'))
    )
  );

-- DELETE POLICY: Allow admin only
CREATE POLICY "Submissions DELETE via vertical" ON public.submissions
  FOR DELETE USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.vertical_id) = 'admin'
    ))
    OR
    (employee_id IS NOT NULL AND public.get_user_permission_level('EMPLOYEES') = 'admin')
  );

-- 6. Fix create_entity_atomic RPC — add employee_id support
-- Replaces the old version which hard-required task_id, breaking employee doc uploads.
DO $wrapper$
BEGIN
    EXECUTE $function_body$
        CREATE OR REPLACE FUNCTION public.create_entity_atomic(
          p_entity_type text,
          p_metadata    jsonb DEFAULT '{}',
          p_domain_data jsonb DEFAULT '{}'
        ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
        DECLARE
          v_entity       public.entities%ROWTYPE;
          v_domain       jsonb;
          v_task_id      uuid;
          v_employee_id  uuid;
          v_user_id      uuid;
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

              -- Guard: must have at least one parent context
              IF v_task_id IS NULL AND v_employee_id IS NULL THEN
                RAISE EXCEPTION 'proof_of_work domain insert requires task_id or employee_id';
              END IF;

              -- Guard: submitter is always required
              IF v_user_id IS NULL THEN
                RAISE EXCEPTION 'proof_of_work domain insert requires submitted_by';
              END IF;

              -- Insert the submission record linked to the entity
              INSERT INTO public.submissions (
                task_id,
                employee_id,
                submitted_by,
                comment,
                links,
                entity_id
              ) VALUES (
                v_task_id,
                v_employee_id,
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

    EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_entity_atomic(text, jsonb, jsonb) TO service_role';
END $wrapper$;

-- 7. PostgreSQL Kick
NOTIFY pgrst, 'reload schema';
