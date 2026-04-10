// entity-archive/index.ts
// Core archival pipeline. Called by GHA cron or manually.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    // 2. Process each entity type
    for (const registry of registryEntries) {
      const typeStartTime = Date.now();

      try {
        // 2a. Phase 6A: Fetch eligible entities
        const eligible = await getEligibleEntities(
          supabase,
          registry.entity_type,
          registry.archive_after_days
        );

        if (eligible.length === 0) {
          if (!dryRun) {
            await logArchiveResult(supabase, {
              run_id: runId,
              entity_type: registry.entity_type,
              status: "skipped",
              records_count: 0,
              duration_ms: Date.now() - typeStartTime,
            });
          }
          results.push({ entity_type: registry.entity_type, status: "skipped", count: 0 });
          continue;
        }

        // 2b. Phase 6B: Fetch full domain data
        const batchableEntities = await fetchFullBatchData(
          supabase,
          eligible,
          registry.entity_type
        );

        // --- Handle Dry Run ---
        if (dryRun) {
          results.push({
            entity_type: registry.entity_type,
            status: "ready",
            eligible_count: eligible.length,
            batchable_sample: batchableEntities.slice(0, 3)
          });
          continue;
        }

        // 2c. Phase 6C: Pipeline Logic
        // 2c-i. Create batches
        const batches = createBatches(batchableEntities, registry.batch_size);
        const adapter = createStorageAdapter(registry.cold_provider as StorageProvider);
        let totalArchived = 0;

        for (const batch of batches) {
          try {
            // 2c-ii. Binary Asset Migration
            if (registry.has_binary_assets && registry.storage_bucket) {
              for (const entity of batch.entities) {
                const links: any[] = (entity.domain_data as any).links ?? [];
                const updatedLinks: any[] = [];
                const purgeQueue: string[] = []; 

                for (const link of links) {
                  if (link.provider === "supabase" && link.tier === "hot") {
                    // Download from Supabase Storage
                    const storagePath = link.url; // assuming URL is the path or we have a mapping
                    const { data: blob, error: dlError } = await supabase.storage
                      .from(registry.storage_bucket)
                      .download(storagePath);

                    if (dlError || !blob) {
                      console.error(`Asset download failed for ${storagePath}:`, dlError?.message);
                      updatedLinks.push(link); 
                      continue;
                    }

                    // Convert Blob -> Uint8Array
                    const assetBytes = new Uint8Array(await blob.arrayBuffer());

                    // Upload to cold storage
                    const coldPointer = await adapter.uploadAsset(
                      assetBytes,
                      link.file_name ?? "asset",
                      registry.entity_type
                    );

                    updatedLinks.push({
                      ...link,
                      url: coldPointer, // The Drive file ID
                      provider: registry.cold_provider,
                      tier: "cold",
                    });

                    purgeQueue.push(storagePath);
                  } else {
                    updatedLinks.push(link);
                  }
                }

                // Update domain data and attach purge queue for after-batch cleanup
                (entity.domain_data as any).links = updatedLinks;
                (entity as any)._purgeQueue = purgeQueue;
              }
            }

            // 2c-iii. Serialize + compress metadata batch
            const serialized = serializeBatch(batch);
            const compressed = await compress(serialized);

            // 2c-iv. Upload compressed metadata batch to cold storage
            const batchPointer = await adapter.upload(batch.batch_id, compressed, {
              entityType: batch.entity_type,
              recordCount: batch.entities.length,
              compressedSize: compressed.length,
            });

            // 2c-v. Update entities in DB
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
                .eq("storage_tier", "hot");

              if (!updateError) totalArchived++;
            }

            // 2c-vi. Purge original Supabase Storage files
            if (registry.has_binary_assets && registry.storage_bucket) {
              const allPurgePaths = batch.entities.flatMap(
                (e: any) => e._purgeQueue ?? []
              );
              if (allPurgePaths.length > 0) {
                await supabase.storage
                  .from(registry.storage_bucket)
                  .remove(allPurgePaths);
              }
            }

          } catch (batchError: any) {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    const { error } = await supabase.from("archive_logs").insert(log);
    if (error) console.error("Failed to write archive log:", error.message);
  } catch (e) {
    console.error("Failed to write archive log (exception):", e);
  }
}
