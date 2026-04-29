# ✅ Checkpoint 5 — After Phase 6 (Archive Engine — First Run)

> **Run this BEFORE starting Phase 7.**
> This is the most critical checkpoint in the entire system.
> A passing result here means data is moving from Supabase → Google Drive correctly.

Replace ALL placeholders:
- `<PROJECT_REF>` → your Supabase project ref
- `<SERVICE_ROLE_KEY>` → your service role key

---

## Step 1: Deploy the Archive Function

```bash
npx supabase functions deploy entity-archive
```

Expected output ends with:
```
Deployed Function entity-archive
```

---

## Step 2: Run the Phase 9 Migration First (archive_logs MUST exist before archive runs)

> ⚠️ **Do this before triggering the archive.** If `archive_logs` doesn't exist, the function will crash silently on every run.

```bash
npx supabase db push --linked
```

Or run the migration directly in the SQL Editor:
```sql
-- Paste the full content of:
-- supabase/migrations/20260406000005_archive_logs.sql
```

Then verify the table exists:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'archive_logs';
```

**Expected — 1 row.**

---

## Step 3: Insert 5 Test Entities (Backdated to 30 Days Ago)

Run in Supabase SQL Editor:

```sql
-- Insert 5 test hot entities backdated so they are immediately eligible
INSERT INTO public.entities (entity_type, storage_tier, metadata, created_at)
SELECT
  'proof_of_work',
  'hot',
  jsonb_build_object('source', 'checkpoint_5_test', 'index', generate_series),
  now() - INTERVAL '30 days'
FROM generate_series(1, 5);
```

Note the entity IDs that were created:
```sql
SELECT id FROM public.entities
WHERE metadata->>'source' = 'checkpoint_5_test'
ORDER BY created_at;
```

You don't need linked submissions for this test — the archiver fetches domain data using `fetchFullBatchData` which will return an empty `domain_data: {}` for entities with no matching submission. That is acceptable for testing the pipeline.

---

## Step 4: Trigger the Archive Function Manually

```bash
HTTP_STATUS=$(curl -s -o /tmp/archive_test.json -w "%{http_code}" \
  -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-archive" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "HTTP Status: $HTTP_STATUS"
echo "--- Response ---"
cat /tmp/archive_test.json | python3 -m json.tool 2>/dev/null || cat /tmp/archive_test.json
```

**Expected HTTP status: `200`**

**Expected response body shape:**
```json
{
  "run_id": "<some-uuid>",
  "total_duration_ms": <number>,
  "results": [
    {
      "entity_type": "proof_of_work",
      "status": "success",
      "archived": 5,
      "batches": 1
    }
  ]
}
```

Note: If `archived: 0` and `status: "skipped"` — your test entities were not found. Check that `archive_after_days` = 7 in the registry and the inserts were backdated 30 days.

---

## Step 5: Verify Entities Are Now Cold in the Database

```sql
SELECT id, storage_tier, cold_provider, cold_pointer, cold_batch_id, cold_index, archived_at
FROM public.entities
WHERE metadata->>'source' = 'checkpoint_5_test'
ORDER BY cold_index;
```

**Expected — all 5 rows have:**
- `storage_tier = 'cold'`
- `cold_provider = 'gdrive'`
- `cold_pointer` = a non-null Drive file ID (looks like: `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`)
- `cold_batch_id` = same value for all 5 (they were in 1 batch)
- `cold_index` = 0, 1, 2, 3, 4 (sequential)
- `archived_at` = a non-null timestamp

---

## Step 6: Verify File Exists in Google Drive

1. Open [Google Drive](https://drive.google.com)
2. Navigate to `PowerProject-ColdStorage` → `cold-storage` → `proof_of_work` → `<YYYY-MM>/`
3. You should see a file named like `proof_of_work_<timestamp>_0_<uuid-suffix>.json.gz`
4. The file size will be very small (a few KB) since it contains only 5 records

---

## Step 7: Check Archive Logs

```sql
SELECT run_id, entity_type, status, records_count, duration_ms, error_message, created_at
FROM public.archive_logs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected — 1 or more rows** with:
- `status = 'success'`
- `records_count = 5`
- `error_message = NULL`

---

## Step 8: Verify Idempotency (Re-run Archive — Should Skip)

Trigger the archive again:
```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-archive" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response this time:**
```json
{
  "results": [
    {
      "entity_type": "proof_of_work",
      "status": "skipped",
      "count": 0
    }
  ]
}
```

The same 5 entities are now `cold` so they are excluded by the `.eq("storage_tier", "hot")` filter. This confirms idempotency.

---

## Step 9: Clean Up Test Data

> **Leave the cold entities in place** — you'll need them for Checkpoint 6 (cold reads).
> Only clean up after Checkpoint 6 is complete.

---

## ✅ Checkpoint PASSED if:
- Archive function returned HTTP 200 with `status: "success"` and `archived: 5`
- All 5 entities in DB have `storage_tier = 'cold'` with valid `cold_pointer`
- Gzipped file visible in Google Drive
- Archive logs table has a success entry
- Re-run returns `status: "skipped"` (idempotency confirmed)

## ❌ Checkpoint FAILED if:
- HTTP 500 → check Function logs in Supabase Dashboard → Functions → Logs (most common cause: `archive_logs` table doesn't exist yet)
- `archived: 0` / `skipped` on first run → entities not old enough. Run this to force them: `UPDATE public.entities SET created_at = now() - INTERVAL '30 days' WHERE metadata->>'source' = 'checkpoint_5_test';`
- `cold_pointer = NULL` → Drive upload failed. Go to Checkpoint 3 and re-test GDrive connectivity.
- Archive log shows `error_message` with text → read the error, likely a missing import or mis-typed field name.

---

**➡️ Proceed to Phase 7 only after this checkpoint passes.**
