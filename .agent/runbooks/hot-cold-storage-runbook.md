# Hot vs Cold Storage — Master Runbook

> **Purpose**: This file persists across chats. Each phase-chat reads this file at start and updates it at end.
> **Location**: `.agent/runbooks/hot-cold-storage-runbook.md`
<!-- > **Last Updated**: 2026-04-06 (Initial creation) -->
> **Last Updated**: 2026-04-06 (Phase 1 Complete)

---

## 🚀 Execution Order for Implementation

> **For Gemini Flash**: Execute phases in this exact order. Do not skip steps. Read only the file listed for each step.

| Step | File to Execute | Action |
|------|-----------------|--------|
| 1 | `phases/phase-1-database-foundation.md` | Apply 3 migration files + run validation SQL |
| 2 | `phases/checkpoint-1-after-db-setup.md` | **USER RUNS ALL SQL CHECKS — must pass before proceeding** |
| 3 | `phases/phase-2-create-entity.md` | Apply RPC migration + deploy `entity-create` function |
| 4 | `phases/phase-3-read-entity.md` | Deploy `entity-read` function (hot path only) |
| 5 | `phases/checkpoint-2-after-edge-functions.md` | **USER RUNS CURL TESTS — must pass before proceeding** |
| 6 | `phases/phase-4-gdrive-adapter.md` | Create adapter.ts and gdrive-adapter.ts |
| 7 | `phases/checkpoint-3-gdrive-connection.md` | **USER RUNS DRIVE TEST — must pass before proceeding** |
| 8 | `phases/phase-5-batching-compression.md` | Create batcher.ts and compressor.ts |
| 9 | `phases/checkpoint-4-pre-archive.md` | **USER RUNS UNIT TESTS — must pass before proceeding** |
| 10 | `phases/phase-8-9-10-cron-logging-perf.md` (Phase 9 section only) | Apply `archive_logs` migration (MUST happen before Phase 6) |
| 11 | `phases/phase-6-archive-function.md` | Deploy `entity-archive` function |
| 12 | `phases/checkpoint-5-first-archive-run.md` | **USER TRIGGERS ARCHIVE + VERIFIES DRIVE — must pass before proceeding** |
| 13 | `phases/phase-7-cold-read.md` | Overwrite `entity-read` with full hot+cold+cache version |
| 14 | `phases/checkpoint-6-full-cycle.md` | **USER READS COLD ENTITY — must pass before proceeding** |
| 15 | `phases/phase-8-9-10-cron-logging-perf.md` (Phase 8 section only) | Create 3 GitHub Actions workflow files |
| 16 | `phases/checkpoint-7-cron-verification.md` | **USER TRIGGERS GITHUB ACTION — must pass before proceeding** |
| 17 | `phases/phase-8-9-10-cron-logging-perf.md` (Phase 10 section) | Verify cache, tuning, retry logic |
| 18 | `phases/checkpoint-8-production-ready.md` | **USER RUNS FULL E2E TEST — system goes live** |

> [!WARNING]
> **Migration 20260406000005 (archive_logs) MUST be applied at Step 10, before deploying the archive Edge Function in Step 11.**
> The function writes to `archive_logs` on every run. If the table doesn't exist, all archive runs will crash on the logging step.

---

## 📊 Phase Tracker

| Phase | Sub-Phase | Status | Chat ID | Date | Notes |
|-------|-----------|--------|---------|------|-------|
| 1A | Entities Table | `[x] DONE` | 7a4e9f2a-a4e6-47b4-a50e-dcee7cccd926 | 2026-04-06 | Created entities table + RLS |
| 1B | Entity Type Registry | `[x] DONE` | 7a4e9f2a-a4e6-47b4-a50e-dcee7cccd926 | 2026-04-06 | Created registry + proof_of_work seed |
| 1C | Submissions Entity Link | `[x] DONE` | 7a4e9f2a-a4e6-47b4-a50e-dcee7cccd926 | 2026-04-06 | Added entity_id to submissions |
| 2A | Edge Fn: Create Entity (scaffold) | `[x] DONE` | d9b23a70-f7e4-4b97-8078-b21b0a456a9b | 2026-04-08 | Function deployed succesfully |
| 2B | Edge Fn: Create Entity (dispatch) | `[x] DONE` | d9b23a70-f7e4-4b97-8078-b21b0a456a9b | 2026-04-08 | RPC applied with CLI wrapper fix |
| 2C | Edge Fn: Create Entity (normalize) | `[x] DONE` | d9b23a70-f7e4-4b97-8078-b21b0a456a9b | 2026-04-08 | Response path validated |
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
| `supabase/migrations/20260406000001_entities_table.sql` | 1A | Created |
| `supabase/migrations/20260406000002_entity_type_registry.sql` | 1B | Created |
| `supabase/migrations/20260406000003_submissions_entity_link.sql` | 1C | Created |
| `supabase/migrations/20260406000005_archive_logs.sql` | 9 | Not Created |
| `supabase/migrations/20260406000006_rpc_create_entity_atomic.sql` | 2 | Applied |

