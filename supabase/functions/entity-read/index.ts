import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decompress } from "../_shared/batch/compressor.ts";
import { deserializeBatch, extractFromBatch, BatchableEntity } from "../_shared/batch/batcher.ts";
import { withRetry } from "../_shared/utils/retry.ts";

import { createStorageAdapter, StorageProvider } from "../_shared/storage/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Tiered Object Cache (Phase 10A Hardened) ────────────────────────────────
// Layer 1: Object Cache. Stores fully-deserialized batch objects after first fetch.
// Key: cold_pointer (Drive File ID). All entities sharing a batch reuse this.
// TTL: 5 min. Max: 25 entries. Eviction: oldest-first.
// WHY object not bytes: avoids decompress() + JSON.parse() on every cache hit.
type CachedRecord = { 
  index: number; 
  entity_id: string; 
  domain_data: Record<string, unknown>; 
  metadata: Record<string, unknown> 
};
type CachedBatch = CachedRecord[];

const batchObjectCache = new Map<string, { records: CachedBatch; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 25;

// Layer 2: Flight Map. Prevents thundering-herd Drive API calls when multiple
// concurrent requests arrive for the same un-cached batch.
// Key: cold_pointer. Value: the in-flight download+decompress Promise.
const pendingRequests = new Map<string, Promise<CachedBatch>>();

// Initialize Supabase client once at module level for reuse across warm starts
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function getCachedRecords(pointer: string): CachedBatch | null {

  const entry = batchObjectCache.get(pointer);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    batchObjectCache.delete(pointer);
    return null;
  }
  return entry.records;
}

