"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/platform/permissions/guard";

import {
  approveApprovalRequest,
  getApprovalDecidePermission,
  rejectApprovalRequest,
} from "./service";

export type DecisionState = { ok: boolean; message: string } | null;

export async function decideApproval(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const requestId = formData.get("requestId");
  const decision = formData.get("decision");
  const reason = formData.get("reason");
  if (
    typeof requestId !== "string" ||
    typeof reason !== "string" ||
    (decision !== "approve" && decision !== "reject")
  ) {
    return { ok: false, message: "Invalid form submission" };
  }

  const permission = await getApprovalDecidePermission(requestId);
  if (!permission) return { ok: false, message: "Request not found" };
  const actor = await requirePermission(permission, {
    type: "ApprovalRequest",
    id: requestId,
  });

  const result =
    decision === "approve"
      ? await approveApprovalRequest(actor, requestId, reason)
      : await rejectApprovalRequest(actor, requestId, reason);

  revalidatePath("/approvals");
  if (!result.ok) return { ok: false, message: result.error };
  return {
    ok: true,
    message: decision === "approve" ? "Approved and processed" : "Rejected",
  };
}
