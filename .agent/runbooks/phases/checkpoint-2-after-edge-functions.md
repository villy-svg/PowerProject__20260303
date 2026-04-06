# ✅ Checkpoint 2 — After Phase 2 + Phase 3 (Edge Functions)

> **Run this BEFORE starting Phase 4.**
> You need your Supabase project URL, anon key, and service role key.
> Find them in: **Supabase Dashboard → Project Settings → API**

Replace ALL placeholders before running:
- `<PROJECT_REF>` → your project ref (e.g. `abcdefghijklmno`)
- `<ANON_KEY>` → your `anon` public key
- `<SERVICE_ROLE_KEY>` → your `service_role` secret key
- `<VALID_TASK_UUID>` → a real task ID from your `tasks` table
- `<VALID_USER_UUID>` → a real user ID from your `auth.users` table

---

## Step 1: Verify Migrations Applied for Phase 2

```sql
-- Check the atomic RPC function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'create_entity_atomic';
```

**Expected — 1 row:**

| routine_name          | routine_type |
|-----------------------|--------------|
| create_entity_atomic  | FUNCTION     |

**If missing**: Run the migration `20260406000006_rpc_create_entity_atomic.sql` in the SQL editor.

---

## Step 2: Verify Edge Functions Are Deployed

```bash
npx supabase functions list
```

**Expected output must include:**
```
entity-create    <timestamp>
entity-read      <timestamp>
```

If either is missing, deploy them:
```bash
npx supabase functions deploy entity-create
npx supabase functions deploy entity-read
```

---

## Step 3: Test `entity-create` — Missing Auth (should FAIL with 401)

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "proof_of_work"}'
```

**Expected response:**
```json
{"success":false,"error":"Missing Authorization header","code":"UNAUTHORIZED"}
```

---

## Step 4: Test `entity-create` — Invalid entity_type (should FAIL with 400)

```bash
curl -s -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"entity_type": "does_not_exist"}'
```

**Expected response:**
```json
{"success":false,"error":"Unknown entity_type: does_not_exist","code":"INVALID_ENTITY_TYPE"}
```

---

## Step 5: Test `entity-create` — Valid `proof_of_work` (should SUCCEED with 201)

```bash
curl -s -o /tmp/create_response.json -w "%{http_code}" \
  -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-create" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "proof_of_work",
    "domain_data": {
      "task_id": "<VALID_TASK_UUID>",
      "submitted_by": "<VALID_USER_UUID>",
      "comment": "Checkpoint test submission",
      "links": []
    },
    "metadata": {"source": "checkpoint_test"}
  }'

echo "--- Response body ---"
cat /tmp/create_response.json
```

**Expected HTTP status: `201`**

**Expected response body shape:**
```json
{
  "success": true,
  "entity": {
    "id": "<some-uuid>",
    "entity_type": "proof_of_work",
    "storage_tier": "hot",
    "created_at": "2026-...",
    "metadata": {"source": "checkpoint_test"}
  },
  "domain": {
    "id": "<some-uuid>",
    "task_id": "<VALID_TASK_UUID>",
    "submitted_by": "<VALID_USER_UUID>",
    "comment": "Checkpoint test submission",
    "entity_id": "<same-entity-id-as-above>",
    ...
  }
}
```

**CRITICAL check**: `entity.id` must equal `domain.entity_id`. This proves atomicity worked.

Note down the `entity.id` value — call it `<TEST_ENTITY_UUID>`. You'll need it in Step 6.

---

## Step 6: Verify in Database (Confirm Atomicity)

```sql
-- Check entity record exists
SELECT id, entity_type, storage_tier, metadata
FROM public.entities
WHERE metadata->>'source' = 'checkpoint_test';
```

**Expected — 1 row** with `storage_tier = 'hot'`.

```sql
-- Check submission record was linked
SELECT s.id, s.task_id, s.entity_id, s.comment
FROM public.submissions s
JOIN public.entities e ON s.entity_id = e.id
WHERE e.metadata->>'source' = 'checkpoint_test';
```

**Expected — 1 row** with `entity_id` matching the entity `id` from Step 5.

---

## Step 7: Test `entity-read` — Missing ID (should FAIL with 400)

```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**Expected:**
```json
{"success":false,"error":"id parameter is required","code":"MISSING_ID"}
```

---

## Step 8: Test `entity-read` — Non-existent ID (should FAIL with 404)

```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**Expected:**
```json
{"success":false,"error":"Entity not found","code":"NOT_FOUND"}
```

---

## Step 9: Test `entity-read` — Read the Entity Created in Step 5

```bash
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<TEST_ENTITY_UUID>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**Expected:**
```json
{
  "success": true,
  "entity": {
    "id": "<TEST_ENTITY_UUID>",
    "entity_type": "proof_of_work",
    "storage_tier": "hot",
    "archived_at": null,
    "metadata": {"source": "checkpoint_test"}
  },
  "domain": {
    "table": "submissions",
    "record_id": "<submission-uuid>",
    "data": {
      "comment": "Checkpoint test submission",
      ...
    }
  }
}
```

**Verify**: `entity.storage_tier` is `"hot"`, `archived_at` is `null`.

---

## Step 10: Clean Up Test Data

```sql
-- Delete test submission first (FK constraint)
DELETE FROM public.submissions
WHERE entity_id IN (
  SELECT id FROM public.entities WHERE metadata->>'source' = 'checkpoint_test'
);

-- Then delete test entity
DELETE FROM public.entities WHERE metadata->>'source' = 'checkpoint_test';
```

---

## ✅ Checkpoint PASSED if:
- `create_entity_atomic` RPC exists in Step 1
- Both functions listed in Step 2
- Steps 3 and 4 returned correct 401/400 errors
- Step 5 returned HTTP 201 with correct shape
- Database queries in Step 6 show linked records
- Steps 7 and 8 returned correct errors
- Step 9 returned the entity with hot data

## ❌ Checkpoint FAILED if:
- HTTP status is not `201` in Step 5 → check Edge Function logs in Supabase Dashboard → Functions → Logs
- `entity_id` in submission doesn't match entity `id` → the RPC may have failed silently
- `entity-read` returns `domain: null` → check the FK alias in the hot data fetcher

---

**➡️ Proceed to Phase 4 only after this checkpoint passes.**