### GitHub Actions
| File | Phase | Status |
|------|-------|--------|
| `.github/workflows/archive-cron.yml` | 8 | Not Created |
| `.github/workflows/archive-failure-alert.yml` | 8 | Not Created |

### Edge Functions
| File | Phase | Status |
|------|-------|--------|
| `supabase/functions/entity-create/index.ts` | 2 | Deployed |
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
```

### GitHub Actions Secrets (set in GitHub Repo → Settings → Secrets → Actions)
```
SUPABASE_URL                  — Your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY     — For triggering the archive Edge Function
```

> **Note**: `pg_cron` is NOT used. The scheduled archive trigger is handled entirely by GitHub Actions (free). The `service_role_key` is stored in GitHub Secrets, NOT in any Postgres setting.

---

## ✅ Validation Results

### Phase 1A — Entities Table
- [x] Table created successfully
- [x] CHECK constraints validated (invalid tier rejected)
- [x] Indexes confirmed via pg_indexes
- [x] Test record inserted + queried

### Phase 1B — Entity Type Registry
- [x] Table created successfully
- [x] Seed data present (proof_of_work)
- [x] ON CONFLICT idempotency verified

### Phase 1C — Submissions Entity Link
- [x] entity_id column added to submissions
- [x] FK constraint enforced
- [x] Index created
- [x] Existing submissions unaffected (entity_id = NULL)

### Phase 2 — Create Entity
- [x] Edge Function deploys successfully
- [x] Creates entity + domain record atomically
- [x] Returns correct response shape
- [x] Handles invalid entity_type gracefully

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

### Phase 8 — Cron Job (GitHub Actions)
- [ ] `.github/workflows/archive-cron.yml` created and committed
- [ ] GitHub Secrets set (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] Manual trigger (`workflow_dispatch`) tested successfully
- [ ] Scheduled run confirmed in GitHub Actions run history

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
```
Delete or disable the `.github/workflows/archive-cron.yml` file.
No SQL rollback needed — GitHub Actions requires no database changes.
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

## 🚨 Known Constraints

- **Cron Strategy: GitHub Actions** (Free): pg_cron is a paid Supabase Pro feature and is NOT used. The archive job is triggered by a GitHub Actions scheduled workflow. This means cron scheduling lives in the repo, not the database.
- **GitHub Actions Limit**: Free plan allows 2,000 minutes/month. At 30-min intervals, the archive job uses ~60 monthly runs × job duration. Well within limits unless the job takes >33 minutes per run.
- **Google Drive API Rate Limits**: 300 req/min per user → batching is critical
- **Edge Function Timeout**: 60s default → large batches may need chunking
- **Deno Compatibility**: Must use Deno-compatible npm modules for gzip
- **Failure Alerting**: Without pg_cron, failure alerts rely on GitHub Actions email notifications when a workflow run fails (not Slack). A separate `archive-failure-alert` workflow can poll `archive_logs` if needed.

## 🏗️ Architecture Decisions

1. **Adapter Pattern for Storage**: The `StorageAdapter` interface allows swapping Google Drive for S3 or Supabase Storage without changing archive logic.
2. **Entity Type Registry**: New entity types can be added by inserting a row — no code changes needed for basic archival.
3. **Batch + Compress**: Reduces API calls to Drive and storage costs. Each batch = 1 Drive file = 20-50 entities.
4. **Nullable entity_id on submissions**: Backward-compatible. Existing submissions continue to work without entities.
5. **Edge Functions over RPC**: Edge Functions provide a cleaner HTTP abstraction layer and support non-Supabase APIs (Drive).
6. **Separation of concerns**: `entity-create` / `entity-read` / `entity-archive` are separate functions, not one monolith.
7. **GitHub Actions for Scheduling**: No pg_cron dependency. The `.github/workflows/archive-cron.yml` file is the single source of truth for the archive schedule. It can be paused, modified, or triggered manually at any time from the GitHub UI.
