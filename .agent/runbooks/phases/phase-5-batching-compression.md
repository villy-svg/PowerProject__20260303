# Phase 5: Batching + Compression — Execution Guide

> **Prerequisite**: Phase 4 (Storage Adapter) complete.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 5A, 5B, 5C

---

## Phase 5A: Batcher Logic

### What to Create

**File**: `supabase/functions/_shared/batch/batcher.ts`

```typescript
// _shared/batch/batcher.ts
// Groups entities into upload-ready batches.
// Pure function — no I/O, no side effects.

export interface BatchableEntity {
  entity_id: string;
  entity_type: string;
  domain_data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Batch {
  batch_id: string;
  entity_type: string;
  entities: BatchableEntity[];
  created_at: string;
}

/**
 * Groups entities into batches of `batchSize`.
 * Each batch gets a unique batch_id.
 * Entities within a batch are indexed by their array position.
 *
 * @param entities - Flat array of entities to batch
 * @param batchSize - Max entities per batch (from entity_type_registry)
 * @returns Array of Batch objects
 */
export function createBatches(
  entities: BatchableEntity[],
  batchSize: number
): Batch[] {
  if (entities.length === 0) return [];
  if (batchSize < 1) throw new Error("batchSize must be >= 1");

  const batches: Batch[] = [];
  const timestamp = new Date().toISOString();

  for (let i = 0; i < entities.length; i += batchSize) {
    const chunk = entities.slice(i, i + batchSize);
    const batchId = `${chunk[0].entity_type}_${timestamp.replace(/[^0-9]/g, "")}_${Math.floor(i / batchSize)}`;

    batches.push({
      batch_id: batchId,
      entity_type: chunk[0].entity_type,
      entities: chunk,
      created_at: timestamp,
    });
  }

  return batches;
}

/**
 * Serializes a batch into a JSON byte array for compression.
 * The format is designed for efficient indexing:
 * {
 *   batch_id: string,
 *   entity_type: string,
 *   created_at: string,
 *   count: number,
 *   records: [ { index: 0, entity_id: "...", data: {...} }, ... ]
 * }
 */
export function serializeBatch(batch: Batch): Uint8Array {
  const payload = {
    batch_id: batch.batch_id,
    entity_type: batch.entity_type,
    created_at: batch.created_at,
    count: batch.entities.length,
    records: batch.entities.map((entity, index) => ({
      index,
      entity_id: entity.entity_id,
      entity_type: entity.entity_type,
      metadata: entity.metadata,
      domain_data: entity.domain_data,
      created_at: entity.created_at,
    })),
  };

  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Deserializes a batch payload back into structured data.
 * Used when reading from cold storage.
 */
export function deserializeBatch(data: Uint8Array): {
  batch_id: string;
  entity_type: string;
  count: number;
  records: Array<{
    index: number;
    entity_id: string;
    domain_data: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }>;
} {
  const text = new TextDecoder().decode(data);
  return JSON.parse(text);
}

/**
 * Extracts a single entity from a deserialized batch by index.
 */
export function extractFromBatch(
  batchData: ReturnType<typeof deserializeBatch>,
  entityIndex: number
): Record<string, unknown> | null {
  const record = batchData.records.find((r) => r.index === entityIndex);
  return record ? record.domain_data : null;
}
```

### Validation

```typescript
// Unit test
import { createBatches, serializeBatch, deserializeBatch, extractFromBatch } from "./batcher.ts";

const testEntities = Array.from({ length: 53 }, (_, i) => ({
  entity_id: `entity-${i}`,
  entity_type: "proof_of_work",
  domain_data: { task_id: `task-${i}`, comment: `Test ${i}` },
  metadata: {},
  created_at: new Date().toISOString(),
}));

const batches = createBatches(testEntities, 25);
console.assert(batches.length === 3, `Expected 3 batches, got ${batches.length}`);
console.assert(batches[0].entities.length === 25, "First batch should have 25");
console.assert(batches[1].entities.length === 25, "Second batch should have 25");
console.assert(batches[2].entities.length === 3, "Third batch should have 3");

// Round-trip test
const serialized = serializeBatch(batches[0]);
const deserialized = deserializeBatch(serialized);
console.assert(deserialized.count === 25, "Deserialized count should be 25");

const extracted = extractFromBatch(deserialized, 5);
console.assert(extracted?.task_id === "task-5", "Extracted entity should match");

console.log("✅ All batcher tests passed");
```

