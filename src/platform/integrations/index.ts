import "server-only";

import { getKycClient, type KycClient } from "./kyc";
import { getPaymentsClient, type PaymentsClient } from "./payments";

/** Every outside system a tool may use. Tools receive this; they never call vendors directly. */
export type Integrations = {
  payments: PaymentsClient;
  kyc: KycClient;
};

export function getIntegrations(): Integrations {
  return { payments: getPaymentsClient(), kyc: getKycClient() };
}
