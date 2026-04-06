# Phase 4: Google Drive Adapter — Execution Guide

> **Prerequisite**: Phase 3 complete. Google Cloud service account required.  
> **Runbook**: `.agent/runbooks/hot-cold-storage-runbook.md`  
> **Sub-phases**: 4A, 4B, 4C, 4D

---

## Pre-Phase: Google Cloud Setup

### Required Before Starting

1. **Create or select a GCP project**
2. **Enable Google Drive API**:
   ```
   https://console.cloud.google.com/apis/library/drive.googleapis.com
   ```
3. **Create a Service Account**:
   - IAM & Admin → Service Accounts → Create
   - No roles needed (Drive access is per-folder)
   - Create JSON key → download
4. **Create a Drive folder** for cold storage:
   - Create folder: `PowerProject-ColdStorage`
   - Share with the service account email (Editor access)
   - Copy the folder ID from the URL
5. **Set Supabase secrets**:
   ```bash
   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste entire JSON key>'
   supabase secrets set GOOGLE_DRIVE_FOLDER_ID='<folder_id>'
   ```

---

## Phase 4A: Storage Adapter Interface + Factory

### What to Create

**File**: `supabase/functions/_shared/storage/adapter.ts`

```typescript
// _shared/storage/adapter.ts
// Abstract storage adapter interface for hot/cold data tiering.
// Implementations: Google Drive, S3, Supabase Storage (future)

export interface StorageAdapter {
  /** Upload a compressed batch file. Returns a pointer (file_id, URL, etc.) */
  upload(
    batchId: string,
    data: Uint8Array,
    metadata: {
      entityType: string;
      recordCount: number;
      compressedSize: number;
    }
  ): Promise<string>;

  /** Download a batch file by pointer. Returns raw compressed bytes. */
  download(pointer: string): Promise<Uint8Array>;

  /** Delete a batch file by pointer. */
  delete(pointer: string): Promise<void>;
}

export type StorageProvider = "gdrive" | "s3" | "supabase_storage";

/**
 * Factory function to create the appropriate storage adapter.
 * Currently only Google Drive is implemented.
 */
export function createStorageAdapter(provider: StorageProvider): StorageAdapter {
  switch (provider) {
    case "gdrive":
      // Lazy import to avoid loading GDrive deps when not needed
      const { GoogleDriveAdapter } = await import("./gdrive-adapter.ts");
      return new GoogleDriveAdapter();
    case "s3":
      throw new Error("S3 adapter not yet implemented");
    case "supabase_storage":
      throw new Error("Supabase Storage adapter not yet implemented");
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
```

> **Note**: The factory uses dynamic import for lazy loading. Update to static import if Deno doesn't support top-level await in this context.

### Validation

- TypeScript compiles without errors
- Factory throws for unimplemented providers
- Interface is sufficient for all operations

---

## Phase 4B: Google Drive Upload Implementation

### What to Create

**File**: `supabase/functions/_shared/storage/gdrive-adapter.ts`

