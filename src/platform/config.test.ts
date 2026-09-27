import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approvalProcessingTimeoutMs,
  refundApprovalThresholdMinor,
} from "./config";

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

  it("caps values above the timer limit", () => {
    vi.stubEnv("APPROVAL_PROCESSING_TIMEOUT_MS", "9999999999");
    expect(approvalProcessingTimeoutMs()).toBe(2 ** 31 - 1);
  });

  it.each(["0", "-5", "abc", "1.5"])("ignores invalid value %s", (value) => {
    vi.stubEnv("APPROVAL_PROCESSING_TIMEOUT_MS", value);
    expect(approvalProcessingTimeoutMs()).toBe(300_000);
  });
});

describe("refundApprovalThresholdMinor", () => {
  it("defaults to $500", () => {
    vi.stubEnv("REFUND_APPROVAL_THRESHOLD_USD", "");
    expect(refundApprovalThresholdMinor()).toBe(50_000);
  });

  it.each([
    ["750", 75_000],
    ["1000.50", 100_050],
    ["0", 0],
  ])("reads %s dollars from the environment", (value, expected) => {
    vi.stubEnv("REFUND_APPROVAL_THRESHOLD_USD", value);
    expect(refundApprovalThresholdMinor()).toBe(expected);
  });

  it.each(["-5", "abc", "1.005", "1e6"])(
    "ignores invalid value %s",
    (value) => {
      vi.stubEnv("REFUND_APPROVAL_THRESHOLD_USD", value);
      expect(refundApprovalThresholdMinor()).toBe(50_000);
    },
  );
});
