-- =========================================================================
-- HOT/COLD STORAGE: 5/5 — ARCHIVE LOGS
-- Observability table for archival pipeline.
-- Idempotent: Safe to re-run.
-- =========================================================================

-- 1. ARCHIVE LOGS TABLE
CREATE TABLE IF NOT EXISTS public.archive_logs (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id        uuid        NOT NULL,
  entity_type   text        NOT NULL,
  batch_id      text,
  status        text        NOT NULL,
  records_count integer     DEFAULT 0,
  error_message text,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. CHECK CONSTRAINT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'archive_logs' AND constraint_name = 'chk_archive_logs_status'
  ) THEN
    ALTER TABLE public.archive_logs ADD CONSTRAINT chk_archive_logs_status
      CHECK (status IN ('success', 'failure', 'skipped'));
  END IF;
END $$;

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_archive_logs_run 
  ON public.archive_logs (run_id);
CREATE INDEX IF NOT EXISTS idx_archive_logs_status 
  ON public.archive_logs (status) WHERE status = 'failure';
CREATE INDEX IF NOT EXISTS idx_archive_logs_created 
  ON public.archive_logs (created_at DESC);

-- 4. RLS
ALTER TABLE public.archive_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Archive logs master_admin read" ON public.archive_logs;
CREATE POLICY "Archive logs master_admin read" ON public.archive_logs
  FOR SELECT USING (public.is_master_admin());

DROP POLICY IF EXISTS "Archive logs service_role bypass" ON public.archive_logs;
CREATE POLICY "Archive logs service_role bypass" ON public.archive_logs
  FOR ALL USING (auth.role() = 'service_role');

-- 5. LOG RETENTION FUNCTION
-- Called by the GitHub Actions archive-log-cleanup.yml workflow daily.
-- Deletes archive_logs older than 30 days.
-- Idempotent: CREATE OR REPLACE is safe to re-run.
CREATE OR REPLACE FUNCTION public.cleanup_archive_logs()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  DELETE FROM public.archive_logs
  WHERE created_at < now() - INTERVAL '30 days';
$$;

-- Grant execute to service_role (called via REST API from GitHub Actions)
GRANT EXECUTE ON FUNCTION public.cleanup_archive_logs TO service_role;

-- 6. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
