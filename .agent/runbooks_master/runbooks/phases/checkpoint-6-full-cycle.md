# ✅ Checkpoint 6 — After Phase 7 (Full Hot/Cold Read Cycle)

> **Run this BEFORE starting Phase 8.**
> This verifies that cold entities created in Checkpoint 5 can be read back transparently.
>
> **Prerequisite**: Checkpoint 5 must have passed and the 5 test cold entities must still exist.

Replace ALL placeholders:
- `<PROJECT_REF>` → your Supabase project ref
- `<ANON_KEY>` → your anon key
- `<COLD_ENTITY_UUID>` → one of the 5 cold entity IDs from Checkpoint 5

---

## Step 1: Get a Cold Entity UUID

```sql
SELECT id, cold_pointer, cold_index
FROM public.entities
WHERE metadata->>'source' = 'checkpoint_5_test'
ORDER BY cold_index
LIMIT 1;
```

Note the `id` value — this is your `<COLD_ENTITY_UUID>`.

---

## Step 2: Deploy Updated `entity-read` Function

Phase 7 adds cold-read support to entity-read. Deploy it:

```bash
npx supabase functions deploy entity-read
```

---

## Step 3: Read a Cold Entity

```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<COLD_ENTITY_UUID>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**Expected response shape:**
```json
{
  "success": true,
  "entity": {
    "id": "<COLD_ENTITY_UUID>",
    "entity_type": "proof_of_work",
    "storage_tier": "cold",
    "archived_at": "2026-...",
    "metadata": {"source": "checkpoint_5_test", "index": 1}
  },
  "domain": {
    "table": "submissions",
    "record_id": null,
    "data": {},
    "source": "cold"
  }
}
```

**Per field checks:**
- `success` must be `true`
- `entity.storage_tier` must be `"cold"`
- `entity.archived_at` must be a non-null timestamp
- `domain.source` must be `"cold"` (this confirms cold path was taken)

Note: `domain.data` is empty `{}` because no submission was linked in our test. That's expected. In production, `domain.data` will contain the full submission record.

---

## Step 4: Read All 5 Cold Entities to Verify Different cold_index Values

```sql
SELECT id FROM public.entities
WHERE metadata->>'source' = 'checkpoint_5_test'
ORDER BY cold_index;
```

Run a cold read for **each** of the 5 UUIDs:
```bash
for ID in <uuid-1> <uuid-2> <uuid-3> <uuid-4> <uuid-5>; do
  echo "--- Reading $ID ---"
  curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=$ID" \
    -H "Authorization: Bearer <ANON_KEY>" | python3 -m json.tool 2>/dev/null | grep -E '"storage_tier"|"source"'
done
```

**Expected — all 5 show:**
```
"storage_tier": "cold",
"source": "cold"
```

---

## Step 5: Verify Response Shape Parity Between Hot and Cold

Create a fresh hot entity:
```bash
HOT_RESPONSE=$(curl -s \
  -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "proof_of_work", "metadata": {"source": "parity_test"}}')

HOT_ID=$(echo $HOT_RESPONSE | python3 -c "import sys,json; print(json.load(sys.stdin)['entity']['id'])" 2>/dev/null)
echo "Hot entity ID: $HOT_ID"
```

Read it:
```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=$HOT_ID" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**Compare the two responses — the top-level structure must be identical:**
- Both have `success`, `entity`, `domain` keys
- Both have `entity.id`, `entity.entity_type`, `entity.storage_tier`, `entity.metadata`
- Both have `domain.table`, `domain.record_id`, `domain.data`
- Only difference: hot has no `domain.source` or `domain.source = "hot"`, cold has `domain.source = "cold"`

---

## Step 6: Clean Up Parity Test

```sql
DELETE FROM public.entities WHERE metadata->>'source' = 'parity_test';
```

---

## Step 7: Clean Up Checkpoint 5 Test Data

Now that cold reads are confirmed working:
```sql
-- These entities are cold — their domain data (empty {}) is in Drive
-- The Drive files will be orphaned but that's acceptable for test cleanup
DELETE FROM public.entities WHERE metadata->>'source' = 'checkpoint_5_test';
```

---

## Step 8: Measure Cold Read Latency

Run 3 cold reads and note the time:
```bash
time curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<COLD_ENTITY_UUID>" \
  -H "Authorization: Bearer <ANON_KEY>" > /dev/null
```

**Acceptable latency:**
- Cache miss (first read): < 2000ms
- Cache hit (same pointer, re-read within 5 min): < 300ms

If cold read latency is > 3000ms, check:
- Drive API response time from the Edge Function runtime region
- Consider Phase 10B batch size changes

---

## ✅ Checkpoint PASSED if:
- `entity-read` returns `success: true` with `storage_tier: "cold"` for all 5 cold entities
- `domain.source: "cold"` confirms cold path was taken
- Hot and cold response shapes are structurally identical to the caller
- Cold read latency is < 2000ms (cache miss)

## ❌ Checkpoint FAILED if:
- `500: Cold read failed: ...` → most likely the `cold_pointer` is wrong or Drive file was deleted. Check Checkpoint 5 more carefully.
- `404: Entity not found in cold batch` → `cold_index` is out of range. This means the batch was serialized with a different ordering than expected. Re-check `extractFromBatch` logic.
- Response shape is different between hot and cold → `normalizeEntity()` or `fetchHotData()` return different key sets.

---

**➡️ Proceed to Phase 8 only after this checkpoint passes.**
