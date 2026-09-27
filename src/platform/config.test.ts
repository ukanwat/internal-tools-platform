import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approvalProcessingTimeoutMs,
  kycLeadApprovalRiskLevels,
  kycVendorDashboardUrl,
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

describe("kycVendorDashboardUrl", () => {
  it("defaults to the mock vendor", () => {
    vi.stubEnv("KYC_VENDOR_DASHBOARD_URL", "");
    expect(kycVendorDashboardUrl()).toBe("https://kyc-vendor.example.com");
  });

  it("reads an https URL and drops trailing slashes", () => {
    vi.stubEnv("KYC_VENDOR_DASHBOARD_URL", "https://vendor.test/app//");
    expect(kycVendorDashboardUrl()).toBe("https://vendor.test/app");
  });

  it.each(["http://vendor.test", "javascript:alert(1)", "not a url"])(
    "ignores unsafe value %s",
    (value) => {
      vi.stubEnv("KYC_VENDOR_DASHBOARD_URL", value);
      expect(kycVendorDashboardUrl()).toBe("https://kyc-vendor.example.com");
    },
  );
});

describe("kycLeadApprovalRiskLevels", () => {
  it("defaults to high risk only", () => {
    vi.stubEnv("KYC_LEAD_APPROVAL_RISK_LEVELS", "");
    expect(kycLeadApprovalRiskLevels()).toEqual(["HIGH"]);
  });

  it("can add lower risk levels", () => {
    vi.stubEnv("KYC_LEAD_APPROVAL_RISK_LEVELS", " medium ,bogus");
    expect(kycLeadApprovalRiskLevels()).toEqual(["MEDIUM", "HIGH"]);
  });

  it("cannot drop high risk", () => {
    vi.stubEnv("KYC_LEAD_APPROVAL_RISK_LEVELS", "LOW");
    expect(kycLeadApprovalRiskLevels()).toEqual(["LOW", "HIGH"]);
  });
});
