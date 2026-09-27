import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { FileStorage } from "./types";

const KEY_PATTERN = /^[a-z0-9][a-z0-9-]{7,63}$/;

function assertKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
}

/** Stores files on local disk under `root`. */
export function createLocalFileStorage(root: string): FileStorage {
  const pathFor = (key: string) =>
    path.join(/* turbopackIgnore: true */ root, key.slice(0, 2), key);
  return {
    async put(key, bytes) {
      assertKey(key);
      const file = pathFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: "wx" });
    },
    async get(key) {
      assertKey(key);
      try {
        return new Uint8Array(await readFile(pathFor(key)));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}
