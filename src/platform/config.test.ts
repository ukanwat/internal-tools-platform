import { afterEach, describe, expect, it, vi } from "vitest";

import { approvalProcessingTimeoutMs } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("approvalProcessingTimeoutMs", () => {
  it("defaults to 5 minutes", () => {
    vi.stubEnv("APPROVAL_PROCESSING_TIMEOUT_MS", "");
    expect(approvalProcessingTimeoutMs()).toBe(300_000);
  });

  it("reads a positive integer from the environment", () => {
    vi.stubEnv("APPROVAL_PROCESSING_TIMEOUT_MS", "60000");
    expect(approvalProcessingTimeoutMs()).toBe(60_000);
  });

  it.each(["0", "-5", "abc", "1.5"])("ignores invalid value %s", (value) => {
    vi.stubEnv("APPROVAL_PROCESSING_TIMEOUT_MS", value);
    expect(approvalProcessingTimeoutMs()).toBe(300_000);
  });
});
