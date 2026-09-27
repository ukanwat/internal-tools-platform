import "server-only";

import { db } from "@/platform/db";
import { getIntegrations, type Integrations } from "@/platform/integrations";
import { hasPermission } from "@/platform/permissions/policy";
import type { SensitiveSource } from "@/platform/sensitive/sources";

import { KYC_CASE_ENTITY } from "./cases";

/** ID numbers are read from the vendor's check on demand; they are never stored here. */
export function createKycCaseSensitiveSource(
  integrations: () => Integrations = getIntegrations,
): SensitiveSource {
  return {
    entityType: KYC_CASE_ENTITY,
    async load(entityId, field, actor) {
      if (field !== "idNumber" || !hasPermission(actor.role, "kyc.view")) {
        return null;
      }
      const kycCase = await db.kycCase.findUnique({
        where: { id: entityId },
        select: { vendorCheckId: true },
      });
      if (!kycCase) return null;
      try {
        const check = await integrations().kyc.getCheck(kycCase.vendorCheckId);
        return check?.document.idNumber ?? null;
      } catch {
        return null;
      }
    },
  };
}

export const kycCaseSensitiveSource = createKycCaseSensitiveSource();
