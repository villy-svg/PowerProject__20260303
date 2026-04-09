import { compress, decompress, compressionStats } from "./compressor.ts";

async function runTest() {
  const testData = new TextEncoder().encode(
    JSON.stringify({
      records: Array.from({ length: 50 }, (_, i) => ({
        id: `entity-${i}`,
        data: { task: `task-${i}`, comment: "This is a test comment for compression" },
      })),
    })
  );

  console.log("Starting compression test...");
  const compressed = await compress(testData);
  const stats = compressionStats(testData, compressed);
  console.log("Compression stats:", stats);

  const decompressed = await decompress(compressed);
  const isIntegrityValid = new TextDecoder().decode(decompressed) === new TextDecoder().decode(testData);
  
  console.assert(
    isIntegrityValid,
    "Round-trip integrity failed"
  );

  if (isIntegrityValid) {
    console.log("✅ Compression round-trip verified");
  } else {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
