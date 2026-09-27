"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/platform/db";
import { requirePermission } from "@/platform/permissions/guard";
import type { ActionResult } from "@/platform/ui/reason-dialog";

import { parseRolloutPercent } from "./rules";
import {
  changeFlag,
  flagChangePermissionFor,
  flagTurnOffPermission,
  turnOffFlag,
} from "./service";
import { flagEntity } from "./snapshot";

function toActionResult(
  result: { ok: true; message: string } | { ok: false; error: string },
): ActionResult {
  return result.ok
    ? { ok: true, message: result.message }
    : { ok: false, message: result.error };
}

export async function changeFlagAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const stateId = formData.get("stateId");
  const version = Number(formData.get("version"));
  const reason = formData.get("reason");
  const rolloutPercent = parseRolloutPercent(formData.get("rolloutPercent"));
  if (
    typeof stateId !== "string" ||
    typeof reason !== "string" ||
    !Number.isInteger(version)
  ) {
    return { ok: false, message: "Invalid form submission" };
  }
  if (rolloutPercent === null) {
    return {
      ok: false,
      message: "Rollout must be a whole number from 0 to 100",
    };
  }
  const to = { enabled: formData.get("enabled") === "1", rolloutPercent };

  const permission = await flagChangePermissionFor({ stateId, to });
  if (!permission) {
    await requirePermission("flags.view");
    return { ok: false, message: "Nothing to change" };
  }
  const actor = await requirePermission(permission, flagEntity(stateId));

  const result = await changeFlag(actor, {
    stateId,
    expectedVersion: version,
    to,
    reason,
  });
  revalidatePath("/flags");
  revalidatePath("/approvals");
  return toActionResult(result);
}

export async function turnOffFlagAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const stateId = formData.get("stateId");
  const reason = formData.get("reason");
  if (typeof stateId !== "string" || typeof reason !== "string") {
    return { ok: false, message: "Invalid form submission" };
  }
  const state = await db.featureFlagState.findUnique({
    where: { id: stateId },
    select: { environment: true },
  });
  if (!state) {
    await requirePermission("flags.view");
    return { ok: false, message: "Flag not found" };
  }
  const actor = await requirePermission(
    flagTurnOffPermission(state.environment),
    flagEntity(stateId),
  );

  const result = await turnOffFlag(actor, { stateId, reason });
  revalidatePath("/flags");
  return toActionResult(result);
}
