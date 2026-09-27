import "server-only";

import { createMockPaymentsClient } from "./mock";
import type { PaymentsClient } from "./types";

export { MOCK_PAYMENT_IDS } from "./mock";
export {
  PaymentsError,
  type PaymentsClient,
  type RefundInput,
  type RefundResult,
} from "./types";

/** Swap the mock for the real provider client here. */
export function getPaymentsClient(): PaymentsClient {
  return createMockPaymentsClient();
}
