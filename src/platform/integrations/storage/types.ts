/**
 * Write-once object storage. There is no delete or overwrite: stored files
 * are records.
 */
export interface FileStorage {
  /** Stores `bytes` under a new `key`. Throws if the key already exists. */
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** The stored bytes, or null if nothing is stored under `key`. */
  get(key: string): Promise<Uint8Array | null>;
}
