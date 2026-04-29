# Phase 6: Archive Function (Core Logic) — Execution Guide

> **Prerequisite**: Phases 4 + 5 complete.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 6A, 6B, 6C, 6D, 6E

---

## Overview

This is the **heart** of the system. The archive function:
1. Finds eligible entities (older than 7 days, still hot)
2. **Binary Asset Migration**: For each entity, identifies associated files in Supabase Storage.
3. **Transfer**: Downloads binary blobs from Supabase Storage -> Uploads to Google Drive.
4. **Batching**: Groups the record metadata into compressed batches.
5. **Update**: Sets the entities table to 'cold' and updates the domain table.
6. **Purge**: Deletes the original file from Supabase Storage to free up space.

---

## Phase 6A: Eligible Entity Selection

### Logic

```typescript
/**
 * Fetches entities eligible for archival:
 * - storage_tier = 'hot'
 * - created_at < (now - archive_after_days)
 * - Grouped by entity_type
 */
async function getEligibleEntities(
  supabase: any,
  entityType: string,
  archiveAfterDays: number,
  limit: number = 500
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays);

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("entity_type", entityType)
    .eq("storage_tier", "hot")
    .lt("created_at", cutoffDate.toISOString())
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch eligible entities: ${error.message}`);
  return data || [];
}
```

### Validation

- Insert 10 entities with `created_at` set to 100 days ago
- Insert 10 entities with `created_at` set to today
- Query should return only the 10 old ones

---

## Phase 6B: Batch Grouping + Full Data Fetching

### Logic

```typescript
/**
 * For each eligible entity, fetch the full domain data from the hot table.
 * Returns BatchableEntity[] ready for the batcher.
 */
