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

  it("finds a refund by idempotency key", async () => {
    const payments = createMockPaymentsClient();
    expect(await payments.findRefund("req_1")).toBeNull();
    const { refundId } = await payments.refund(input);
    expect(await payments.findRefund("req_1")).toEqual({ refundId });
  });

  it("returns the original refund to concurrent calls with the same key", async () => {
    const payments = createMockPaymentsClient();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => payments.refund(input)),
    );
    expect(new Set(results.map((r) => r.refundId)).size).toBe(1);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
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
