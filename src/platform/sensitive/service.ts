import "server-only";

import { recordAudit } from "@/platform/audit/record";
import type { CurrentUser } from "@/platform/auth/types";
import { authorize } from "@/platform/permissions/guard";
import { hasPermission } from "@/platform/permissions/policy";

import { maskValue, SENSITIVE_FIELDS, type SensitiveField } from "./fields";
import { sensitiveSources, type SensitiveSourceRegistry } from "./sources";
import type { SensitiveEntity, SensitiveView } from "./types";

export function toSensitiveView(
  user: CurrentUser,
  field: SensitiveField,
  entity: SensitiveEntity,
  value: string | null,
): SensitiveView {
  const definition = SENSITIVE_FIELDS[field];
  return {
    field,
    label: definition.label,
    entity,
    masked: value == null ? null : maskValue(value),
    canReveal:
      value != null && hasPermission(user.role, definition.revealPermission),
  };
}

export type RevealResult =
  { ok: true; value: string } | { ok: false; error: string };

/**
 * Returns a raw sensitive value. The reveal is logged before the value is
 * returned; a missing permission is logged as a denial.
 */
export async function revealSensitiveValue(
  actor: CurrentUser,
  input: { field: SensitiveField; entity: SensitiveEntity; reason: string },
  sources: SensitiveSourceRegistry = sensitiveSources,
): Promise<RevealResult> {
  const definition = SENSITIVE_FIELDS[input.field];
  const auth = await authorize(
    actor,
    definition.revealPermission,
    input.entity,
  );
  if (!auth.ok)
    return {
      ok: false,
      error: `You cannot view ${definition.label.toLowerCase()}s`,
    };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "A reason is required" };

  const source = sources.get(input.entity.type);
  if (!source)
    return { ok: false, error: `Nothing to reveal on ${input.entity.type}` };
  const value = await source.load(input.entity.id, input.field);
  if (value == null) return { ok: false, error: "Value not found" };

  await recordAudit({
    actor,
    action: "sensitive.reveal",
    entity: input.entity,
    after: { field: input.field },
    reason,
  });
  return { ok: true, value };
}
