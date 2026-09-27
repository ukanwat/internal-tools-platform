"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/platform/permissions/guard";
import type { ActionResult } from "@/platform/ui/reason-dialog";

import { kycEntity } from "./cases";
import { decideKycCase } from "./service";

export async function submitKycDecision(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const caseId = formData.get("caseId");
  const decision = formData.get("decision");
  const reason = formData.get("reason");
  if (
    typeof caseId !== "string" ||
    typeof reason !== "string" ||
    (decision !== "approve" && decision !== "reject")
  ) {
    return { ok: false, message: "Invalid form submission" };
  }
  const actor = await requirePermission("kyc.review", kycEntity(caseId));
  const result = await decideKycCase(actor, { caseId, decision, reason });
  revalidatePath("/kyc");
  revalidatePath(`/kyc/${caseId}`);
  revalidatePath("/approvals");
  return result;
}
