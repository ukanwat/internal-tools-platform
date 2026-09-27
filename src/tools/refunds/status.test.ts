import { describe, expect, it } from "vitest";

import {
  parseRefundState,
  refundState,
  releasesAmount,
  statusesFor,
} from "./status";

describe("refundState", () => {
  it("takes the approval's status when there is one", () => {
    expect(refundState(null, "PENDING")).toBe("AWAITING_APPROVAL");
    expect(refundState(null, "OUTCOME_UNKNOWN")).toBe("PROCESSING");
    expect(refundState(null, "COMPLETED")).toBe("PAID");
    expect(refundState(null, "REJECTED")).toBe("REJECTED");
  });

  it("uses the refund's own status when paid directly", () => {
    expect(refundState("PAID", null)).toBe("PAID");
    expect(refundState("FAILED", null)).toBe("FAILED");
  });
});

describe("statusesFor", () => {
  it("maps each state back to the statuses it covers", () => {
    expect(statusesFor("PROCESSING")).toEqual({
      direct: ["PROCESSING"],
      approval: ["PROCESSING", "OUTCOME_UNKNOWN"],
    });
    expect(statusesFor("REJECTED")).toEqual({
      direct: [],
      approval: ["REJECTED"],
    });
  });
});

it("only failed and rejected refunds free up the amount", () => {
  expect(releasesAmount("FAILED")).toBe(true);
  expect(releasesAmount("REJECTED")).toBe(true);
  expect(releasesAmount("AWAITING_APPROVAL")).toBe(false);
  expect(releasesAmount("PAID")).toBe(false);
});

it("parses the state filter", () => {
  expect(parseRefundState("PAID")).toBe("PAID");
  expect(parseRefundState("nope")).toBeUndefined();
});
