-- =========================================================================
-- POWERPROJECT v1.1.5: PROOF OF WORK — FLOW HARDENING
-- Hardens the submissions table with schema validation and audit blocks.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. Function to validate links schema (Since subqueries aren't allowed in CHECK constraints)
CREATE OR REPLACE FUNCTION public.validate_submission_links(links jsonb)
RETURNS boolean AS $$
BEGIN
  IF jsonb_typeof(links) != 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(links) = 0 THEN RETURN true; END IF;
  
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(links) AS val
    WHERE NOT (val ? 'url' AND val ? 'file_name' AND val ? 'mime_type')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

DO $$
BEGIN
  -- 2. JSONB Schema Check: Use the function in the CHECK constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'submissions' AND constraint_name = 'chk_submissions_links_schema'
  ) THEN
    ALTER TABLE public.submissions 
      ADD CONSTRAINT chk_submissions_links_schema 
      CHECK (public.validate_submission_links(links));
  END IF;

  -- 2. Hardened RLS: Self-Approval Audit Block
  -- Update the existing UPDATE policy to prevent users from approving their own work.
  DROP POLICY IF EXISTS "Submissions UPDATE via task vertical" ON public.submissions;
  CREATE POLICY "Submissions UPDATE via task vertical" ON public.submissions
    FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND public.get_user_permission_level(t.verticalid) IN ('editor','admin')
      )
    )
    WITH CHECK (
      -- Hard Guard: New status 'approved' is forbidden if auth.uid() is the submitter
      (CASE WHEN status = 'approved' THEN auth.uid() != submitted_by ELSE true END)
      AND EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id = submissions.task_id
          AND public.get_user_permission_level(t.verticalid) IN ('editor','admin')
      )
    );

END $$;

-- 3. Storage Policy Hardening (Optional but recommended)
-- Limit updates to the owner only (already exists but re-enforcing consistency)
DROP POLICY IF EXISTS "Field submissions update own" ON storage.objects;
CREATE POLICY "Field submissions update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'field-submissions' AND auth.uid()::text = owner_id::text);
