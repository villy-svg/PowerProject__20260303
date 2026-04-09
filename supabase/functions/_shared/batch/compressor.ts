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
