import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { db } from "@/platform/db";
import {
  getFileStorage,
  type FileStorage,
} from "@/platform/integrations/storage";
import { authorize } from "@/platform/permissions/guard";
import { hasPermission } from "@/platform/permissions/policy";

import {
  ATTACHMENT_CONTENT_TYPES,
  detectContentType,
  formatFileSize,
  sanitizeFilename,
} from "./files";
import {
  allowedTypesFor,
  attachmentPolicies,
  maxBytesFor,
  type AttachmentPolicyRegistry,
} from "./policies";
import type { AttachmentEntity, AttachmentList, AttachmentView } from "./types";

export type AttachmentDeps = {
  policies?: AttachmentPolicyRegistry;
  storage?: FileStorage;
};

const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

type AttachmentRow = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  uploadedBy: { name: string };
};

function toView(row: AttachmentRow): AttachmentView {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedBy: row.uploadedBy.name,
    createdAt: row.createdAt,
    downloadUrl: `/api/attachments/${encodeURIComponent(row.id)}`,
  };
}

/**
 * A record's files as `viewer` may see them. Checks the role permission and
 * the tool's policy; returns no files when either says no.
 */
export async function listAttachments(
  viewer: CurrentUser,
  entity: AttachmentEntity,
  { policies = attachmentPolicies }: AttachmentDeps = {},
): Promise<AttachmentList> {
  const policy = policies.get(entity.type);
  if (!policy) throw new Error(`No attachment policy for ${entity.type}`);

  const [canView, canUpload] = await Promise.all([
    hasPermission(viewer.role, policy.viewPermission) &&
      policy.canView(entity.id, viewer),
    hasPermission(viewer.role, policy.uploadPermission) &&
      policy.canUpload(entity.id, viewer),
  ]);
  const rows = canView
    ? await db.attachment.findMany({
        where: { entityType: entity.type, entityId: entity.id },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { uploadedBy: { select: { name: true } } },
      })
    : [];
  return {
    entity,
    canView,
    canUpload,
    allowedTypes: allowedTypesFor(policy),
    maxBytes: maxBytesFor(policy),
    attachments: rows.map(toView),
  };
}

export type UploadInput = {
  entity: AttachmentEntity;
  file: { name: string; bytes: Uint8Array };
};

export type UploadResult =
  { ok: true; attachment: AttachmentView } | { ok: false; error: string };

/**
 * Stores a file on a record. The file row and its `attachments.upload` audit
 * entry commit together; role and policy denials are logged as `DENIED`.
 */
export async function uploadAttachment(
  actor: CurrentUser,
  input: UploadInput,
  {
    policies = attachmentPolicies,
    storage = getFileStorage(),
  }: AttachmentDeps = {},
): Promise<UploadResult> {
  const { entity, file } = input;
  const policy = policies.get(entity.type);
  if (!policy)
    return { ok: false, error: `Files are not enabled for ${entity.type}` };

  const auth = await authorize(actor, policy.uploadPermission, entity);
  if (!auth.ok) return { ok: false, error: "You cannot upload files here" };
  const policyDenied = async () => {
    await recordAudit({
      actor,
      action: "attachments.upload",
      outcome: "DENIED",
      entity,
      reason: `${entity.type} policy does not allow uploads on this record`,
    });
    return { ok: false, error: "You cannot upload files here" } as const;
  };
  if (!(await policy.canUpload(entity.id, actor))) return policyDenied();

  if (file.bytes.byteLength === 0)
    return { ok: false, error: "The file is empty" };
  if (file.bytes.byteLength > maxBytesFor(policy))
    return {
      ok: false,
      error: `Files must be ${formatFileSize(maxBytesFor(policy))} or smaller`,
    };
  const contentType = detectContentType(file.bytes);
  if (!contentType || !allowedTypesFor(policy).includes(contentType)) {
    const labels = allowedTypesFor(policy).map(
      (type) => ATTACHMENT_CONTENT_TYPES[type].label,
    );
    return { ok: false, error: `Allowed file types: ${labels.join(", ")}` };
  }

  const storageKey = randomUUID();
  await storage.put(storageKey, file.bytes);
  const data = {
    entityType: entity.type,
    entityId: entity.id,
    filename: sanitizeFilename(file.name),
    contentType,
    sizeBytes: file.bytes.byteLength,
    sha256: sha256(file.bytes),
    storageKey,
    uploadedById: actor.id,
  };
  const row = await db.$transaction(async (tx) => {
    if (!(await policy.canUpload(entity.id, actor, tx))) return null;
    const created = await tx.attachment.create({
      data,
      include: { uploadedBy: { select: { name: true } } },
    });
    await recordAudit(
      {
        actor,
        action: "attachments.upload",
        entity,
        after: auditSnapshot(created),
      },
      tx,
    );
    return created;
  });
  if (!row) return policyDenied();
  return { ok: true, attachment: toView(row) };
}

export type DownloadResult =
  | { ok: true; filename: string; contentType: string; bytes: Uint8Array }
  | { ok: false; status: 401 | 403 | 404 | 500; error: string };

/**
 * Returns a file's bytes after checking the role permission and the tool's
 * policy for its record. The `attachments.download` entry is written before
 * the bytes are returned; denials are logged as `DENIED`.
 */
export async function downloadAttachment(
  actor: CurrentUser | null,
  attachmentId: string,
  {
    policies = attachmentPolicies,
    storage = getFileStorage(),
  }: AttachmentDeps = {},
): Promise<DownloadResult> {
  const notFound = { ok: false, status: 404, error: "File not found" } as const;
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!actor) {
    await recordAudit({
      actor: null,
      action: "attachments.download",
      outcome: "DENIED",
      entity: attachment
        ? { type: attachment.entityType, id: attachment.entityId }
        : undefined,
      after: { attachmentId },
      reason: "Not signed in; downloads require a session",
    });
    return { ok: false, status: 401, error: "Sign in to download files" };
  }
  const policy = attachment && policies.get(attachment.entityType);
  if (!attachment || !policy) return notFound;

  const entity = { type: attachment.entityType, id: attachment.entityId };
  const auth = await authorize(actor, policy.viewPermission, entity);
  if (!auth.ok)
    return { ok: false, status: 403, error: "You cannot view this file" };
  const user = auth.user;
  if (!(await policy.canView(entity.id, user))) {
    await recordAudit({
      actor: user,
      action: "attachments.download",
      outcome: "DENIED",
      entity,
      after: { attachmentId: attachment.id },
      reason: `${entity.type} policy does not allow viewing this record's files`,
    });
    return { ok: false, status: 403, error: "You cannot view this file" };
  }

  const bytes = await storage.get(attachment.storageKey);
  if (!bytes || sha256(bytes) !== attachment.sha256) {
    await recordAudit({
      actor: user,
      action: "attachments.download",
      outcome: "FAILURE",
      entity,
      after: { attachmentId: attachment.id },
      reason: bytes
        ? "Stored file does not match its checksum"
        : "Stored file is missing",
    });
    return { ok: false, status: 500, error: "The file could not be read" };
  }

  await recordAudit({
    actor: user,
    action: "attachments.download",
    entity,
    after: auditSnapshot(attachment),
  });
  return {
    ok: true,
    filename: attachment.filename,
    contentType: attachment.contentType,
    bytes,
  };
}

function auditSnapshot(attachment: {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}) {
  return {
    attachmentId: attachment.id,
    filename: attachment.filename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    sha256: attachment.sha256,
  };
}
