-- =========================================================================
-- POWERPROJECT: Make submissions.submitted_by nullable
-- Required so that public QR-code support requests (anonymous source)
-- can create a submission record without crashing if the assigned manager
-- has no linked user_profiles account.
-- Idempotent: Safe to re-run.
-- =========================================================================

ALTER TABLE public.submissions ALTER COLUMN submitted_by DROP NOT NULL;

-- Index for quick lookups by submitter when it is set (partial index skips nulls)
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by
  ON public.submissions(submitted_by)
  WHERE submitted_by IS NOT NULL;

NOTIFY pgrst, 'reload schema';
