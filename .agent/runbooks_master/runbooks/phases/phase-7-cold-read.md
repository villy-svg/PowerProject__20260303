# Phase 7: Read From Cold Storage — Execution Guide

> **Prerequisite**: Phase 6 complete (archived entities exist in Drive). Checkpoint 5 must pass.
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`

---

## Overview

Replace the **entire** `entity-read/index.ts` file with the complete version below. Phase 7 extends the hot-only read function (Phase 3) to transparently handle cold storage reads.

Phase 10A (in-memory cache) is already included in this file to avoid a second deploy later.

---

## What to Overwrite

**File**: `supabase/functions/entity-read/index.ts`

**Action**: REPLACE the entire file content with the code below. Do not merge — overwrite completely.

```typescript
// entity-read/index.ts
// Edge Function: Reads an entity + domain data.
// Transparently handles BOTH hot (PostgreSQL) and cold (Google Drive) storage tiers.
// Includes in-memory LRU cache for cold batch files (Phase 10A).
//
// HOW IT WORKS:
//   1. Look up the entity row in the `entities` table (always in hot DB).
//   2. If storage_tier = 'hot': JOIN the submissions table and return data directly.
//   3. If storage_tier = 'cold': Download the compressed batch from Drive,
//      decompress it, extract this entity's record using cold_index, return it.
//   4. The response shape is identical for hot and cold — callers don't need to know the tier.
//
// IMPORTS NOTE:
//   Deno requires static top-level imports. Do NOT use dynamic `await import()`.
//   All shared modules must exist before this file is deployed.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decompress } from "../_shared/batch/compressor.ts";
import { deserializeBatch, extractFromBatch, BatchableEntity } from "../_shared/batch/batcher.ts";
import { createStorageAdapter, StorageProvider } from "../_shared/storage/adapter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── In-Memory LRU Cache (Phase 10A) ─────────────────────────────────────────
// Caches compressed batch files by Drive pointer.
// Per-worker (Deno isolate), so cache is NOT shared across concurrent requests.
// TTL: 5 minutes. Max size: 50 entries. Eviction: oldest-first.
const batchCache = new Map<string, { data: Uint8Array; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 50;

function getCachedBatch(pointer: string): Uint8Array | null {
  const entry = batchCache.get(pointer);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    batchCache.delete(pointer);
    return null;
  }
  return entry.data;
}

function setCachedBatch(pointer: string, data: Uint8Array): void {
  if (batchCache.size >= MAX_CACHE_SIZE) {
    // Evict the oldest entry
    const oldest = [...batchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    batchCache.delete(oldest[0]);
  }
  batchCache.set(pointer, { data, ts: Date.now() });
}
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Service role client — bypasses RLS for internal reads
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

        // Check cache first (avoids a Drive API call if same batch was recently accessed)
        let compressedData = getCachedBatch(entity.cold_pointer);

        if (!compressedData) {
          // Cache miss — download from Drive
          const adapter = createStorageAdapter(entity.cold_provider as StorageProvider);
          compressedData = await adapter.download(entity.cold_pointer);
          // Store in cache for subsequent reads within the TTL window
          setCachedBatch(entity.cold_pointer, compressedData);
        }

        // Decompress the gzipped batch bytes
        const rawData = await decompress(compressedData);

        // Deserialize the JSON batch structure
        const batchData = deserializeBatch(rawData);

        // Extract this specific entity's domain data using its position in the batch
        const domainData = extractFromBatch(batchData, entity.cold_index ?? 0);

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
```

---

## Step-by-Step Deployment

### 1. Verify all imports exist (run from `supabase/functions/` directory)

```bash
ls _shared/batch/compressor.ts    # Must exist (Phase 5)
ls _shared/batch/batcher.ts       # Must exist (Phase 5)
ls _shared/storage/adapter.ts     # Must exist (Phase 4)
```

If any are missing, complete the relevant phase first.

### 2. Type-check before deploy

```bash
cd supabase/functions
deno check entity-read/index.ts
```

**Expected**: No errors.

Common errors:
- `Cannot find module '../_shared/batch/compressor.ts'` → Phase 5 not done
- `Property 'extractFromBatch' does not exist` → batcher.ts is missing the export
- `StorageProvider is not exported` → adapter.ts missing the type export

### 3. Deploy

```bash
npx supabase functions deploy entity-read
```

---

## Response Shape Reference

### Hot Entity Response
```json
{
  "success": true,
  "entity": {
    "id": "<uuid>",
    "entity_type": "proof_of_work",
    "storage_tier": "hot",
    "created_at": "2026-04-06T00:00:00Z",
    "archived_at": null,
    "metadata": {}
  },
  "domain": {
    "table": "submissions",
    "record_id": "<submission-uuid>",
    "data": {
      "id": "<submission-uuid>",
      "task_id": "<task-uuid>",
      "submitted_by": "<user-uuid>",
      "comment": "...",
      "links": [],
      "entity_id": "<entity-uuid>",
      "status": "pending",
      "created_at": "..."
    },
    "source": "hot"
  }
}
```

### Cold Entity Response

```json
{
  "success": true,
  "entity": {
    "id": "<uuid>",
    "entity_type": "proof_of_work",
    "storage_tier": "cold",
    "created_at": "2026-04-06T00:00:00Z",
    "archived_at": "2026-04-13T02:00:00Z",
    "metadata": {}
  },
  "domain": {
    "table": "submissions",
    "record_id": "<submission-uuid>",
    "data": {
      "id": "<submission-uuid>",
      "task_id": "<task-uuid>",
      "submitted_by": "<user-uuid>",
      "comment": "...",
      "links": [...]
    },
    "source": "cold"
  }
}
```

> [!IMPORTANT]
> The `entity` and `domain` shapes are **identical** between hot and cold. The only caller-visible difference is `storage_tier`, `archived_at`, and `domain.source`. The frontend does not need to know which path was taken.

---

## Validation

Run **Checkpoint 6** (`checkpoint-6-full-cycle.md`) for the full validation suite.

Quick sanity check:
```bash
# Read a cold entity (from Checkpoint 5 test data or any archived entity)
curl -s "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<COLD_UUID>" \
  -H "Authorization: Bearer <ANON_KEY>"

# Expected: success: true, entity.storage_tier: "cold", domain.source: "cold"
```

---

## After Completion

Update the runbook:
1. Set Phase 7 status to `[x] DONE`
2. Record cold read latency from Checkpoint 6, Step 8
3. Run Checkpoint 6 and confirm all checks pass