```typescript
// _shared/storage/gdrive-adapter.ts
// Google Drive storage adapter using service account authentication.

import { StorageAdapter } from "./adapter.ts";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export class GoogleDriveAdapter implements StorageAdapter {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private serviceAccount: ServiceAccountKey;
  private rootFolderId: string;

  constructor() {
    const keyJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");

    this.serviceAccount = JSON.parse(keyJson);
    this.rootFolderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "";
    if (!this.rootFolderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID not set");
  }

  // ─── AUTH ──────────────────────────────────────────────────────────────────

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const jwt = await this.createJWT();
    const response = await fetch(this.serviceAccount.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  private async createJWT(): Promise<string> {
    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive.file",
      aud: this.serviceAccount.token_uri,
      iat: now,
      exp: now + 3600,
    };

    const encodedHeader = this.base64url(JSON.stringify(header));
    const encodedPayload = this.base64url(JSON.stringify(payload));
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Import the private key and sign
    const key = await crypto.subtle.importKey(
      "pkcs8",
      this.pemToBuffer(this.serviceAccount.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsignedToken)
    );

    const encodedSignature = this.base64url(
      String.fromCharCode(...new Uint8Array(signature))
    );

    return `${unsignedToken}.${encodedSignature}`;
  }

  private base64url(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private pemToBuffer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\n/g, "");
    const binary = atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  }

  // ─── FOLDER MANAGEMENT ────────────────────────────────────────────────────

  private async ensureFolder(parentId: string, folderName: string): Promise<string> {
    const token = await this.getAccessToken();

    // Check if folder exists
    const query = `'${parentId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create folder: ${await createResponse.text()}`);
    }

    const folderData = await createResponse.json();
    return folderData.id;
  }

  /**
   * Creates folder path: root/cold-storage/{entityType}/{YYYY-MM}/
   */
  private async getTargetFolder(entityType: string): Promise<string> {
    const coldStorageFolder = await this.ensureFolder(this.rootFolderId, "cold-storage");
    const typeFolder = await this.ensureFolder(coldStorageFolder, entityType);
    const monthFolder = await this.ensureFolder(
      typeFolder,
      new Date().toISOString().slice(0, 7) // YYYY-MM
    );
    return monthFolder;
  }

  // ─── CORE OPERATIONS ──────────────────────────────────────────────────────

  async upload(
    batchId: string,
    data: Uint8Array,
    metadata: { entityType: string; recordCount: number; compressedSize: number }
  ): Promise<string> {
    const token = await this.getAccessToken();
    const folderId = await this.getTargetFolder(metadata.entityType);

    const fileName = `batch_${batchId}.json.gz`;

    // Multipart upload (metadata + content)
    const metadataPayload = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `Cold storage batch | type: ${metadata.entityType} | records: ${metadata.recordCount} | compressed: ${metadata.compressedSize}B`,
      properties: {
        batch_id: batchId,
        entity_type: metadata.entityType,
        record_count: String(metadata.recordCount),
        created_at: new Date().toISOString(),
      },
    });

    const boundary = "----BatchUploadBoundary";
    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      `${metadataPayload}\r\n`,
      `--${boundary}\r\n`,
      `Content-Type: application/gzip\r\n`,
      `Content-Transfer-Encoding: binary\r\n\r\n`,
    ];

    // Combine text parts + binary data + closing boundary
    const textBytes = new TextEncoder().encode(bodyParts.join(""));
    const closingBytes = new TextEncoder().encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(textBytes.length + data.length + closingBytes.length);
    body.set(textBytes, 0);
    body.set(data, textBytes.length);
    body.set(closingBytes, textBytes.length + data.length);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${await response.text()}`);
    }

    const fileData = await response.json();
    return fileData.id; // This is the cold_pointer
  }

  async download(pointer: string): Promise<Uint8Array> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${pointer}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`Download failed: ${await response.text()}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(pointer: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${pointer}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${await response.text()}`);
    }
  }
}
```

---

## Phase 4C: Integration Testing

### Test Script (run via Edge Function or Deno)

```typescript
// Test: Upload → Download → Verify → Delete
const adapter = new GoogleDriveAdapter();
const testData = new TextEncoder().encode(JSON.stringify({ test: true, records: [1, 2, 3] }));

// Upload
const pointer = await adapter.upload("test-batch-001", testData, {
  entityType: "proof_of_work",
  recordCount: 3,
  compressedSize: testData.length,
});
console.log("Uploaded. Pointer:", pointer);

// Download
const downloaded = await adapter.download(pointer);
const decoded = new TextDecoder().decode(downloaded);
console.log("Downloaded:", decoded);
console.assert(decoded === JSON.stringify({ test: true, records: [1, 2, 3] }));

// Delete
await adapter.delete(pointer);
console.log("Deleted successfully");
```

### Validation Checklist

- [ ] File appears in Drive under `cold-storage/proof_of_work/YYYY-MM/`
- [ ] File properties contain batch metadata
- [ ] Download returns exact same bytes
- [ ] Delete removes the file
- [ ] Folder creation is idempotent (running twice doesn't create duplicates)

---

## After Completion

Update the runbook:
1. Set Phase 4A/4B/4C/4D status to `[x] DONE`
2. Record Drive folder structure screenshot
3. Note any auth issues encountered
4. Confirm secrets are set
