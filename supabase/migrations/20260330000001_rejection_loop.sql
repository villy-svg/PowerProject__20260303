-- =========================================================================
-- POWERPROJECT v1.1.5: PROOF OF WORK — REJECTION LOOP
-- Single migration: Add rejection_reason + CHECK constraint
-- Idempotent: Safe to re-run.
-- =========================================================================

DO $$
BEGIN
  -- 1. Add rejection_reason column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN rejection_reason text;
  END IF;

  -- 2. Update existing rejected submissions to have a placeholder reason
  -- This prevents the CHECK constraint from failing if there's historical data.
  UPDATE public.submissions 
  SET rejection_reason = 'Placeholder: Rework required (Historical)'
  WHERE status = 'rejected' AND rejection_reason IS NULL;

  -- 3. Add CHECK constraint: If status = 'rejected', reason CANNOT be null
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'submissions' AND constraint_name = 'chk_submissions_rejection_reason'
  ) THEN
    ALTER TABLE public.submissions 
      ADD CONSTRAINT chk_submissions_rejection_reason 
      CHECK (status != 'rejected' OR rejection_reason IS NOT NULL);
  END IF;
END $$;
