-- =========================================================================
-- POWERPROJECT v1.1.5: PROOF OF WORK — SUBMISSIONS
-- Single migration: Table + Trigger + Storage + RLS + Storage Policies
-- Idempotent: Safe to re-run.
-- =========================================================================

-- ─── 1. SUBMISSIONS TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id            uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id       uuid           NOT NULL,
  submitted_by  uuid           NOT NULL,
  submission_number integer    NOT NULL DEFAULT 1,
  comment       text,
  links         jsonb          DEFAULT '[]'::jsonb,
  -- JSONB Schema:
  -- [{"file_name":"photo.jpg","url":"https://...","provider":"supabase","tier":"hot","mime_type":"image/jpeg"}]
  -- provider: "supabase" | "google_drive" (future swap without frontend breakage)
  -- tier: "hot" (active storage) | "cold" (archived)
  status        text           NOT NULL DEFAULT 'pending',
  created_at    timestamptz    NOT NULL DEFAULT now()
);

-- Foreign Keys (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissions_task_id_fkey'
      AND table_name = 'submissions'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'submissions_submitted_by_fkey'
      AND table_name = 'submissions'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_submitted_by_fkey
      FOREIGN KEY (submitted_by) REFERENCES public.user_profiles(id);
  END IF;
END $$;

-- Index for fast lookups by task
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON public.submissions(task_id);

-- ─── 2. AUTO-INCREMENT SUBMISSION NUMBER (Per Task) ────────────────────────
CREATE OR REPLACE FUNCTION public.set_submission_number()
RETURNS TRIGGER AS $$
BEGIN
  SELECT COALESCE(MAX(submission_number), 0) + 1
    INTO NEW.submission_number
    FROM public.submissions
    WHERE task_id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_submission_number ON public.submissions;
CREATE TRIGGER trg_set_submission_number
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_submission_number();

-- ─── 3. STORAGE BUCKET ────────────────────────────────────────────────────
-- Public for now. Future: Convert to private + signed URLs with RBAC-based RLS.
INSERT INTO storage.buckets (id, name, public)
VALUES ('field-submissions', 'field-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 4. RLS POLICIES — SUBMISSIONS TABLE ──────────────────────────────────
-- Vertically-agnostic: joins through tasks.verticalid for dynamic scoping.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: contributor+ on the task's vertical
DROP POLICY IF EXISTS "Submissions SELECT via task vertical" ON public.submissions;
CREATE POLICY "Submissions SELECT via task vertical" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.verticalid) IN ('viewer','contributor','editor','admin')
    )
  );

-- INSERT: contributor+ can submit proof of work
DROP POLICY IF EXISTS "Submissions INSERT via task vertical" ON public.submissions;
CREATE POLICY "Submissions INSERT via task vertical" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = submitted_by
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.verticalid) IN ('contributor','editor','admin')
    )
  );

-- UPDATE: editor+ can change status (approve/reject)
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
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.verticalid) IN ('editor','admin')
    )
  );

-- DELETE: admin only
DROP POLICY IF EXISTS "Submissions DELETE via task vertical" ON public.submissions;
CREATE POLICY "Submissions DELETE via task vertical" ON public.submissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = submissions.task_id
        AND public.get_user_permission_level(t.verticalid) = 'admin'
    )
  );

-- Master admin override
DROP POLICY IF EXISTS "Submissions master_admin full access" ON public.submissions;
CREATE POLICY "Submissions master_admin full access" ON public.submissions
  FOR ALL USING (public.is_master_admin());

-- ─── 5. STORAGE POLICIES — field-submissions BUCKET ───────────────────────
-- Public bucket: authenticated users can upload and read.
-- Future: Replace with RBAC-based RLS once bucket is made private.

-- Allow authenticated users to upload files
DROP POLICY IF EXISTS "Field submissions upload" ON storage.objects;
CREATE POLICY "Field submissions upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'field-submissions');

-- Allow authenticated users to read files
DROP POLICY IF EXISTS "Field submissions read" ON storage.objects;
CREATE POLICY "Field submissions read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'field-submissions');

-- Allow file owners to update their uploads
DROP POLICY IF EXISTS "Field submissions update own" ON storage.objects;
CREATE POLICY "Field submissions update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'field-submissions' AND auth.uid()::text = owner_id::text);

-- Allow admins to delete files
DROP POLICY IF EXISTS "Field submissions delete admin" ON storage.objects;
CREATE POLICY "Field submissions delete admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'field-submissions' AND public.is_master_admin());

-- ─── 6. POSTGRESQL KICK ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
