import "server-only";

import { createMockKycClient } from "./mock";
import type { KycClient } from "./types";

export { MOCK_KYC_CHECK_IDS } from "./fixtures";
export {
  KycVendorError,
  type KycCheck,
  type KycCheckResult,
  type KycClient,
  type KycResultOutcome,
  type KycRiskLevel,
} from "./types";

/** Swap the mock for the real vendor client here. */
export function getKycClient(): KycClient {
  return createMockKycClient();
}
