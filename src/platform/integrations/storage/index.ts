import "server-only";

import { attachmentsStorageDir } from "@/platform/config";

import { createLocalFileStorage } from "./local";
import type { FileStorage } from "./types";

export { createMemoryFileStorage } from "./memory";
export type { FileStorage } from "./types";

/** Swap local disk for object storage (S3, GCS) here. */
export function getFileStorage(): FileStorage {
  return createLocalFileStorage(attachmentsStorageDir());
}
