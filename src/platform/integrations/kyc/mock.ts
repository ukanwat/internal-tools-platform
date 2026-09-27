import "server-only";

import { kycVendorDashboardUrl } from "@/platform/config";

import { MOCK_KYC_CHECK_IDS, MOCK_KYC_CHECKS } from "./fixtures";
import { KycVendorError, type KycClient } from "./types";

/** In-app stand-in for the KYC vendor, serving the made-up checks in `fixtures.ts`. */
export function createMockKycClient(): KycClient {
  return {
    async getCheck(checkId) {
      if (checkId === MOCK_KYC_CHECK_IDS.unavailable) {
        throw new KycVendorError("KYC vendor is unavailable");
      }
      if (!Object.hasOwn(MOCK_KYC_CHECKS, checkId)) return null;
      const fixture = MOCK_KYC_CHECKS[checkId];
      return {
        ...fixture,
        checkId,
        completedAt: new Date(fixture.completedAt),
        document: { ...fixture.document },
        results: fixture.results.map((result) => ({ ...result })),
        documentsUrl: `${kycVendorDashboardUrl()}/checks/${encodeURIComponent(checkId)}/documents`,
      };
    },
  };
}
