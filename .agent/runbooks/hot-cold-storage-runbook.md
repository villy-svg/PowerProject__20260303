# Hot vs Cold Storage — Master Runbook

> **Purpose**: This file persists across chats. Each phase-chat reads this file at start and updates it at end.
> **Location**: `.agent/runbooks/hot-cold-storage-runbook.md`
> **Last Updated**: 2026-04-06 (Initial creation)

---

## 📊 Phase Tracker

| Phase | Sub-Phase | Status | Chat ID | Date | Notes |
|-------|-----------|--------|---------|------|-------|
| 1A | Entities Table | `[ ] TODO` | — | — | — |
| 1B | Entity Type Registry | `[ ] TODO` | — | — | — |
| 1C | Submissions Entity Link | `[ ] TODO` | — | — | — |
| 2A | Edge Fn: Create Entity (scaffold) | `[ ] TODO` | — | — | — |
| 2B | Edge Fn: Create Entity (dispatch) | `[ ] TODO` | — | — | — |
| 2C | Edge Fn: Create Entity (normalize) | `[ ] TODO` | — | — | — |
| 3A | Edge Fn: Read Entity (hot join) | `[ ] TODO` | — | — | — |
| 3B | Edge Fn: Read Entity (normalize) | `[ ] TODO` | — | — | — |
| 4A | Storage Adapter Interface | `[ ] TODO` | — | — | — |
| 4B | GDrive Upload | `[ ] TODO` | — | — | — |
| 4C | GDrive Download + Delete | `[ ] TODO` | — | — | — |
| 4D | GDrive Integration Test | `[ ] TODO` | — | — | — |
| 5A | Batcher Logic | `[ ] TODO` | — | — | — |
| 5B | Compression Utilities | `[ ] TODO` | — | — | — |
| 5C | Batch-Compress Integration | `[ ] TODO` | — | — | — |
| 6A | Archive: Eligible Selection | `[ ] TODO` | — | — | — |
| 6B | Archive: Batch + Fetch | `[ ] TODO` | — | — | — |
| 6C | Archive: Compress → Upload → Update | `[ ] TODO` | — | — | — |
| 6D | Archive: Idempotency | `[ ] TODO` | — | — | — |
| 6E | Archive: Partial Failure | `[ ] TODO` | — | — | — |
| 7 | Read From Cold | `[ ] TODO` | — | — | — |
| 8 | Cron Job | `[ ] TODO` | — | — | — |
| 9 | Logging & Observability | `[ ] TODO` | — | — | — |
| 10A | Cache Layer | `[ ] TODO` | — | — | — |
| 10B | Batch Size Tuning | `[ ] TODO` | — | — | — |
| 10C | Retry Logic | `[ ] TODO` | — | — | — |
| 10D | Load Testing | `[ ] TODO` | — | — | — |

---

## 📁 File Registry

Files created/modified by this system. Updated after each phase.

### Migrations
| File | Phase | Status |
|------|-------|--------|
| `supabase/migrations/20260406000001_entities_table.sql` | 1A | Not Created |
| `supabase/migrations/20260406000002_entity_type_registry.sql` | 1B | Not Created |
| `supabase/migrations/20260406000003_submissions_entity_link.sql` | 1C | Not Created |
| `supabase/migrations/20260406000004_archive_cron.sql` | 8 | Not Created |
| `supabase/migrations/20260406000005_archive_logs.sql` | 9 | Not Created |

### Edge Functions
| File | Phase | Status |
|------|-------|--------|
| `supabase/functions/entity-create/index.ts` | 2 | Not Created |
| `supabase/functions/entity-read/index.ts` | 3, 7 | Not Created |
| `supabase/functions/entity-archive/index.ts` | 6 | Not Created |
| `supabase/functions/_shared/storage/adapter.ts` | 4A | Not Created |
| `supabase/functions/_shared/storage/gdrive-adapter.ts` | 4B-D | Not Created |
| `supabase/functions/_shared/batch/batcher.ts` | 5A | Not Created |
| `supabase/functions/_shared/batch/compressor.ts` | 5B | Not Created |

### Frontend Services
| File | Phase | Status |
|------|-------|--------|
| `src/services/storage/entityService.js` | 2-3 | Not Created |

---

## 🔐 Configuration & Secrets

### Required Environment Variables (Edge Functions)
```
GOOGLE_SERVICE_ACCOUNT_JSON   — GCP service account key (JSON string)
GOOGLE_DRIVE_FOLDER_ID        — Root folder ID for cold storage
SUPABASE_SERVICE_ROLE_KEY     — For pg_cron HTTP triggers
```

