# ✅ Checkpoint 3 — After Phase 4 (Google Drive Adapter)

> **Run this BEFORE starting Phase 5.**
> This checkpoint requires your Google Drive credentials to be set.
> Run all checks from your local machine or via the Supabase Functions log.

---

## Pre-Flight: Secrets Must Be Set

Confirm both Supabase secrets are set:
```bash
npx supabase secrets list
```

**Expected output must include:**
```
GOOGLE_SERVICE_ACCOUNT_JSON   <set>
GOOGLE_DRIVE_FOLDER_ID        <set>
```

If either is missing, run:
```bash
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste full JSON key content here>'
npx supabase secrets set GOOGLE_DRIVE_FOLDER_ID='<your Drive folder ID>'
```

---

## Step 1: Verify Drive Folder ID Format

The folder ID should look like a long string of letters/numbers/underscores, e.g.:
`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`

It must NOT be a full URL. Only the ID portion after `/folders/` in the Drive URL.

---

## Step 2: Verify Service Account Has Drive Access

1. Open [Google Drive](https://drive.google.com/)
2. Navigate to your `PowerProject-ColdStorage` folder
3. Click **"Share"** on the folder
4. Confirm the service account email (from the JSON key's `client_email` field) is listed with **Editor** access

If not listed, share the folder with the service account email now.

---

## Step 3: Deploy a Test Function and Verify Upload → Download → Delete

Create a temporary one-off test by deploying `entity-archive` and calling it with test data, OR create a minimal test script.

**Easiest approach — run this in Supabase SQL Editor to create a test trigger:**

First, verify the adapter files exist locally:
```
supabase/functions/_shared/storage/adapter.ts       ← must exist
supabase/functions/_shared/storage/gdrive-adapter.ts ← must exist
```

Both files should have been created in Phase 4. Check them with:
```bash
ls -la supabase/functions/_shared/storage/
```

**Expected output:**
```
adapter.ts
gdrive-adapter.ts
```

---

## Step 4: Type-Check the Adapter Files

Run the Deno type checker on the adapter files:
```bash
cd supabase/functions
deno check _shared/storage/adapter.ts
deno check _shared/storage/gdrive-adapter.ts
```

**Expected**: No output (no errors).

**If you see errors**:
- `"await" is not a keyword here` → the factory function still has `await import()` in a sync context. Re-read Phase 4A.
- `Property 'uploadAsset' does not exist` → the interface wasn't updated. Re-read Phase 4A.

---

## Step 5: Test the Full Upload → Download → Delete Cycle

Create this test file temporarily:

**File**: `supabase/functions/_shared/storage/test-gdrive.ts` (DELETE after test)

```typescript
import { GoogleDriveAdapter } from "./gdrive-adapter.ts";

const adapter = new GoogleDriveAdapter();
const testData = new TextEncoder().encode(JSON.stringify({ test: true, checkpoint: 3 }));

console.log("Testing upload...");
const pointer = await adapter.upload("checkpoint-test-001", testData, {
  entityType: "proof_of_work",
  recordCount: 1,
  compressedSize: testData.length,
});
console.log("✅ Upload succeeded. Pointer:", pointer);

console.log("Testing download...");
const downloaded = await adapter.download(pointer);
const decoded = new TextDecoder().decode(downloaded);
console.log("✅ Download succeeded. Content:", decoded);

const original = new TextDecoder().decode(testData);
if (decoded !== original) {
  console.error("❌ MISMATCH: downloaded content does not match uploaded content");
  Deno.exit(1);
}
console.log("✅ Content integrity verified.");

console.log("Testing asset upload...");
const assetPointer = await adapter.uploadAsset(testData, "test-photo.jpg", "proof_of_work");
console.log("✅ Asset upload succeeded. Pointer:", assetPointer);

console.log("Testing delete (batch file)...");
await adapter.delete(pointer);
console.log("✅ Batch file deleted.");

console.log("Testing delete (asset)...");
await adapter.delete(assetPointer);
console.log("✅ Asset deleted.");

console.log("\n🎉 All GDrive adapter tests PASSED.");
```

Run it:
```bash
cd supabase/functions
deno run --allow-net --allow-env _shared/storage/test-gdrive.ts
```

**Expected final output:**
```
✅ Upload succeeded. Pointer: <some-drive-file-id>
✅ Download succeeded. Content: {"test":true,"checkpoint":3}
✅ Content integrity verified.
✅ Asset upload succeeded. Pointer: <another-drive-file-id>
✅ Batch file deleted.
✅ Asset deleted.

🎉 All GDrive adapter tests PASSED.
```

**After verifying**, delete the test file:
```bash
rm supabase/functions/_shared/storage/test-gdrive.ts
```

---

## Step 6: Verify Folder Structure in Drive

1. Open [Google Drive](https://drive.google.com/) and navigate to `PowerProject-ColdStorage`
2. If the test in Step 5 passed, you should see a `cold-storage/` subfolder was created (even if test files were deleted, the folder remains)
3. Confirm folder path: `PowerProject-ColdStorage/cold-storage/proof_of_work/YYYY-MM/`

---

## ✅ Checkpoint PASSED if:
- Both secrets are set (`npx supabase secrets list`)
- Deno type check passes with no errors
- Upload → Download → Delete cycle succeeds in Step 5
- Folder structure is visible in Drive

## ❌ Checkpoint FAILED if:
- `Token exchange failed` → service account JSON is malformed or `token_uri` is wrong
- `404` on Drive API → folder ID is wrong or service account doesn't have access
- Content mismatch → adapter has a bug in the binary encoding

---

**➡️ Proceed to Phase 5 only after this checkpoint passes.**
