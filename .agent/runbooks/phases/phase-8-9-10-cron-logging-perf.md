# Phases 8-10: Cron, Logging, Performance — Execution Guide

> **Prerequisite**: Phase 7 complete (full hot/cold cycle works).  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`

---

## Phase 8: Cron Job Setup

### Option A: pg_cron (Supabase Pro Plan)

**File**: `supabase/migrations/20260406000004_archive_cron.sql`

```sql
-- =========================================================================
-- HOT/COLD STORAGE: 4/5 — ARCHIVE CRON JOB
-- Requires pg_cron extension (Pro plan).
-- Idempotent: Uses ON CONFLICT pattern.
-- =========================================================================

-- Enable pg_cron if not already
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule archive function every 30 minutes
SELECT cron.schedule(
  'archive-cold-storage',        -- job name
  '*/30 * * * *',                -- every 30 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/entity-archive',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
```

### Option B: GitHub Actions (Free Plan)

**File**: `.github/workflows/archive-cron.yml`

```yaml
name: Cold Storage Archive
on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch: {}       # Manual trigger

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Archive Edge Function
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/entity-archive" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            --max-time 55
```

### Validation

```sql
-- Verify pg_cron schedule (Option A)
SELECT * FROM cron.job WHERE jobname = 'archive-cold-storage';
```

For Option B: Check GitHub Actions run history.

### Rollback
```sql
-- Option A
SELECT cron.unschedule('archive-cold-storage');
```

---

## Phase 9: Logging & Observability

**File**: `supabase/migrations/20260406000005_archive_logs.sql`

```sql
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

-- 5. Auto-cleanup: Keep only last 30 days of logs
-- (Can be done via separate cron job or manual cleanup)

-- 6. POSTGRESQL KICK
NOTIFY pgrst, 'reload schema';
```

### Observability Queries

```sql
-- Latest run summary
SELECT run_id, entity_type, status, records_count, duration_ms, created_at
FROM public.archive_logs
ORDER BY created_at DESC
LIMIT 20;

-- Failed runs (alert dashboard)
SELECT * FROM public.archive_logs
WHERE status = 'failure'
ORDER BY created_at DESC
LIMIT 10;

-- Daily stats
SELECT 
  DATE(created_at) AS day,
  COUNT(*) FILTER (WHERE status = 'success') AS successes,
  COUNT(*) FILTER (WHERE status = 'failure') AS failures,
  SUM(records_count) FILTER (WHERE status = 'success') AS total_archived
FROM public.archive_logs
GROUP BY DATE(created_at)
ORDER BY day DESC
LIMIT 7;
```

### Validation

1. Run the archive function manually
2. Check `archive_logs` for entries
3. Simulate a failure (invalid credentials) → verify failure log
4. Verify `run_id` groups logs per invocation

---

## Phase 10: Performance Hardening

### Phase 10A: Batch File Caching

Add in-memory LRU cache to `entity-read` for cold batch files:

```typescript
// Simple in-memory cache (per Edge Function worker)
const batchCache = new Map<string, { data: Uint8Array; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

function getCachedBatch(pointer: string): Uint8Array | null {
  const entry = batchCache.get(pointer);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    batchCache.delete(pointer);
    return null;
  }
  return entry.data;
}

function setCachedBatch(pointer: string, data: Uint8Array) {
  // Evict oldest if at capacity
  if (batchCache.size >= MAX_CACHE_SIZE) {
    const oldest = [...batchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    batchCache.delete(oldest[0]);
  }
  batchCache.set(pointer, { data, ts: Date.now() });
}
```

### Phase 10B: Batch Size Optimization

After running in production, analyze:

```sql
-- Average compressed batch size and compression ratio
SELECT 
  entity_type,
  batch_size,
  AVG(records_count) AS avg_records,
  COUNT(*) AS total_runs
FROM public.archive_logs al
JOIN public.entity_type_registry etr ON al.entity_type = etr.entity_type
WHERE al.status = 'success'
GROUP BY entity_type, batch_size;
```

Tune `batch_size` in `entity_type_registry` based on:
- Target compressed file size: 100KB-1MB
- Drive API rate limits
- Edge Function timeout (60s)

### Phase 10C: Retry Logic

Add exponential backoff for Drive API calls:

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Usage in adapter:
const pointer = await withRetry(() => adapter.upload(batchId, data, metadata));
```

### Phase 10D: Load Testing

```typescript
// Generate 1000 test entities
const testEntities = [];
for (let i = 0; i < 1000; i++) {
  testEntities.push({
    entity_type: "proof_of_work",
    metadata: { test: true, index: i },
    // Set created_at to 100 days ago for archival eligibility
  });
}

// Insert via batch
// Run archive
// Measure: total time, per-batch time, Drive API calls
// Verify: all 1000 entities archived correctly
```

### Validation

- [ ] Cold reads < 500ms (with cache warm)
- [ ] Cold reads < 2000ms (cache miss)
- [ ] Retry handles transient 429 errors
- [ ] 1000-record archive completes within 60s

---

## After Completion

Update the runbook:
1. Set Phase 8-10 status to `[x] DONE`
2. Record performance benchmarks
3. Final system validation checklist
4. Document production deployment steps
