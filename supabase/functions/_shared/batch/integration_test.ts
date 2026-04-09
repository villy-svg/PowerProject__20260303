import { createBatches, serializeBatch, deserializeBatch, extractFromBatch } from "./batcher.ts";
import { compress, decompress, compressionStats } from "./compressor.ts";

async function runIntegrationTest() {
  console.log("Starting Batch-Compress Integration Test...");

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
  const batchSize = 25;
  const batches = createBatches(entities, batchSize);
  console.log(`Created ${batches.length} batches of size up to ${batchSize}`);

  // 3. For each batch: serialize → compress → decompress → extract
  for (const batch of batches) {
    const serialized = serializeBatch(batch);
    const compressed = await compress(serialized);
    const stats = compressionStats(serialized, compressed);
    console.log(`Batch ${batch.batch_id}: ${stats.savings} savings (${stats.compressedSize} bytes)`);

    // Round-trip
    const decompressed = await decompress(compressed);
    const deserialized = deserializeBatch(decompressed);

    // Verify each entity
    for (let i = 0; i < batch.entities.length; i++) {
      const extracted = extractFromBatch(deserialized, i);
      const original = batch.entities[i].domain_data;
      
      const isMatch = JSON.stringify(extracted) === JSON.stringify(original);
      if (!isMatch) {
         console.error(`❌ Entity ${i} mismatch in batch ${batch.batch_id}`);
         process.exit(1);
      }
    }
  }

  console.log("✅ Full batch-compress integration test passed");
}

runIntegrationTest().catch((err) => {
  console.error("Integration test failed:", err);
  process.exit(1);
});
