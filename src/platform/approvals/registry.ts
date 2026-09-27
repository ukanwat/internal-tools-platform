import { kycDecisionApprovalType } from "@/tools/kyc/approval-type";

import type { ApprovalType } from "./types";

export type ApprovalRegistry = {
  get(key: string): ApprovalType | undefined;
  list(): ApprovalType[];
};

export function createApprovalRegistry(
  types: readonly ApprovalType[],
): ApprovalRegistry {
  const byKey = new Map<string, ApprovalType>();
  for (const type of types) {
    if (byKey.has(type.key)) {
      throw new Error(`Duplicate approval type: ${type.key}`);
    }
    byKey.set(type.key, type);
  }
  return {
    get: (key) => byKey.get(key),
    list: () => [...byKey.values()],
  };
}

/** Tools add their approval types here. */
export const approvalRegistry = createApprovalRegistry([
  kycDecisionApprovalType,
]);
