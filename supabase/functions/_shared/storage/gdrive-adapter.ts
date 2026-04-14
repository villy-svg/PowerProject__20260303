// _shared/storage/gdrive-adapter.ts
// Google Drive storage adapter using service account authentication.

import { StorageAdapter } from "./adapter.ts";
import { withRetry } from "../utils/retry.ts";


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
    const response = await withRetry(
      () => fetch(this.serviceAccount.token_uri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      }),
      { maxAttempts: 3, baseDelayMs: 1000, label: "GDrive Token Exchange" }
    );


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
      scope: "https://www.googleapis.com/auth/drive",
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
    const searchResponse = await withRetry(
      () => fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      { maxAttempts: 3, baseDelayMs: 500, label: "GDrive Folder Search" }
    );


    const searchData = await searchResponse.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createResponse = await withRetry(
      () => fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
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
      }),
      { maxAttempts: 3, baseDelayMs: 1000, label: "GDrive Folder Creation" }
    );


    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`❌ GDrive Folder Creation Failed: [Parent: ${parentId}] [Name: ${folderName}]`, errorText);
      throw new Error(`Failed to create folder: ${errorText}`);
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

    const response = await withRetry(
      () => fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      ),
      { maxAttempts: 3, baseDelayMs: 500, label: "GDrive Batch Upload" }
    );


    if (!response.ok) {
      throw new Error(`Upload failed: ${await response.text()}`);
    }

    const fileData = await response.json();
    return fileData.id; // This is the cold_pointer
  }

  async download(pointer: string): Promise<Uint8Array> {
    const token = await this.getAccessToken();

    const response = await withRetry(
      () => fetch(
        `https://www.googleapis.com/drive/v3/files/${pointer}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      ),
      { maxAttempts: 3, baseDelayMs: 500, label: "GDrive Download" }
    );


    if (!response.ok) {
      throw new Error(`Download failed: ${await response.text()}`);
    }

    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(pointer: string): Promise<void> {
    const token = await this.getAccessToken();

    const response = await withRetry(
      () => fetch(
        `https://www.googleapis.com/drive/v3/files/${pointer}?supportsAllDrives=true`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      ),
      { maxAttempts: 3, baseDelayMs: 500, label: "GDrive Delete" }
    );


    if (!response.ok && response.status !== 404) {
      throw new Error(`Delete failed: ${await response.text()}`);
    }
  }

  /**
   * Uploads a single binary asset (e.g. a photo blob from Supabase Storage).
   * @param data       - Raw bytes of the file (Uint8Array)
   * @param fileName   - Original file name (e.g. 'photo-001.jpg')
   * @param entityType - Used to organise into the correct Drive subfolder
   * @returns Drive file ID (the cold_pointer for this asset)
   */
  async uploadAsset(
    data: Uint8Array,
    fileName: string,
    entityType: string
  ): Promise<string> {
    const token = await this.getAccessToken();
    const folderId = await this.getTargetFolder(entityType);

    // Detect content type from extension (basic)
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", pdf: "application/pdf",
      mp4: "video/mp4", mov: "video/quicktime",
    };
    const contentType = contentTypeMap[ext] ?? "application/octet-stream";

    const metadataPayload = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `Cold asset | entity_type: ${entityType}`,
      properties: {
        entity_type: entityType,
        original_name: fileName,
        uploaded_at: new Date().toISOString(),
      },
    });

    const boundary = "----AssetUploadBoundary";
    const bodyParts = [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      `${metadataPayload}\r\n`,
      `--${boundary}\r\n`,
      `Content-Type: ${contentType}\r\n`,
      `Content-Transfer-Encoding: binary\r\n\r\n`,
    ];

    const textBytes = new TextEncoder().encode(bodyParts.join(""));
    const closingBytes = new TextEncoder().encode(`\r\n--${boundary}--`);
    const body = new Uint8Array(textBytes.length + data.length + closingBytes.length);
    body.set(textBytes, 0);
    body.set(data, textBytes.length);
    body.set(closingBytes, textBytes.length + data.length);

    const response = await withRetry(
      () => fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size&supportsAllDrives=true",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      ),
      { maxAttempts: 3, baseDelayMs: 500, label: "GDrive Asset Upload" }
    );


    if (!response.ok) {
      throw new Error(`Asset upload failed: ${await response.text()}`);
    }

    const fileData = await response.json();
    return fileData.id;
  }
}