async function fetchFullBatchData(
  supabase: any,
  entities: any[],
  entityType: string
): Promise<BatchableEntity[]> {
  const fetchers: Record<string, (ids: string[]) => Promise<Record<string, any>>> = {
    proof_of_work: async (entityIds) => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .in("entity_id", entityIds);

      if (error) throw new Error(`Submissions fetch failed: ${error.message}`);
      // Index by entity_id for fast lookup
      const byEntityId: Record<string, any> = {};
      for (const row of (data || [])) {
        byEntityId[row.entity_id] = row;
      }
      return byEntityId;
    },
  };

  const fetcher = fetchers[entityType];
  if (!fetcher) throw new Error(`No fetcher for entity type: ${entityType}`);

  const entityIds = entities.map((e: any) => e.id);
  const domainDataMap = await fetcher(entityIds);

  return entities.map((entity: any) => ({
    entity_id: entity.id,
    entity_type: entity.entity_type,
    domain_data: domainDataMap[entity.id] || {},
    metadata: entity.metadata || {},
    created_at: entity.created_at,
  }));
}
```

---

## Phase 6C: Compress → Upload → Update Pipeline

### What to Create

**File**: `supabase/functions/entity-archive/index.ts`

```typescript
// entity-archive/index.ts
// Core archival pipeline. Called by pg_cron or manually.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Import helpers from their respective phase files (already implemented):
import { createBatches, serializeBatch, BatchableEntity } from "../_shared/batch/batcher.ts";
import { compress } from "../_shared/batch/compressor.ts";
import { createStorageAdapter, StorageProvider } from "../_shared/storage/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runId = crypto.randomUUID();
  const startTime = Date.now();
  const results: any[] = [];

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get all enabled entity types from registry
    const { data: registryEntries, error: regError } = await supabase
      .from("entity_type_registry")
      .select("*")
      .eq("enabled", true);

    if (regError) throw new Error(`Registry fetch failed: ${regError.message}`);
    if (!registryEntries || registryEntries.length === 0) {
      return new Response(
        JSON.stringify({ run_id: runId, message: "No entity types enabled for archival", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Process each entity type
    for (const registry of registryEntries) {
      const typeStartTime = Date.now();

      try {
        // 2a. Fetch eligible entities
        const eligible = await getEligibleEntities(
          supabase,
          registry.entity_type,
          registry.archive_after_days
        );

        if (eligible.length === 0) {
          await logArchiveResult(supabase, {
            run_id: runId,
            entity_type: registry.entity_type,
            status: "skipped",
            records_count: 0,
            duration_ms: Date.now() - typeStartTime,
          });
          results.push({ entity_type: registry.entity_type, status: "skipped", count: 0 });
          continue;
        }

        // 2b. Fetch full domain data
        const batchableEntities = await fetchFullBatchData(
          supabase,
          eligible,
          registry.entity_type
        );

        // 2c. Create batches
        const batches = createBatches(batchableEntities, registry.batch_size);

        // 2d. Process each batch
        // Use cold_provider from registry — NOT hardcoded — so future entity types
        // can use different providers (s3, supabase_storage, etc.)
        const adapter = createStorageAdapter(registry.cold_provider as StorageProvider);
        let totalArchived = 0;

        for (const batch of batches) {  // ← FIX: outer loop was missing in original
          try {
            // 2d-i. Binary Asset Migration
            // For each entity in the batch, move any hot binary assets to cold storage
            // and replace Supabase Storage URLs with Drive pointers.
            if (registry.has_binary_assets && registry.storage_bucket) {
              for (const entity of batch.entities) {
                const links: any[] = (entity.domain_data as any).links ?? [];
                const updatedLinks: any[] = [];
                const purgeQueue: string[] = []; // paths deleted AFTER batch success

                for (const link of links) {
                  if (link.provider === "supabase" && link.tier === "hot") {
                    // Use the storage path stored on the link object directly.
                    // Do NOT parse the public URL — it's fragile.
                    // links should carry a `storage_path` field (e.g. "2026-04/photo.jpg").
                    const storagePath: string = link.storage_path ?? link.url;

                    // Download from Supabase Storage → returns Blob | null
                    const { data: blob, error: dlError } = await supabase.storage
                      .from(registry.storage_bucket)  // ← FIX: from registry, not hardcoded
                      .download(storagePath);

                    if (dlError || !blob) {
                      console.error(`Asset download failed for ${storagePath}:`, dlError?.message);
                      updatedLinks.push(link); // keep original link on failure, don't block batch
                      continue;
                    }

                    // Convert Blob → Uint8Array (Supabase SDK returns Blob, adapter needs Uint8Array)
                    const assetBytes = new Uint8Array(await blob.arrayBuffer());

                    // Upload to cold storage
                    const coldPointer = await adapter.uploadAsset(
                      assetBytes,
                      link.file_name ?? storagePath.split("/").pop() ?? "asset",
                      registry.entity_type
                    );

                    updatedLinks.push({
                      ...link,
                      url: coldPointer,        // Drive file ID
                      provider: registry.cold_provider,
                      tier: "cold",
                      storage_path: null,      // no longer in Supabase Storage
                    });

                    // Queue for deletion only after the whole batch succeeds
                    purgeQueue.push(storagePath);
                  } else {
                    updatedLinks.push(link); // already cold or different provider
                  }
                }

                // Mutate in place so the serialized batch captures updated links
                (entity.domain_data as any).links = updatedLinks;
                (entity as any)._purgeQueue = purgeQueue;
              }
            }

            // 2d-ii. Serialize + compress metadata batch
            const serialized = serializeBatch(batch);
            const compressed = await compress(serialized);

            // 2d-iii. Upload compressed metadata batch to cold storage
            const pointer = await adapter.upload(batch.batch_id, compressed, {
              entityType: batch.entity_type,
              recordCount: batch.entities.length,
              compressedSize: compressed.length,
            });

            // 2d-iv. Update entities in DB (mark as cold)
            for (let i = 0; i < batch.entities.length; i++) {
              const entity = batch.entities[i];
              await supabase
                .from("entities")
                .update({
                  storage_tier: "cold",
                  cold_provider: registry.cold_provider,  // ← FIX: from registry, not hardcoded
                  cold_pointer: pointer,
                  cold_batch_id: batch.batch_id,
                  cold_index: i,
                  archived_at: new Date().toISOString(),
                })
                .eq("id", entity.entity_id)
                .eq("storage_tier", "hot"); // Idempotency guard: already-cold entities are skipped

              totalArchived++;
            }

            // 2d-v. Purge original Supabase Storage files AFTER batch is confirmed cold
            // This runs only when the upload + DB update both succeeded.
            if (registry.has_binary_assets && registry.storage_bucket) {
              const allPurgePaths = batch.entities.flatMap(
                (e: any) => e._purgeQueue ?? []
              );
              if (allPurgePaths.length > 0) {
                const { error: purgeError } = await supabase.storage
                  .from(registry.storage_bucket)
                  .remove(allPurgePaths);
                if (purgeError) {
                  // Non-fatal: files will be orphans but data is safe in Drive.
                  // Log for manual cleanup.
                  console.error(`Supabase Storage purge partial failure:`, purgeError.message);
                }
              }
            }

          } catch (batchError: any) {
            // Log batch failure, continue with other batches
            await logArchiveResult(supabase, {
              run_id: runId,
              entity_type: registry.entity_type,
              batch_id: batch.batch_id,
              status: "failure",
              records_count: batch.entities.length,
              error_message: batchError.message,
              duration_ms: Date.now() - typeStartTime,
            });
          }
        }

        await logArchiveResult(supabase, {
          run_id: runId,
          entity_type: registry.entity_type,
          status: "success",
          records_count: totalArchived,
          duration_ms: Date.now() - typeStartTime,
        });

        results.push({
          entity_type: registry.entity_type,
          status: "success",
          archived: totalArchived,
          batches: batches.length,
        });

      } catch (typeError: any) {
        await logArchiveResult(supabase, {
          run_id: runId,
          entity_type: registry.entity_type,
          status: "failure",
          error_message: typeError.message,
          duration_ms: Date.now() - typeStartTime,
        });
        results.push({ entity_type: registry.entity_type, status: "failure", error: typeError.message });
      }
    }

    return new Response(
      JSON.stringify({
        run_id: runId,
        total_duration_ms: Date.now() - startTime,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ run_id: runId, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helper Functions ─────────────────────────────────────────────────────────
// Copied from Phases 6A and 6B — do NOT re-implement; paste directly or
// refactor into a shared module at _shared/archive/helpers.ts.

async function getEligibleEntities(
  supabase: any,
  entityType: string,
  archiveAfterDays: number,
  limit: number = 500
) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - archiveAfterDays);

  const { data, error } = await supabase
    .from("entities")
    .select("*")
    .eq("entity_type", entityType)
    .eq("storage_tier", "hot")
    .lt("created_at", cutoffDate.toISOString())
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch eligible entities: ${error.message}`);
  return data || [];
}

async function fetchFullBatchData(
  supabase: any,
  entities: any[],
  entityType: string
): Promise<BatchableEntity[]> {
  const fetchers: Record<string, (ids: string[]) => Promise<Record<string, any>>> = {
    proof_of_work: async (entityIds) => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .in("entity_id", entityIds);

      if (error) throw new Error(`Submissions fetch failed: ${error.message}`);
      const byEntityId: Record<string, any> = {};
      for (const row of (data || [])) {
        byEntityId[row.entity_id] = row;
      }
      return byEntityId;
    },
  };

  const fetcher = fetchers[entityType];
  if (!fetcher) throw new Error(`No fetcher for entity type: ${entityType}`);

  const entityIds = entities.map((e: any) => e.id);
  const domainDataMap = await fetcher(entityIds);

  return entities.map((entity: any) => ({
    entity_id: entity.id,
    entity_type: entity.entity_type,
    domain_data: domainDataMap[entity.id] || {},
    metadata: entity.metadata || {},
    created_at: entity.created_at,
  }));
}

async function logArchiveResult(supabase: any, log: {
  run_id: string;
  entity_type: string;
  batch_id?: string;
  status: string;
  records_count?: number;
  error_message?: string;
  duration_ms: number;
}) {
  try {
    await supabase.from("archive_logs").insert(log);
  } catch (e) {
    console.error("Failed to write archive log:", e);
  }
}
```

---

## Phase 6D: Idempotency Guards

Key idempotency patterns already built into the code:

1. **`.eq("storage_tier", "hot")`** on the update query — already-archived entities won't be re-processed
2. **`archived_at IS NULL`** in the selection query — skips previously archived
3. **Batch ID is deterministic** — same entities produce same batch ID
4. **Re-running the function** on already-cold entities → skips them → 0 work

### Validation

```bash
# Run archive once (processes eligible entities)
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-archive" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

# Run again immediately (should skip everything)
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/entity-archive" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
# Expected: all entity types show status: "skipped"
```

---

## Phase 6E: Partial Failure Handling

The pipeline already handles partial failures:
- If one batch fails upload → error is logged → other batches continue
- If one entity type fails → error is logged → other types continue
- The entity update only happens AFTER successful upload
- No entity is marked "cold" without a valid pointer

### Failure Simulation

1. Set an invalid `GOOGLE_DRIVE_FOLDER_ID` → upload should fail
2. Verify: entities remain "hot", error logged in `archive_logs`
3. Fix the folder ID → re-run → entities now archive successfully

---

## After Completion

Update the runbook:
1. Set Phase 6A-6E status to `[x] DONE`
2. Record archive run results
3. Verify Drive files match expected structure
4. Confirm no duplicate processing
