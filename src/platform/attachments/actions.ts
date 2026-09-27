"use server";

import { requirePermission } from "@/platform/permissions/guard";
import type { ActionResult } from "@/platform/ui/reason-dialog";

import { formatFileSize } from "./files";
import { attachmentPolicies, maxBytesFor } from "./policies";
import { uploadAttachment as upload } from "./service";

export async function uploadAttachment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const file = formData.get("file");
  if (
    typeof entityType !== "string" ||
    typeof entityId !== "string" ||
    !(file instanceof File)
  ) {
    return { ok: false, message: "Choose a file to upload" };
  }
  const policy = attachmentPolicies.get(entityType);
  if (!policy)
    return { ok: false, message: `Files are not enabled for ${entityType}` };
  const entity = { type: entityType, id: entityId };
  const actor = await requirePermission(policy.uploadPermission, entity);

  if (file.size > maxBytesFor(policy)) {
    return {
      ok: false,
      message: `Files must be ${formatFileSize(maxBytesFor(policy))} or smaller`,
    };
  }
  const result = await upload(actor, {
    entity,
    file: { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
  });
  return result.ok
    ? { ok: true, message: `Uploaded ${result.attachment.filename}` }
    : { ok: false, message: result.error };
}
