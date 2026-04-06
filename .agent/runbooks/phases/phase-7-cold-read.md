# Phase 7: Read From Cold Storage — Execution Guide

> **Prerequisite**: Phase 6 complete (archived entities exist in Drive).  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`

---

## Overview

Extend the `entity-read` Edge Function to transparently fetch data from cold storage when `storage_tier = 'cold'`.

---

## What to Modify

**File**: `supabase/functions/entity-read/index.ts`

### Changes

Replace the cold storage placeholder with actual implementation:

```typescript
// Replace the Phase 7 placeholder block:
if (entity.storage_tier === "cold") {
  try {
    const { decompress } = await import("../_shared/batch/compressor.ts");
    const { deserializeBatch, extractFromBatch } = await import("../_shared/batch/batcher.ts");
    const { createStorageAdapter } = await import("../_shared/storage/adapter.ts");

    // 1. Download the batch file from cold storage
    const adapter = createStorageAdapter(entity.cold_provider as any);
    const compressedData = await adapter.download(entity.cold_pointer);

    // 2. Decompress
    const rawData = await decompress(compressedData);

    // 3. Deserialize the batch
    const batchData = deserializeBatch(rawData);

    // 4. Extract this specific entity using cold_index
    const domainData = extractFromBatch(batchData, entity.cold_index);

    if (!domainData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Entity not found in cold batch",
          code: "COLD_EXTRACTION_FAILED",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Lookup registry for table name
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
          record_id: domainData.id || null,
          data: domainData,
          source: "cold",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (coldError) {
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
```

### Response Shape (Cold)

The response is **identical** to hot reads, with one extra field:

```json
{
  "success": true,
  "entity": {
    "id": "uuid",
    "entity_type": "proof_of_work",
    "storage_tier": "cold",
    "created_at": "...",
    "archived_at": "2026-04-06T...",
    "metadata": {}
  },
  "domain": {
    "table": "submissions",
    "record_id": "uuid",
    "data": { ... },
    "source": "cold"  // <-- indicates cold retrieval
  }
}
```

---

## Validation

### Test Plan

1. **Archive some entities** (Phase 6 — should already be done)
2. **Read a cold entity**:
   ```bash
   curl "https://<PROJECT_REF>.supabase.co/functions/v1/entity-read?id=<COLD_ENTITY_UUID>" \
     -H "Authorization: Bearer <ANON_KEY>"
   ```
3. **Compare hot vs cold responses**:
   - Both should have `success: true`
   - Both should have identical `entity` shape
   - Both should have identical `domain.data` content
   - Cold response has `domain.source: "cold"`

### Edge Cases

- Entity with invalid `cold_pointer` → should return 500 with error message
- Entity with invalid `cold_index` → should return 404 with `COLD_EXTRACTION_FAILED`
- Multiple reads of same cold entity → should all succeed (no mutation)

---

## Performance Note

Cold reads are slower than hot reads (~200-500ms for Drive API). Phase 10 will add caching to mitigate this.

---

## After Completion

Update the runbook:
1. Set Phase 7 status to `[x] DONE`
2. Record cold read latency measurements
3. Verify response shape parity (hot vs cold)
