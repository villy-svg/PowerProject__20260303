-- =========================================================================
-- HOT/COLD STORAGE: 3/5 — SUBMISSIONS ↔ ENTITIES LINK
-- Adds entity_id FK to submissions for hot/cold routing.
-- Idempotent: Safe to re-run. Backward-compatible (nullable).
-- =========================================================================

DO $$
BEGIN
  -- 1. Add entity_id column (nullable — existing submissions are unaffected)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'submissions' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.submissions ADD COLUMN entity_id uuid;
  END IF;

  -- 2. FK constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'submissions' AND constraint_name = 'submissions_entity_id_fkey'
  ) THEN
    ALTER TABLE public.submissions ADD CONSTRAINT submissions_entity_id_fkey
      FOREIGN KEY (entity_id) REFERENCES public.entities(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Partial index (only index non-null values)
CREATE INDEX IF NOT EXISTS idx_submissions_entity_id 
  ON public.submissions (entity_id) WHERE entity_id IS NOT NULL;

-- 4. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
