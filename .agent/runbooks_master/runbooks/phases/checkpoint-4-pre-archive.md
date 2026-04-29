# ✅ Checkpoint 4 — After Phase 5 (Batching + Compression)

> **Run this BEFORE starting Phase 6.**
> This verifies the batcher and compressor work correctly so the archive engine has a solid foundation.

---

## Step 1: Verify Files Exist

```bash
ls -la supabase/functions/_shared/batch/
```

**Expected:**
```
batcher.ts
compressor.ts
```

---

## Step 2: Type-Check Both Files

```bash
cd supabase/functions
deno check _shared/batch/batcher.ts
deno check _shared/batch/compressor.ts
```

**Expected**: No errors.

---

## Step 3: Run the Batcher Unit Test

Create this temporary test file:

**File**: `supabase/functions/_shared/batch/test-batcher.ts` (DELETE after test)

```typescript
import { createBatches, serializeBatch, deserializeBatch, extractFromBatch } from "./batcher.ts";

// Test 1: Correct batch count
const entities = Array.from({ length: 53 }, (_, i) => ({
  entity_id: `entity-${i}`,
  entity_type: "proof_of_work",
  domain_data: { task_id: `task-${i}`, comment: `Test comment ${i}`, links: [] },
  metadata: { index: i },
  created_at: new Date().toISOString(),
}));

const batches = createBatches(entities, 25);
console.assert(batches.length === 3, `Expected 3 batches, got ${batches.length}`);
console.assert(batches[0].entities.length === 25, `Expected 25, got ${batches[0].entities.length}`);
console.assert(batches[1].entities.length === 25, `Expected 25, got ${batches[1].entities.length}`);
console.assert(batches[2].entities.length === 3, `Expected 3, got ${batches[2].entities.length}`);
console.log("✅ Batch count and sizes correct.");

// Test 2: Batch IDs are unique
const allIds = batches.map(b => b.batch_id);
const uniqueIds = new Set(allIds);
console.assert(uniqueIds.size === 3, `Batch IDs are not unique! Got: ${allIds.join(", ")}`);
console.log("✅ Batch IDs are unique.");

// Test 3: Round-trip integrity
const serialized = serializeBatch(batches[0]);
const deserialized = deserializeBatch(serialized);
console.assert(deserialized.count === 25, `Expected 25, got ${deserialized.count}`);
const extracted = extractFromBatch(deserialized, 5);
console.assert(
  (extracted as any)?.task_id === "task-5",
  `Expected task-5, got ${(extracted as any)?.task_id}`
);
console.log("✅ Serialization/deserialization round-trip correct.");

// Test 4: extractFromBatch returns null for invalid index
const missing = extractFromBatch(deserialized, 999);
console.assert(missing === null, `Expected null for missing index, got ${JSON.stringify(missing)}`);
console.log("✅ extractFromBatch returns null for invalid index.");

console.log("\n🎉 All batcher tests PASSED.");
```

```bash
cd supabase/functions
deno run _shared/batch/test-batcher.ts
```

**Expected output:**
```
✅ Batch count and sizes correct.
✅ Batch IDs are unique.
✅ Serialization/deserialization round-trip correct.
✅ extractFromBatch returns null for invalid index.

🎉 All batcher tests PASSED.
```

---

## Step 4: Run the Compressor Unit Test

Create this temporary test file:

**File**: `supabase/functions/_shared/batch/test-compressor.ts` (DELETE after test)

```typescript
import { compress, decompress, compressionStats } from "./compressor.ts";

// Generate test data (JSON is highly compressible)
const testPayload = {
  records: Array.from({ length: 50 }, (_, i) => ({
    id: `entity-${i}`,
    data: { task: `task-${i}`, comment: "This is a test comment for compression verification" },
  })),
};
const testData = new TextEncoder().encode(JSON.stringify(testPayload));

// Test 1: Compression
const compressed = await compress(testData);
const stats = compressionStats(testData, compressed);
console.log(`Compression stats: ${JSON.stringify(stats)}`);
console.assert(
  compressed.length < testData.length,
  `Compressed size (${compressed.length}) should be smaller than original (${testData.length})`
);
console.log("✅ Compression reduced file size.");

// Test 2: Round-trip
const decompressed = await decompress(compressed);
const original = new TextDecoder().decode(testData);
const result = new TextDecoder().decode(decompressed);
console.assert(original === result, "Round-trip content mismatch!");
console.log("✅ Decompression round-trip matches original.");

// The savings should be >50% for repetitive JSON data
const savingsPct = parseFloat(stats.savings);
console.assert(savingsPct > 30, `Expected >30% savings but got ${stats.savings}`);
console.log(`✅ Compression efficiency acceptable: ${stats.savings} savings.`);

console.log("\n🎉 All compressor tests PASSED.");
```

```bash
cd supabase/functions
deno run _shared/batch/test-compressor.ts
```

**Expected output:**
```
Compression stats: {"originalSize":...,"compressedSize":...,"ratio":"...%","savings":"...%"}
✅ Compression reduced file size.
✅ Decompression round-trip matches original.
✅ Compression efficiency acceptable: XX.X% savings.

🎉 All compressor tests PASSED.
```

---

## Step 5: Clean Up Test Files

```bash
rm supabase/functions/_shared/batch/test-batcher.ts
rm supabase/functions/_shared/batch/test-compressor.ts
```

---

## ✅ Checkpoint PASSED if:
- Both `.ts` files exist and type-check clean
- Batcher test passes all 4 assertions
- Compressor test confirms round-trip integrity and >30% savings

## ❌ Checkpoint FAILED if:
- `Batch IDs are not unique` → `crypto.randomUUID()` suffix missing from batcher
- `Round-trip content mismatch` → bug in compressor streams
- `CompressionStream is not defined` → Deno version too old; update to latest

---

**➡️ Proceed to Phase 6 only after this checkpoint passes.**
