# Phase 6: Archive Function (Core Logic) — Execution Guide

> **Prerequisite**: Phases 4 + 5 complete.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 6A, 6B, 6C, 6D, 6E

---

## Overview

This is the **heart** of the system. The archive function:
1. Finds eligible entities (older than threshold, still hot)
2. Groups them into batches
3. Fetches full domain data
4. Compresses + uploads to cold storage
5. Updates the entities table
6. Optionally cleans up hot data

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
import { createBatches, serializeBatch } from "../_shared/batch/batcher.ts";
import { compress } from "../_shared/batch/compressor.ts";
import { createStorageAdapter } from "../_shared/storage/adapter.ts";

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

    // 1. Get all enabled entity types
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
        const adapter = createStorageAdapter("gdrive");
        let totalArchived = 0;

        for (const batch of batches) {
          try {
            // Serialize + compress
            const serialized = serializeBatch(batch);
            const compressed = await compress(serialized);

            // Upload to cold storage
            const pointer = await adapter.upload(batch.batch_id, compressed, {
              entityType: batch.entity_type,
              recordCount: batch.entities.length,
              compressedSize: compressed.length,
            });

            // Update entities in DB
            for (let i = 0; i < batch.entities.length; i++) {
              const entity = batch.entities[i];
              await supabase
                .from("entities")
                .update({
                  storage_tier: "cold",
                  cold_provider: "gdrive",
                  cold_pointer: pointer,
                  cold_batch_id: batch.batch_id,
                  cold_index: i,
                  archived_at: new Date().toISOString(),
                })
                .eq("id", entity.entity_id)
                .eq("storage_tier", "hot"); // Idempotency guard

              totalArchived++;
            }

            // Optional: Clear hot data (nullify links, keep row)
            // Uncomment when ready:
            // const entityIds = batch.entities.map(e => e.entity_id);
            // await supabase.from("submissions")
            //   .update({ links: [] })
            //   .in("entity_id", entityIds);

          } catch (batchError) {
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

      } catch (typeError) {
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

  } catch (err) {
    return new Response(
      JSON.stringify({ run_id: runId, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helper Functions (inline for now, can be extracted) ─────────────────────

// These are the functions from phases 6A and 6B (paste them here or import)
// getEligibleEntities(...)
// fetchFullBatchData(...)

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