function setCachedRecords(pointer: string, records: CachedBatch): void {
  if (batchObjectCache.size >= MAX_CACHE_SIZE) {
    // Evict the oldest entry
    const oldest = [...batchObjectCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) batchObjectCache.delete(oldest[0]);
  }
  batchObjectCache.set(pointer, { records, ts: Date.now() });
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract entity ID from query string: GET /entity-read?id=<uuid>

    const url = new URL(req.url);
    const entityId = url.searchParams.get("id");

    if (!entityId) {
      return new Response(
        JSON.stringify({ success: false, error: "id parameter is required", code: "MISSING_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 1: Fetch the entity row ──────────────────────────────────────────
    // The `entities` table is ALWAYS hot (it's the routing index).
    // storage_tier, cold_pointer, cold_index live here.
    const { data: entity, error: entityError } = await supabase
      .from("entities")
      .select("*")
      .eq("id", entityId)
      .single();

    if (entityError || !entity) {
      return new Response(
        JSON.stringify({ success: false, error: "Entity not found", code: "NOT_FOUND" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Route by storage tier ────────────────────────────────────────

    if (entity.storage_tier === "hot") {
      // HOT PATH: Read domain data directly from the PostgreSQL submissions table
      const domainData = await fetchHotData(supabase, entity);
      return new Response(
        JSON.stringify({
          success: true,
          entity: normalizeEntity(entity),
          domain: domainData,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (entity.storage_tier === "cold") {
      // COLD PATH: Download batch file from Drive, decompress, extract by index
      try {
        // Validate that cold_pointer and cold_index exist
        if (!entity.cold_provider || !entity.cold_pointer) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Entity is marked cold but has no cold_pointer",
              code: "COLD_POINTER_MISSING",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Layer 1: Object Cache check (instant return if already parsed)
        let batchRecords = getCachedRecords(entity.cold_pointer);

        if (!batchRecords) {
          // Layer 2: Flight Map check — is another request currently fetching this batch?
          let inflightPromise = pendingRequests.get(entity.cold_pointer);

          if (!inflightPromise) {
            // No one is fetching this yet — start download and register in Flight Map
            inflightPromise = (async () => {
              const adapter = createStorageAdapter(entity.cold_provider as StorageProvider);
              const compressedData = await withRetry(
                () => adapter.download(entity.cold_pointer!),
                { maxAttempts: 2, baseDelayMs: 1000, label: "Cold Path Download (outer)" }
              );
              const rawData = await decompress(compressedData);

              const batchData = deserializeBatch(rawData);
              return batchData.records as CachedBatch;
            })().then((records) => {
              // Success: populate Object Cache, remove mapping
              setCachedRecords(entity.cold_pointer!, records);
              pendingRequests.delete(entity.cold_pointer!);
              return records;
            }).catch((err) => {
              // Failure: remove mapping WITHOUT caching (prevents cache poisoning)
              pendingRequests.delete(entity.cold_pointer!);
              throw err;
            });

            pendingRequests.set(entity.cold_pointer, inflightPromise);
          }

          // Await the new or existing fetch promise
          batchRecords = await inflightPromise;
        }

        // Extract this specific entity metadata using its position in the batch
        const record = batchRecords.find((r) => r.index === (entity.cold_index ?? 0));
        const domainData = record ? record.domain_data : null;

        if (!domainData) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "Entity not found in cold batch (cold_index out of range)",
              code: "COLD_EXTRACTION_FAILED",
            }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Lookup the human-readable table name from registry (for response metadata)
        const { data: registry } = await supabase
          .from("entity_type_registry")
          .select("hot_table")
          .eq("entity_type", entity.entity_type)
          .single();

        return new Response(
          JSON.stringify({
            success: true,
            entity: normalizeEntity(entity),
            domain: {
              table: registry?.hot_table || entity.entity_type,
              record_id: (domainData as any).id || null,
              data: domainData,
              source: "cold", // indicates this came from archive, not live DB
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      } catch (coldError: any) {
        // Catch all cold-path errors and return a structured 500
        return new Response(
          JSON.stringify({
            success: false,
            error: `Cold read failed: ${coldError.message}`,
            code: "COLD_READ_ERROR",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Should never reach here — storage_tier has a CHECK constraint
    return new Response(
      JSON.stringify({ success: false, error: "Unknown storage tier", code: "UNKNOWN_TIER" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Hot Data Fetcher ─────────────────────────────────────────────────────────

interface DomainResult {
  table: string;
  record_id: string | null;
  data: Record<string, unknown> | null;
  source?: string;
}

/**
 * Fetches the domain record (e.g. submissions row) for a hot entity.
 * Add a new entry to `fetchers` for each new entity_type.
 */
async function fetchHotData(supabase: any, entity: any): Promise<DomainResult> {
  const fetchers: Record<string, () => Promise<DomainResult>> = {

    proof_of_work: async () => {
      // Fetch the submission linked to this entity via entity_id FK
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("entity_id", entity.id)
        .single();

      if (error || !data) {
        // Return a graceful empty result rather than throwing
        return { table: "submissions", record_id: null, data: null };
      }
      return {
        table: "submissions",
        record_id: data.id,
        data,
        source: "hot",
      };
    },

    // ── Add handlers here for future entity types ──
    // Example:
    // daily_task_log: async () => {
    //   const { data } = await supabase.from("task_logs").select("*").eq("entity_id", entity.id).single();
    //   return { table: "task_logs", record_id: data?.id || null, data };
    // },
  };

  const fetcher = fetchers[entity.entity_type];
  if (!fetcher) {
    // Gracefully handle unknown types rather than crashing
    console.error(`No hot fetcher for entity_type: ${entity.entity_type}`);
    return { table: "unknown", record_id: null, data: null };
  }

  return fetcher();
}

// ─── Response Normalization ───────────────────────────────────────────────────

/**
 * Strips internal DB columns from the entity record.
 * Returns only the fields the frontend needs to know about.
 * hot_pointer, cold_batch_id, cold_index are internal implementation details.
 */
function normalizeEntity(entity: any) {
  return {
    id: entity.id,
    entity_type: entity.entity_type,
    storage_tier: entity.storage_tier,  // 'hot' or 'cold'
    created_at: entity.created_at,
    archived_at: entity.archived_at,    // null for hot, set for cold
    metadata: entity.metadata || {},
  };
}
