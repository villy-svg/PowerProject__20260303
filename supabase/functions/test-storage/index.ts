// supabase/functions/test-storage/index.ts
// A temporary smoke test for Phase 4.

import { createStorageAdapter } from "../_shared/storage/adapter.ts";

Deno.serve(async (req) => {
  try {
    console.log("🚀 Starting Storage Smoke Test...");
    const adapter = createStorageAdapter("gdrive");

    // 1. UPLOAD TEST
    const testBatchId = `smoke_test_${Date.now()}`;
    const testData = new TextEncoder().encode("PowerProject: GDrive Connection Test Working!\nTimestamp: " + new Date().toISOString());
    
    console.log("📤 Attempting Upload...");
    const pointer = await adapter.upload(testBatchId, testData, {
      entityType: "proof_of_work",
      recordCount: 1,
      compressedSize: testData.length,
    });
    console.log(`✅ Upload Success! Pointer: ${pointer}`);

    // 2. DOWNLOAD TEST
    console.log("📥 Attempting Download...");
    const downloaded = await adapter.download(pointer);
    const decoded = new TextDecoder().decode(downloaded);
    console.log("✅ Download Success! Content matches.");

    // 3. CLEANUP (Optional - comment out if you want to see the file in Drive)
    /*
    console.log("🗑️ Attempting Cleanup...");
    await adapter.delete(pointer);
    console.log("✅ Cleanup Success!");
    */

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Google Drive Handshake Verified!",
        pointer,
        verification: decoded
      }), 
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Smoke Test Failed:", error.message);
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message,
        stack: error.stack
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
