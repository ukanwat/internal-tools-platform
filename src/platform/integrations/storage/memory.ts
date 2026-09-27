import type { FileStorage } from "./types";

/** In-process storage for tests. */
export function createMemoryFileStorage(): FileStorage {
  const files = new Map<string, Uint8Array>();
  return {
    async put(key, bytes) {
      if (files.has(key)) throw new Error(`Storage key exists: ${key}`);
      files.set(key, new Uint8Array(bytes));
    },
    async get(key) {
      const bytes = files.get(key);
      return bytes ? new Uint8Array(bytes) : null;
    },
  };
}
