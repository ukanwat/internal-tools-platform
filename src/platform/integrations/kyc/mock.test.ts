import { afterEach, describe, expect, it, vi } from "vitest";

import { MOCK_KYC_CHECK_IDS } from "./fixtures";
import { createMockKycClient } from "./mock";
import { KycVendorError } from "./types";

afterEach(() => vi.unstubAllEnvs());

describe("mock KYC client", () => {
  const kyc = createMockKycClient();

  it("returns a known check with its results and a vendor documents link", async () => {
    vi.stubEnv("KYC_VENDOR_DASHBOARD_URL", "");
    const check = await kyc.getCheck("chk_mock_1003");
    expect(check).toMatchObject({
      checkId: "chk_mock_1003",
      riskLevel: "HIGH",
      documentsUrl:
        "https://kyc-vendor.example.com/checks/chk_mock_1003/documents",
    });
    expect(check?.completedAt).toBeInstanceOf(Date);
    expect(check?.results.length).toBeGreaterThan(0);
  });

  it("builds document links from the configured dashboard", async () => {
    vi.stubEnv("KYC_VENDOR_DASHBOARD_URL", "https://vendor.test/app/");
    expect((await kyc.getCheck("chk_mock_1001"))?.documentsUrl).toBe(
      "https://vendor.test/app/checks/chk_mock_1001/documents",
    );
  });

  it("returns null for unknown checks", async () => {
    expect(await kyc.getCheck("chk_nope")).toBeNull();
    expect(await kyc.getCheck("toString")).toBeNull();
  });

  it("fails like the vendor being down", async () => {
    await expect(kyc.getCheck(MOCK_KYC_CHECK_IDS.unavailable)).rejects.toThrow(
      KycVendorError,
    );
  });

  it("returns copies so callers cannot change the fixtures", async () => {
    const first = await kyc.getCheck("chk_mock_1002");
    first!.document.idNumber = "changed";
    first!.results[0].outcome = "fail";
    const second = await kyc.getCheck("chk_mock_1002");
    expect(second?.document.idNumber).toBe("ZX7730215");
    expect(second?.results[0].outcome).not.toBe("fail");
  });
});
