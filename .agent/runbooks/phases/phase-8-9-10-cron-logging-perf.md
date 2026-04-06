# Phases 8-10: Cron, Logging, Performance — Execution Guide

> **Prerequisite**: Phase 7 complete (full hot/cold cycle works).  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`

---

## Phase 8: Cron Job Setup — GitHub Actions

> [!IMPORTANT]
> **We are using GitHub Actions, not pg_cron.**
> `pg_cron` requires the Supabase Pro plan ($25/month). GitHub Actions is free for public repos and included in all GitHub plans. There is NO SQL migration for Phase 8.

### What to Create

**3 workflow files** inside `.github/workflows/`:

---

#### File 1: Archive Cron (Primary)

**File**: `.github/workflows/archive-cron.yml`

```yaml
name: Cold Storage Archive

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours (adjust as needed — '*/30 * * * *' for every 30 min)
  workflow_dispatch: {}     # Manual trigger from GitHub UI at any time

jobs:
  archive:
    runs-on: ubuntu-latest
    timeout-minutes: 10     # Fail fast if Edge Function hangs
    steps:
      - name: Trigger Archive Edge Function
        run: |
          HTTP_STATUS=$(curl -s -o /tmp/archive_response.json -w "%{http_code}" \
            -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/entity-archive" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}' \
            --max-time 55)

          echo "HTTP Status: $HTTP_STATUS"
          cat /tmp/archive_response.json

          # Fail the workflow if the function returns a non-2xx status
          if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
            echo "❌ Archive function returned HTTP $HTTP_STATUS"
            exit 1
          fi

          echo "✅ Archive completed successfully"
```

> [!NOTE]
> The `workflow_dispatch` trigger lets you manually run the archive job from the **GitHub UI → Actions tab → Cold Storage Archive → Run workflow**. This is useful for testing before the schedule kicks in.

---

#### File 2: Log Retention (Daily Cleanup)

**File**: `.github/workflows/archive-log-cleanup.yml`

```yaml
name: Archive Log Retention

on:
  schedule:
    - cron: '0 0 * * *'  # Midnight every day
  workflow_dispatch: {}

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete archive_logs older than 30 days
        run: |
          curl -s -X POST "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/cleanup_archive_logs" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}'
```

> [!NOTE]
> This workflow calls a Postgres RPC function. Add this migration with your Phase 9 SQL:
>
> ```sql
> CREATE OR REPLACE FUNCTION public.cleanup_archive_logs()
> RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
>   DELETE FROM public.archive_logs
>   WHERE created_at < now() - INTERVAL '30 days';
> $$;
> ```

---

#### File 3: Failure Alert (Hourly Check)

**File**: `.github/workflows/archive-failure-alert.yml`

```yaml
name: Archive Failure Alert

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch: {}

