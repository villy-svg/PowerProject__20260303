// entity-archive/index.ts
// Core archival pipeline. Called by GHA cron or manually.
// Phase 11: Cursor-Walk pattern — no migration required.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createBatches, serializeBatch, BatchableEntity } from "../_shared/batch/batcher.ts";
import { compress } from "../_shared/batch/compressor.ts";
import { createStorageAdapter, StorageProvider } from "../_shared/storage/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Constants ────────────────────────────────────────────────────────────────
// PAGE_SIZE: how many entities to fetch and process per cursor step.
// Safe upper bound for .in() URL: 25 × 36 chars + delimiters ≈ 930 chars.
const PAGE_SIZE = 25;

// TIMEOUT_GUARD_MS: stop the loop this many ms before Edge Function hard limit (60s).
const TIMEOUT_GUARD_MS = 50_000;

// Initialize Supabase client once at module level for reuse across warm starts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const runId = crypto.randomUUID();
  const startTime = Date.now();

  // run-level summary
  type RunResult = {
    entity_type: string;
    pages_processed: number;
    records_archived: number;
    records_failed: number;
    status: "success" | "partial" | "failure" | "skipped";
    error?: string;
  };
  const results: RunResult[] = [];
  let anyPartial = false;
  let anyFailure = false;

  try {
    // Parse request body for dry_run flag
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
    } catch {
      // Body might be empty, ignore
    }

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

    // 2. Process each entity type with cursor-walk
    for (const registry of registryEntries) {
      const typeStartTime = Date.now();
      const result: RunResult = {
        entity_type: registry.entity_type,
        pages_processed: 0,
        records_archived: 0,
        records_failed: 0,
        status: "success",
      };

      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - registry.archive_after_days);

        const adapter = createStorageAdapter(registry.cold_provider as StorageProvider);
        let cursor: string | null = null; // UUID of last processed entity; null = start

        // ── Cursor-Walk Loop ─────────────────────────────────────────────────
        while (true) {
          // 2a. Elapsed-time guard — stop before Edge Function hard timeout
          const elapsed = Date.now() - startTime;
          if (elapsed >= TIMEOUT_GUARD_MS) {
            result.status = "partial";
            anyPartial = true;
            break;
          }

          // 2b. Fetch one page of eligible entities (keyset pagination)
          const page = await fetchNextPage(supabase, registry.entity_type, cutoffDate, cursor);

          if (page.length === 0) {
            // No more eligible records for this type — we are done
            break;
          }

          // dry_run: just report what WOULD be archived
          if (dryRun) {
            result.pages_processed++;
            result.records_archived += page.length;
            cursor = page[page.length - 1].id;
            continue;
          }

          // 2c. Fetch domain data for this small page (≤ PAGE_SIZE IDs → safe URL)
          let batchableEntities: BatchableEntity[];
          try {
            batchableEntities = await fetchPageDomainData(supabase, page, registry.entity_type);
          } catch (domainError: any) {
            // Log and skip page — don't crash the entire run
            result.records_failed += page.length;
            anyFailure = true;
            await logArchiveResult(supabase, {
              run_id: runId,
              entity_type: registry.entity_type,
              status: "failure",
              records_count: page.length,
              error_message: `Domain fetch failed: ${domainError.message}`,
              duration_ms: Date.now() - typeStartTime,
            });
            // Advance cursor to skip this failing page and avoid an infinite loop
            cursor = page[page.length - 1].id;
            continue;
          }

          // 2d. Compress + upload the page as one Drive batch file
          try {
            const effectiveBatchSize = resolveEffectiveBatchSize(registry.batch_size);
            const batches = createBatches(batchableEntities, effectiveBatchSize);

            for (const batch of batches) {
              // Binary asset migration
              if (registry.has_binary_assets && registry.storage_bucket) {
                for (const entity of batch.entities) {
                  const links: any[] = (entity.domain_data as any).links ?? [];
                  const updatedLinks: any[] = [];
                  const purgeQueue: string[] = [];

                  for (const link of links) {
                    if (link.provider === "supabase" && link.tier === "hot") {
                      const storagePath = link.url;
                      const { data: blob, error: dlError } = await supabase.storage
                        .from(registry.storage_bucket)
                        .download(storagePath);

                      if (dlError || !blob) {
                        console.error(`Asset download failed for ${storagePath}:`, dlError?.message);
                        updatedLinks.push(link);
                        continue;
                      }

                      const assetBytes = new Uint8Array(await blob.arrayBuffer());
                      const coldPointer = await adapter.uploadAsset(
                        assetBytes,
                        link.file_name ?? "asset",
                        registry.entity_type
                      );

                      updatedLinks.push({ ...link, url: coldPointer, provider: registry.cold_provider as any, tier: "cold" });
                      purgeQueue.push(storagePath);
                    } else {
                      updatedLinks.push(link);
                    }
                  }

                  (entity.domain_data as any).links = updatedLinks;
                  (entity as any)._purgeQueue = purgeQueue;
                }
              }

              const serialized = serializeBatch(batch);
              const compressed = await compress(serialized);
              const batchPointer = await adapter.upload(batch.batch_id, compressed, {
                entityType: batch.entity_type,
                recordCount: batch.entities.length,
                compressedSize: compressed.length,
              });

              // Update each entity's tier in DB
              for (let i = 0; i < batch.entities.length; i++) {
                const entity = batch.entities[i];
                const { error: updateError } = await supabase
                  .from("entities")
                  .update({
                    storage_tier: "cold",
                    cold_provider: registry.cold_provider,
                    cold_pointer: batchPointer,
                    cold_batch_id: batch.batch_id,
                    cold_index: i,
                    archived_at: new Date().toISOString(),
                  })
                  .eq("id", entity.entity_id)
                  .eq("storage_tier", "hot"); // idempotency guard

                if (!updateError) {
                  result.records_archived++;
                } else {
                  result.records_failed++;
                  console.error(`Entity update failed for ${entity.entity_id}:`, updateError.message);
                }
              }

              // Purge original Supabase Storage files
              if (registry.has_binary_assets && registry.storage_bucket) {
                const allPurgePaths = batch.entities.flatMap((e: any) => e._purgeQueue ?? []);
                if (allPurgePaths.length > 0) {
                  await supabase.storage.from(registry.storage_bucket).remove(allPurgePaths);
                }
              }
            }

            result.pages_processed++;
          } catch (batchError: any) {
            result.records_failed += page.length;
            anyFailure = true;
            await logArchiveResult(supabase, {
              run_id: runId,
              entity_type: registry.entity_type,
              status: "failure",
              records_count: page.length,
              error_message: batchError.message,
              duration_ms: Date.now() - typeStartTime,
            });
          }

          // Advance cursor to last entity in this page
          cursor = page[page.length - 1].id;
        } // ── end cursor-walk loop ──

        // Log final type summary
        if (!dryRun) {
          // Note: we log 'success' even for partial runs to keep current DB constraints happy.
          // The next run will pick up where we left off.
          await logArchiveResult(supabase, {
            run_id: runId,
            entity_type: registry.entity_type,
            status: result.records_failed > 0 ? "failure" : "success",
            records_count: result.records_archived,
            duration_ms: Date.now() - typeStartTime,
          });
        }

        results.push(result);

      } catch (typeError: any) {
        anyFailure = true;
        await logArchiveResult(supabase, {
          run_id: runId,
          entity_type: registry.entity_type,
          status: "failure",
          error_message: typeError.message,
          duration_ms: Date.now() - typeStartTime,
        });
        results.push({
          entity_type: registry.entity_type,
          pages_processed: 0,
          records_archived: 0,
          records_failed: 0,
          status: "failure",
          error: typeError.message,
        });
      }
    }

    // ── Determine HTTP status ─────────────────────────────────────────────────
    // 200 → everything done, no failures
    // 206 → ran out of time, more records remain
    // 207 → some pages failed but run completed
    const httpStatus = anyFailure ? 207 : anyPartial ? 206 : 200;

    return new Response(
      JSON.stringify({
        run_id: runId,
        total_duration_ms: Date.now() - startTime,
        status: anyFailure ? "partial_failure" : anyPartial ? "partial" : "success",
        results,
      }),
      { status: httpStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ run_id: runId, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchNextPage(
  supabase: any,
  entityType: string,
  cutoffDate: Date,
  cursor: string | null
): Promise<any[]> {
  let query = supabase
    .from("entities")
    .select("*")
    .eq("entity_type", entityType)
    .eq("storage_tier", "hot")
    .lt("created_at", cutoffDate.toISOString())
    .is("archived_at", null)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);

  if (cursor !== null) {
    query = query.gt("id", cursor);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Page fetch failed: ${error.message}`);
  return data || [];
}

async function fetchPageDomainData(
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

function resolveEffectiveBatchSize(registryBatchSize: number): number {
  const MIN_BATCH = 5;
  const MAX_BATCH = PAGE_SIZE;

  const override = Deno.env.get("ARCHIVE_BATCH_SIZE_OVERRIDE");
  let effective: number;

  if (override !== undefined) {
    const parsed = parseInt(override, 10);
    effective = isNaN(parsed) ? registryBatchSize : parsed;
    if (!isNaN(parsed)) console.log(`[BatchSize] Override active: ${parsed}`);
  } else {
    effective = registryBatchSize;
  }

  const clamped = Math.max(MIN_BATCH, Math.min(MAX_BATCH, effective));
  if (clamped !== effective) {
    console.warn(`[BatchSize] ${effective} clamped to ${clamped}`);
  }
  return clamped;
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
    const { error } = await supabase.from("archive_logs").insert(log);
    if (error) console.error("Failed to write archive log:", error.message);
  } catch (e) {
    console.error("Failed to write archive log (exception):", e);
  }
}
