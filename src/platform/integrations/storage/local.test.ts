// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createLocalFileStorage } from "./local";

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "attachments-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const KEY = "3f1c2a9e-7b4d-4e7a-9c1b-2d5e6f7a8b9c";

describe("createLocalFileStorage", () => {
  it("stores and reads back bytes", async () => {
    const storage = createLocalFileStorage(root);
    await storage.put(KEY, new Uint8Array([1, 2, 3]));
    expect(await storage.get(KEY)).toEqual(new Uint8Array([1, 2, 3]));
    expect(await storage.get("00000000-0000-0000-0000-000000000000")).toBe(
      null,
    );
  });

  it("never overwrites a stored file", async () => {
    const storage = createLocalFileStorage(root);
    await storage.put(KEY, new Uint8Array([1]));
    await expect(storage.put(KEY, new Uint8Array([2]))).rejects.toThrow();
    expect(await storage.get(KEY)).toEqual(new Uint8Array([1]));
  });

  it("rejects keys that could escape the storage directory", async () => {
    const storage = createLocalFileStorage(root);
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(
      "Invalid storage key",
    );
    await expect(
      storage.put("../outside-the-root", new Uint8Array([1])),
    ).rejects.toThrow("Invalid storage key");
  });
});