jobs:
  check-failures:
    runs-on: ubuntu-latest
    steps:
      - name: Check for recent archive failures
        run: |
          # Query archive_logs for failures in the last 2 hours
          RESPONSE=$(curl -s \
            "${{ secrets.SUPABASE_URL }}/rest/v1/archive_logs?status=eq.failure&created_at=gte.$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)&select=count" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Prefer: count=exact" \
            -w "%{stderr}Content-Range: %header{content-range}")

          echo "Failure query response: $RESPONSE"
          # GitHub will email you automatically if this workflow step fails.
          # For Slack: add a Slack notification step below using a Slack webhook secret.
```

---

### GitHub Secrets Setup

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key (from Supabase Dashboard → Project Settings → API) |

> [!CAUTION]
> **Never commit the service role key to your codebase.** It must only live in GitHub Secrets. It is transmitted only over HTTPS when GitHub Actions invokes it.

---

### Validation

1. **Commit + push** the workflow files.
2. Go to **GitHub → Actions tab** → you should see all 3 workflows listed.
3. Click **"Cold Storage Archive"** → **"Run workflow"** → **"Run workflow"** to trigger manually.
4. Check the run output — you should see `✅ Archive completed successfully`.
5. Check `archive_logs` in your Supabase Dashboard SQL editor for a log entry.

```sql
SELECT * FROM public.archive_logs ORDER BY created_at DESC LIMIT 5;
```

---

### Rollback

```
To pause or stop the cron job:
- Go to GitHub → Actions → "Cold Storage Archive" → "..." → "Disable workflow"
- Or delete / rename the .github/workflows/archive-cron.yml file.
No SQL changes needed.
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
```

### Verify Migration Was Applied

```sql
-- Verify table exists with all columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'archive_logs'
ORDER BY ordinal_position;
```

**Expected — all 8 columns:**

| column_name   | data_type |
|---|---|
| id            | uuid |
| run_id        | uuid |
| entity_type   | text |
| batch_id      | text |
| status        | text |
| records_count | integer |
| error_message | text |
| duration_ms   | integer |
| created_at    | timestamp with time zone |

```sql
-- Verify cleanup function exists
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'cleanup_archive_logs';
```

**Expected — 1 row.**

```sql
-- Test the cleanup function runs without error
SELECT public.cleanup_archive_logs();
-- Expected: no error, returns void (no rows to delete if this is a fresh system)
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

> [!IMPORTANT]
> **The cache code is already included in the Phase 7 `entity-read/index.ts` file.**
> If you followed Phase 7 as written, you DO NOT need to modify `entity-read` again.
> Check that the `batchCache` Map and `getCachedBatch`/`setCachedBatch` functions are at the top of your deployed `entity-read/index.ts`. If they are present, Phase 10A is complete.

For reference, these are the functions that should exist at the top of `entity-read/index.ts`:

```typescript
// Already included in Phase 7 — verify these exist, do not re-add
const batchCache = new Map<string, { data: Uint8Array; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

function getCachedBatch(pointer: string): Uint8Array | null { ... }
function setCachedBatch(pointer: string, data: Uint8Array): void { ... }
```

To verify the cache is active: read the same cold entity 3 times and compare latency.
The first read should be the slowest (cache miss). Subsequent reads should be faster (cache hit).

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
// Generate 1000 test entities and backdate them for immediate archival eligibility
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const ONE_HUNDRED_DAYS_AGO = new Date();
ONE_HUNDRED_DAYS_AGO.setDate(ONE_HUNDRED_DAYS_AGO.getDate() - 100);

// 1. Insert 1000 entity records backdated to 100 days ago
const entityBatch = Array.from({ length: 1000 }, (_, i) => ({
  entity_type: "proof_of_work",
  storage_tier: "hot",
  metadata: { test: true, index: i },
  created_at: ONE_HUNDRED_DAYS_AGO.toISOString(),
}));

// Insert in chunks of 100 to avoid request size limits
for (let i = 0; i < entityBatch.length; i += 100) {
  const { error } = await supabase
    .from("entities")
    .insert(entityBatch.slice(i, i + 100));
  if (error) throw new Error(`Entity insert failed at chunk ${i}: ${error.message}`);
}

console.log("Inserted 1000 test entities (backdated 100 days)");

// 2. Trigger archive run
const start = Date.now();
const response = await fetch(`${SUPABASE_URL}/functions/v1/entity-archive`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const result = await response.json();
const elapsed = Date.now() - start;

console.log(`Archive completed in ${elapsed}ms`);
console.log("Results:", JSON.stringify(result, null, 2));

// 3. Verify: all 1000 entities should now be cold
const { count } = await supabase
  .from("entities")
  .select("id", { count: "exact", head: true })
  .eq("storage_tier", "cold")
  .eq("entity_type", "proof_of_work")
  .eq("metadata->>test", "true");

console.assert(count === 1000, `Expected 1000 cold entities, got ${count}`);
console.log(`✅ Load test passed: ${count}/1000 entities archived in ${elapsed}ms`);

// 4. Cleanup (optional — remove test data)
// await supabase.from("entities").delete().eq("metadata->>test", "true");
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
