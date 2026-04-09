// _shared/storage/adapter.ts
// Abstract storage adapter interface for hot/cold data tiering.
// Implementations: Google Drive, S3, Supabase Storage (future)

import { GoogleDriveAdapter } from "./gdrive-adapter.ts";

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

  /**
   * Upload a single binary asset (e.g. a photo from Supabase Storage).
   * Returns a pointer (file_id, URL, etc.) to the uploaded file.
   */
  uploadAsset(
    data: Uint8Array,
    fileName: string,
    entityType: string
  ): Promise<string>;

  /** Download a batch file by pointer. Returns raw compressed bytes. */
  download(pointer: string): Promise<Uint8Array>;

  /** Delete a batch file by pointer. */
  delete(pointer: string): Promise<void>;
}

export type StorageProvider = "gdrive" | "s3" | "supabase_storage";

/**
 * Factory function to create the appropriate storage adapter.
 */
export function createStorageAdapter(provider: StorageProvider): StorageAdapter {
  switch (provider) {
    case "gdrive":
      return new GoogleDriveAdapter();
    case "s3":
      throw new Error("S3 adapter not yet implemented");
    case "supabase_storage":
      throw new Error("Supabase Storage adapter not yet implemented");
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
