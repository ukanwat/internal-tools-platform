import "server-only";

import type { AttachmentPolicy } from "@/platform/attachments/policies";
import { db } from "@/platform/db";

import { KYC_CASE_ENTITY } from "./cases";

/** Supporting documents (e.g. proof of source of funds) on a KYC case. */
export const kycCaseAttachmentPolicy: AttachmentPolicy = {
  entityType: KYC_CASE_ENTITY,
  viewPermission: "kyc.view",
  uploadPermission: "kyc.review",
  async canView(entityId) {
    return (await db.kycCase.count({ where: { id: entityId } })) > 0;
  },
  async canUpload(entityId) {
    return (
      (await db.kycCase.count({ where: { id: entityId, status: "OPEN" } })) > 0
    );
  },
};
