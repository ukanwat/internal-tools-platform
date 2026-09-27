"use server";

import { requirePermission } from "@/platform/permissions/guard";

import { isSensitiveField, SENSITIVE_FIELDS } from "./fields";
import { revealSensitiveValue } from "./service";

export type RevealState =
  { ok: true; value: string } | { ok: false; error: string } | null;

export async function revealSensitiveField(
  _prev: RevealState,
  formData: FormData,
): Promise<RevealState> {
  const field = formData.get("field");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const reason = formData.get("reason");
  if (
    typeof field !== "string" ||
    !isSensitiveField(field) ||
    typeof entityType !== "string" ||
    typeof entityId !== "string" ||
    typeof reason !== "string"
  ) {
    return { ok: false, error: "Invalid form submission" };
  }
  const entity = { type: entityType, id: entityId };
  const actor = await requirePermission(
    SENSITIVE_FIELDS[field].revealPermission,
    entity,
  );
  return revealSensitiveValue(actor, { field, entity, reason });
}