### Supabase Vault Secrets (set via CLI)
```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='...'
supabase secrets set GOOGLE_DRIVE_FOLDER_ID='...'
```

---

## ✅ Validation Results

### Phase 1A — Entities Table
- [ ] Table created successfully
- [ ] CHECK constraints validated (invalid tier rejected)
- [ ] Indexes confirmed via pg_indexes
- [ ] Test record inserted + queried

### Phase 1B — Entity Type Registry
- [ ] Table created successfully
- [ ] Seed data present (proof_of_work)
- [ ] ON CONFLICT idempotency verified

### Phase 1C — Submissions Entity Link
- [ ] entity_id column added to submissions
- [ ] FK constraint enforced
- [ ] Index created
- [ ] Existing submissions unaffected (entity_id = NULL)

### Phase 2 — Create Entity
- [ ] Edge Function deploys successfully
- [ ] Creates entity + domain record atomically
- [ ] Returns correct response shape
- [ ] Handles invalid entity_type gracefully

### Phase 3 — Read Entity (Hot)
- [ ] Fetches entity by ID
- [ ] Joins hot table data
- [ ] Returns normalized structure
- [ ] Returns 404 for missing entities

### Phase 4 — Google Drive Adapter
- [ ] Adapter interface compiles
- [ ] Upload creates file in Drive
- [ ] Download retrieves correct content
- [ ] Delete removes file
- [ ] Folder structure is correct

### Phase 5 — Batching + Compression
- [ ] Batch sizes match config
- [ ] Compression reduces size >50%
- [ ] Round-trip integrity verified

### Phase 6 — Archive Function
- [ ] Archives eligible entities
- [ ] Files appear in Drive
- [ ] DB records updated (tier, pointer, index, archived_at)
- [ ] Idempotent on re-run
- [ ] Partial failures handled gracefully

### Phase 7 — Read From Cold
- [ ] Archived record readable
- [ ] Response shape matches hot read
- [ ] Batch file decompression works

### Phase 8 — Cron Job
- [ ] Schedule registered in cron.job
- [ ] Periodic execution confirmed

### Phase 9 — Logging
- [ ] archive_logs table created
- [ ] Success logs captured
- [ ] Failure logs captured with error messages
- [ ] run_id groups logs correctly

### Phase 10 — Performance
- [ ] Cache reduces cold read latency
- [ ] Retry logic handles transient failures
- [ ] Load test with 1000+ records passes

---

## 🔄 Rollback Commands

### Phase 1A
```sql
DROP TABLE IF EXISTS public.entities CASCADE;
```

### Phase 1B
```sql
DROP TABLE IF EXISTS public.entity_type_registry CASCADE;
```

### Phase 1C
```sql
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_entity_id_fkey;
ALTER TABLE public.submissions DROP COLUMN IF EXISTS entity_id;
```

### Phase 8
```sql
SELECT cron.unschedule('archive-cold-storage');
```

### Phase 9
```sql
DROP TABLE IF EXISTS public.archive_logs CASCADE;
```

---

## 📋 How to Use This Runbook

### Starting a New Phase Chat

Paste this at the start of the chat:

```
I am continuing the Hot vs Cold Storage implementation.
Please read the runbook at: .agent/runbooks/hot-cold-storage-runbook.md
Execute Phase [X] as described.
After completion, update the runbook with results.
```

### After Phase Completion

The AI should:
1. Update the Phase Tracker table (status → `[x] DONE`)
2. Update the File Registry (status → `Created` / `Modified`)
3. Fill in the Validation Results checkboxes
4. Add the Chat ID and date

---

## 🏗️ Architecture Decisions

1. **Adapter Pattern for Storage**: The `StorageAdapter` interface allows swapping Google Drive for S3 or Supabase Storage without changing archive logic.
2. **Entity Type Registry**: New entity types can be added by inserting a row — no code changes needed for basic archival.
3. **Batch + Compress**: Reduces API calls to Drive and storage costs. Each batch = 1 Drive file = 20-50 entities.
4. **Nullable entity_id on submissions**: Backward-compatible. Existing submissions continue to work without entities.
5. **Edge Functions over RPC**: Edge Functions provide a cleaner HTTP abstraction layer and support non-Supabase APIs (Drive).
6. **Separation of concerns**: `entity-create` / `entity-read` / `entity-archive` are separate functions, not one monolith.

---

## 🚨 Known Constraints

- **Supabase Free Plan**: pg_cron not available → must use external scheduler
- **Google Drive API Rate Limits**: 300 req/min per user → batching is critical
- **Edge Function Timeout**: 60s default → large batches may need chunking
- **Deno Compatibility**: Must use Deno-compatible npm modules for gzip
