import type { CurrentUser } from "@/platform/auth/types";
import type { Permission } from "@/platform/permissions/policy";

import type { AttachmentContentType } from "./files";

/**
 * A tool's rules for files on one record type. The platform checks the role
 * permission first, then asks the tool about the specific record.
 */
export type AttachmentPolicy = {
  entityType: string;
  /** Role permission needed to list and download files. */
  viewPermission: Permission;
  /** Role permission needed to upload files. */
  uploadPermission: Permission;
  /** Whether `actor` may see this record's files. */
  canView: (entityId: string, actor: CurrentUser) => Promise<boolean>;
  /** Whether `actor` may add files to this record (e.g. not once it is closed). */
  canUpload: (entityId: string, actor: CurrentUser) => Promise<boolean>;
  /** Defaults to PDF, PNG and JPEG. */
  allowedTypes?: readonly AttachmentContentType[];
  /** Defaults to 10 MB. */
  maxBytes?: number;
};

export type AttachmentPolicyRegistry = {
  get(entityType: string): AttachmentPolicy | undefined;
};

export function createAttachmentPolicyRegistry(
  policies: readonly AttachmentPolicy[],
): AttachmentPolicyRegistry {
  const byType = new Map<string, AttachmentPolicy>();
  for (const policy of policies) {
    if (byType.has(policy.entityType)) {
      throw new Error(`Duplicate attachment policy: ${policy.entityType}`);
    }
    byType.set(policy.entityType, policy);
  }
  return { get: (entityType) => byType.get(entityType) };
}

/** Tools add a policy for each record type that accepts files. */
export const attachmentPolicies = createAttachmentPolicyRegistry([]);
