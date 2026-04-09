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
