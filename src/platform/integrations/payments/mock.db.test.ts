import { describe, expect, it } from "vitest";

import { setupTestDatabase } from "../../../../test/db";

import { db } from "@/platform/db";

import { createMockPaymentsClient, MOCK_PAYMENT_IDS } from "./mock";

setupTestDatabase();

const input = {
  idempotencyKey: "req_1",
  paymentId: "pay_1",
  amountMinor: 500,
  currency: "USD",
};

describe("mock payments", () => {
  it("records a refund once per idempotency key", async () => {
    const payments = createMockPaymentsClient();
    const first = await payments.refund(input);
    const second = await payments.refund({ ...input, amountMinor: 999 });
    expect(first.replayed).toBe(false);
    expect(second).toEqual({ refundId: first.refundId, replayed: true });
    expect(await db.mockPayment.count()).toBe(1);
  });

  it("declines the decline test payment without recording it", async () => {
    await expect(
      createMockPaymentsClient().refund({
        ...input,
        paymentId: MOCK_PAYMENT_IDS.decline,
      }),
    ).rejects.toThrow(/declined/);
    expect(await db.mockPayment.count()).toBe(0);
  });
});