---

## Phase 5B: Compression Utilities

### What to Create

**File**: `supabase/functions/_shared/batch/compressor.ts`

```typescript
// _shared/batch/compressor.ts
// gzip compression/decompression for batch files.
// Uses the Web Streams API (available in Deno).

/**
 * Compresses data using gzip.
 * @param data - Raw bytes to compress
 * @returns Compressed bytes
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const compressedStream = stream.pipeThrough(new CompressionStream("gzip"));
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Decompresses gzip data.
 * @param data - Compressed bytes
 * @returns Decompressed bytes
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Returns compression stats.
 */
export function compressionStats(original: Uint8Array, compressed: Uint8Array) {
  return {
    originalSize: original.length,
    compressedSize: compressed.length,
    ratio: (compressed.length / original.length * 100).toFixed(1) + "%",
    savings: ((1 - compressed.length / original.length) * 100).toFixed(1) + "%",
  };
}
```

### Validation

```typescript
import { compress, decompress, compressionStats } from "./compressor.ts";

const testData = new TextEncoder().encode(
  JSON.stringify({
    records: Array.from({ length: 50 }, (_, i) => ({
      id: `entity-${i}`,
      data: { task: `task-${i}`, comment: "This is a test comment for compression" },
    })),
  })
);

const compressed = await compress(testData);
const stats = compressionStats(testData, compressed);
console.log("Compression stats:", stats);
// Expected: >50% savings for JSON data

const decompressed = await decompress(compressed);
console.assert(
  new TextDecoder().decode(decompressed) === new TextDecoder().decode(testData),
  "Round-trip integrity failed"
);

console.log("✅ Compression round-trip verified");
```

---

## Phase 5C: Integration Test (Batch → Compress → Decompress → Verify)

```typescript
import { createBatches, serializeBatch, deserializeBatch, extractFromBatch } from "./batcher.ts";
import { compress, decompress, compressionStats } from "./compressor.ts";

// 1. Create test entities
const entities = Array.from({ length: 100 }, (_, i) => ({
  entity_id: `entity-${i}`,
  entity_type: "proof_of_work",
  domain_data: {
    task_id: `task-${i}`,
    comment: `Proof of work for field operation #${i}`,
    links: [{ url: `https://storage.example.com/file-${i}.jpg`, file_name: `photo-${i}.jpg` }],
  },
  metadata: { source: "integration_test" },
  created_at: new Date().toISOString(),
}));

// 2. Batch
const batches = createBatches(entities, 25);
console.log(`Created ${batches.length} batches`);

// 3. For each batch: serialize → compress → decompress → extract
for (const batch of batches) {
  const serialized = serializeBatch(batch);
  const compressed = await compress(serialized);
  const stats = compressionStats(serialized, compressed);
  console.log(`Batch ${batch.batch_id}: ${stats.savings} savings`);

  // Round-trip
  const decompressed = await decompress(compressed);
  const deserialized = deserializeBatch(decompressed);

  // Verify each entity
  for (let i = 0; i < batch.entities.length; i++) {
    const extracted = extractFromBatch(deserialized, i);
    const original = batch.entities[i].domain_data;
    console.assert(
      JSON.stringify(extracted) === JSON.stringify(original),
      `Entity ${i} mismatch in batch ${batch.batch_id}`
    );
  }
}

console.log("✅ Full batch-compress integration test passed");
```

---

## After Completion

Update the runbook:
1. Set Phase 5A/5B/5C status to `[x] DONE`
2. Record compression ratios achieved
3. Note any Deno compatibility issues
