import "server-only";

import type { AttachmentPolicy } from "@/platform/attachments/policies";
import { db } from "@/platform/db";

import { KYC_CASE_ENTITY, lockKycCase } from "./cases";

/** Supporting documents (e.g. proof of source of funds) on a KYC case. */
export const kycCaseAttachmentPolicy: AttachmentPolicy = {
  entityType: KYC_CASE_ENTITY,
  viewPermission: "kyc.view",
  uploadPermission: "kyc.review",
  async canView(entityId) {
    return (await db.kycCase.count({ where: { id: entityId } })) > 0;
  },
  async canUpload(entityId, _actor, tx) {
    const kycCase = tx
      ? await lockKycCase(tx, entityId)
      : await db.kycCase.findUnique({ where: { id: entityId } });
    return kycCase?.status === "OPEN";
  },
};
