# ✅ Checkpoint 8 — Final Production Readiness Check

> **Run this after Phase 9 and Phase 10 are complete.**
> This is the final gate before the system is considered production-ready.

Replace ALL placeholders:
- `<PROJECT_REF>` → your Supabase project ref
- `<SERVICE_ROLE_KEY>` → your service role key
- `<ANON_KEY>` → your anon key

---

## Step 1: Full System Component Check

Run this checklist and confirm each item:

### Migrations Applied
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('entities', 'entity_type_registry', 'archive_logs')
ORDER BY table_name;
```
**Expected: 3 rows** (archive_logs, entities, entity_type_registry)

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('create_entity_atomic', 'cleanup_archive_logs');
```
**Expected: 2 rows**

### Edge Functions Deployed
```bash
npx supabase functions list
```
**Expected: entity-create, entity-read, entity-archive all listed**

### GitHub Actions Workflows Committed
```bash
ls .github/workflows/
```
**Expected: archive-cron.yml, archive-log-cleanup.yml, archive-failure-alert.yml**

---

## Step 2: End-to-End Flow Test (Production Simulation)

This test goes through the full lifecycle: Create → Read (hot) → Archive → Read (cold).

### 2a. Create a test entity
```bash
CREATE_RESPONSE=$(curl -s \
  -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "proof_of_work", "metadata": {"source": "e2e_final_test"}}')

ENTITY_ID=$(echo $CREATE_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['entity']['id'])" 2>/dev/null)
echo "Created entity: $ENTITY_ID"
```

### 2b. Read it (should be hot)
```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=$ENTITY_ID" \
  -H "Authorization: Bearer <ANON_KEY>" | python3 -c "import sys,json; r=json.load(sys.stdin); print('Tier:', r['entity']['storage_tier'])"
```
**Expected: `Tier: hot`**

### 2c. Backdate it and trigger archive
```sql
UPDATE public.entities
SET created_at = now() - INTERVAL '30 days'
WHERE metadata->>'source' = 'e2e_final_test';
```

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-archive" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2d. Read it again (should now be cold)
```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=$ENTITY_ID" \
  -H "Authorization: Bearer <ANON_KEY>" | python3 -c "import sys,json; r=json.load(sys.stdin); print('Tier:', r['entity']['storage_tier'], '| Source:', r['domain']['source'])"
```
**Expected: `Tier: cold | Source: cold`**

---

## Step 3: Verify Archive Logs are Working

```sql
SELECT run_id, entity_type, status, records_count, duration_ms, created_at
FROM public.archive_logs
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** At least 1 row with `status = 'success'`.

---

## Step 4: Verify Log Retention RPC Exists

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'cleanup_archive_logs';
```
**Expected: 1 row**

Test it runs without error:
```sql
SELECT public.cleanup_archive_logs();
```
**Expected: no error, returns void**

---

## Step 5: Performance Benchmarks

Run 3 cold reads and record the times:
```bash
for i in 1 2 3; do
  echo -n "Cold read $i: "
  time curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=$ENTITY_ID" \
    -H "Authorization: Bearer <ANON_KEY>" > /dev/null
done
```

**Record these times in the runbook tracker.** Acceptable targets:
- Cold read #1 (cache miss): < 2000ms
- Cold reads #2 and #3 (cache hit, same worker): < 300ms

---

## Step 6: Verify RLS is Not Bypassed

Attempt to read `archive_logs` without admin credentials:
```bash
curl -s "https://<PROJECT_REF>.supabase.co/rest/v1/archive_logs" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```
**Expected: empty array `[]`** (RLS blocks non-admin reads)

---

## Step 7: Clean Up Final Test Data

```sql
DELETE FROM public.entities WHERE metadata->>'source' = 'e2e_final_test';
DELETE FROM public.archive_logs WHERE entity_type = 'proof_of_work'
  AND created_at > now() - INTERVAL '1 hour';
```

---

## Step 8: Update the Master Runbook

Open `.agent/runbooks/hot-cold-storage-runbook.md` and:
1. Mark all phases as `[x] DONE` in the Phase Tracker table
2. Update File Registry — all files to `Created`
3. Fill in your measured cold read latency in the Performance section

---

## ✅ System is Production-Ready when:
- [ ] End-to-end test (Step 2) passes all 4 stages
- [ ] Archive logs are writing correctly
- [ ] Log retention RPC exists and runs without error
- [ ] Cold read latency < 2000ms (cache miss), < 300ms (cache hit)
- [ ] RLS blocks unauthorized archive_logs access
- [ ] All 3 GitHub Actions workflows visible in repo

## ❌ System Needs More Work if:
- End-to-end test fails at any stage → go back to the relevant phase checkpoint
- Cold reads consistently > 3000ms → consider Phase 10B batch size tuning or Drive region proximity
- `cleanup_archive_logs` function is missing → re-run Phase 9 migration
- GitHub Actions workflow doesn't appear → check YAML validity with `yamllint`

---

## 🎉 Congratulations — Hot/Cold Storage System is Live!

The system will now automatically:
1. Archive `proof_of_work` submissions older than 7 days to Google Drive every 6 hours
2. Clean up archive logs older than 30 days every midnight
3. Notify you via email if any archive run fails (GitHub Actions failure notifications)

To add a new entity type in the future:
```sql
INSERT INTO public.entity_type_registry
  (entity_type, display_name, hot_table, has_binary_assets, storage_bucket, cold_provider, archive_after_days, batch_size)
VALUES
  ('your_new_type', 'Your Display Name', 'your_table', false, null, 'gdrive', 30, 25)
ON CONFLICT (entity_type) DO UPDATE SET enabled = true;
```

Then add a fetcher for the new type in `entity-archive/index.ts` → `fetchFullBatchData()` function.
