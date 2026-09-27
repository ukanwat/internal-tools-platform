import { describe, expect, it } from "vitest";

import { testRefundType } from "../../../test/approvals";

import { createApprovalRegistry } from "./registry";

describe("approval registry", () => {
  it("looks types up by key", () => {
    const registry = createApprovalRegistry([testRefundType]);
    expect(registry.get("test.refund")).toBe(testRefundType);
    expect(registry.get("nope")).toBeUndefined();
    expect(registry.list()).toEqual([testRefundType]);
  });

  it("rejects duplicate keys", () => {
    expect(() =>
      createApprovalRegistry([testRefundType, testRefundType]),
    ).toThrow(/Duplicate approval type: test.refund/);
  });

  it("parses and describes payloads through prepare", () => {
    expect(
      testRefundType.prepare({
        paymentId: "pay_1",
        amountMinor: 1250,
        currency: "USD",
      }),
    ).toEqual({
      payload: { paymentId: "pay_1", amountMinor: 1250, currency: "USD" },
      summary: "Refund 12.50 USD on pay_1",
      entity: { type: "Payment", id: "pay_1" },
    });
    expect(() => testRefundType.prepare({ paymentId: "pay_1" })).toThrow();
  });
});
