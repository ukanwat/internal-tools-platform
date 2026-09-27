import { db } from "@/platform/db";
import { hasPermission } from "@/platform/permissions/policy";
import type { SensitiveSource } from "@/platform/sensitive/sources";

/** Loads an order's account number for people who can see refunds. */
export const orderSensitiveSource: SensitiveSource = {
  entityType: "Order",
  async load(id, field, actor) {
    if (field !== "accountNumber" || !hasPermission(actor.role, "refunds.view"))
      return null;
    const order = await db.order.findUnique({
      where: { id },
      select: { accountNumber: true },
    });
    return order?.accountNumber ?? null;
  },
};
