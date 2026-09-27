"use server";

import { revalidatePath } from "next/cache";

import { refundApprovalThresholdMinor } from "@/platform/config";
import { requirePermission } from "@/platform/permissions/guard";
import type { ActionResult } from "@/platform/ui/reason-dialog";

import { formatMoney, parseAmountMinor } from "./money";
import { requestRefund } from "./service";

export async function requestRefundAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const orderId = formData.get("orderId");
  const amount = formData.get("amount");
  const reason = formData.get("reason");
  if (
    typeof orderId !== "string" ||
    typeof amount !== "string" ||
    typeof reason !== "string"
  ) {
    return { ok: false, message: "Invalid form submission" };
  }
  const actor = await requirePermission("refunds.request", {
    type: "Order",
    id: orderId,
  });

  const amountMinor = parseAmountMinor(amount);
  if (amountMinor === null) {
    return { ok: false, message: "Enter an amount like 25.00" };
  }

  const result = await requestRefund(actor, { orderId, amountMinor, reason });
  revalidatePath("/refunds", "layout");
  revalidatePath("/approvals");
  if (!result.ok) return { ok: false, message: result.error };

  const money = formatMoney(result.refund.amountMinor, result.refund.currency);
  switch (result.outcome) {
    case "paid":
      return { ok: true, message: `Refund of ${money} paid` };
    case "awaiting_approval":
      return {
        ok: true,
        message: `Refund of ${money} sent to finance for approval (over ${formatMoney(refundApprovalThresholdMinor(), "USD")})`,
      };
    case "processing":
      return {
        ok: true,
        message: `Refund of ${money} sent. Waiting for the payments provider to confirm it.`,
      };
    case "failed":
      return {
        ok: false,
        message:
          "The payments provider didn't accept this refund. Nothing was paid.",
      };
  }
}
