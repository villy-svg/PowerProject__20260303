# ✅ Checkpoint 1 — After Phase 1 (Database Foundation)

> **Run this BEFORE starting Phase 2.**
> All queries below must return the expected results. If any fail, fix Phase 1 before continuing.
> Run all queries in the **Supabase Dashboard → SQL Editor** for your project.

---

## Step 1: Verify Migration Files Were Applied

You should have run:
```
npx supabase db push --linked
```
Or for local dev:
```
npx supabase db reset
```

Confirm these 3 migration files exist in `supabase/migrations/`:
- `20260406000001_entities_table.sql`
- `20260406000002_entity_type_registry.sql`
- `20260406000003_submissions_entity_link.sql`

---

## Step 2: Verify `entities` Table

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entities'
ORDER BY ordinal_position;
```

**Expected output — you must see ALL of these columns:**

| column_name    | data_type                   | is_nullable |
|----------------|-----------------------------|-------------|
| id             | uuid                        | NO          |
| entity_type    | text                        | NO          |
| storage_tier   | text                        | NO          |
| cold_provider  | text                        | YES         |
| cold_pointer   | text                        | YES         |
| cold_batch_id  | text                        | YES         |
| cold_index     | integer                     | YES         |
| metadata       | jsonb                       | YES         |
| created_at     | timestamp with time zone    | NO          |
| archived_at    | timestamp with time zone    | YES         |

**If `entities` table does not exist**: Re-run migration `20260406000001_entities_table.sql` in the SQL editor.

---

## Step 3: Verify `entities` CHECK Constraints

```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN ('chk_entities_storage_tier', 'chk_entities_cold_provider');
```

**Expected — 2 rows:**

| constraint_name               | check_clause |
|-------------------------------|---|
| chk_entities_storage_tier     | `storage_tier = ANY (ARRAY['hot', 'cold'])` |
| chk_entities_cold_provider    | `cold_provider IS NULL OR cold_provider = ANY (ARRAY['gdrive', 's3', 'supabase_storage'])` |

---

## Step 4: Verify `entity_type_registry` Table

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'entity_type_registry'
ORDER BY ordinal_position;
```

**Expected — you must see ALL of these columns:**

| column_name        | data_type                |
|--------------------|--------------------------|
| entity_type        | text                     |
| display_name       | text                     |
| hot_table          | text                     |
| has_binary_assets  | boolean                  |
| storage_bucket     | text                     |
| cold_provider      | text                     |
| archive_after_days | integer                  |
| batch_size         | integer                  |
| enabled            | boolean                  |
| created_at         | timestamp with time zone |
| updated_at         | timestamp with time zone |

---

## Step 5: Verify Seed Data in Registry

```sql
SELECT entity_type, display_name, hot_table, has_binary_assets, storage_bucket,
       cold_provider, archive_after_days, batch_size, enabled
FROM public.entity_type_registry;
```

**Expected — exactly 1 row:**

| entity_type   | display_name              | hot_table   | has_binary_assets | storage_bucket   | cold_provider | archive_after_days | batch_size | enabled |
|---------------|---------------------------|-------------|-------------------|------------------|---------------|--------------------|------------|---------|
| proof_of_work | Proof of Work Submissions | submissions | true              | field-submissions| gdrive        | 7                  | 25         | true    |

**If seed data is missing**: Run this manually in the SQL editor:
```sql
INSERT INTO public.entity_type_registry
  (entity_type, display_name, hot_table, has_binary_assets, storage_bucket, cold_provider, archive_after_days, batch_size)
VALUES
  ('proof_of_work', 'Proof of Work Submissions', 'submissions', true, 'field-submissions', 'gdrive', 7, 25)
ON CONFLICT (entity_type) DO UPDATE SET
  display_name       = EXCLUDED.display_name,
  has_binary_assets  = EXCLUDED.has_binary_assets,
  storage_bucket     = EXCLUDED.storage_bucket,
  cold_provider      = EXCLUDED.cold_provider,
  updated_at         = now();
```

---

## Step 6: Verify `submissions.entity_id` Column

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'submissions'
  AND column_name = 'entity_id';
```

**Expected — exactly 1 row:**

| column_name | data_type | is_nullable |
|-------------|-----------|-------------|
| entity_id   | uuid      | YES         |

---

## Step 7: Verify Foreign Key Constraint

```sql
SELECT constraint_name, table_name
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND constraint_name = 'submissions_entity_id_fkey';
```

**Expected — 1 row** with `constraint_name = 'submissions_entity_id_fkey'`.

---

## Step 8: Verify Indexes

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_entities_tier_created',
    'idx_entities_type',
    'idx_entities_batch',
    'idx_submissions_entity_id'
  );
```

**Expected — 4 rows**, one for each index name above.

---

## Step 9: Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('entities', 'entity_type_registry');
```

**Expected:**

| tablename            | rowsecurity |
|----------------------|-------------|
| entities             | true        |
| entity_type_registry | true        |

---

## Step 10: Quick Smoke Test — Insert + Constraint

Run this test insert (it should **SUCCEED**):
```sql
INSERT INTO public.entities (entity_type, storage_tier)
VALUES ('proof_of_work', 'hot')
RETURNING id;
```
Note the returned UUID. Then run this test (it should **FAIL** with a constraint error):
```sql
INSERT INTO public.entities (entity_type, storage_tier)
VALUES ('test', 'warm'); -- MUST fail: 'warm' is not a valid tier
```

Clean up your test row:
```sql
DELETE FROM public.entities WHERE entity_type = 'proof_of_work' AND metadata = '{}'::jsonb;
```

---

## ✅ Checkpoint PASSED if:
- All 9 steps above show the expected rows
- The smoke test insert succeeded
- The constraint test failed as expected

## ❌ Checkpoint FAILED if:
- Any table or column is missing → re-run the corresponding migration SQL directly in the editor
- Seed data is missing → run the manual insert in Step 5
- RLS is false → run `ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;`

---

**➡️ Proceed to Phase 2 only after this checkpoint passes.**
