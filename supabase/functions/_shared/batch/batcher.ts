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
    // Use a UUID suffix to guarantee global uniqueness even if the function
    // runs twice within the same millisecond (timestamp-only IDs can collide).
    const batchId = `${chunk[0].entity_type}_${timestamp.replace(/[^0-9]/g, "")}_${Math.floor(i / batchSize)}_${crypto.randomUUID().slice(0, 8)}`;

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
