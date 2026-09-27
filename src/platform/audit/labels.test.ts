import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/platform/permissions/policy";

import { describeAction, describeEntityType, describeReason } from "./labels";

describe("describeAction", () => {
  it("has a plain-English label for every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(describeAction(permission)).not.toContain(".");
    }
  });

  it("labels known platform actions", () => {
    expect(describeAction("auth.sign_in")).toBe("Signed in");
    expect(describeAction("sensitive.reveal")).toBe("Revealed sensitive data");
  });

  it("falls back to readable words", () => {
    expect(describeAction("kyc.case_opened")).toBe("Kyc case opened");
    expect(describeAction("toString")).toBe("ToString");
  });
});

describe("describeEntityType", () => {
  it("splits unknown types into words", () => {
    expect(describeEntityType("ApprovalRequest")).toBe("Approval request");
    expect(describeEntityType("KycCase")).toBe("Kyc Case");
  });
});

describe("describeReason", () => {
  it.each([
    [
      "Role SUPPORT lacks permission audit.view",
      "Support users aren't allowed to view the audit log.",
    ],
    [
      "Not signed in; audit.view requires a session",
      "Someone who wasn't signed in tried to view the audit log.",
    ],
    [
      "Cannot decide your own request",
      "People can't approve or reject their own requests.",
    ],
    [
      "Request is COMPLETED, not PENDING",
      "The request was already completed, so it couldn't be decided.",
    ],
    [
      "Timed out after 300s in processing",
      "Processing took longer than 5 minutes, so the outcome is unknown.",
    ],
  ])("rewrites %j", (reason, expected) => {
    expect(describeReason(reason)).toBe(expected);
  });

  it("leaves people's own reasons alone", () => {
    expect(describeReason("Customer was double charged")).toBe(
      "Customer was double charged",
    );
  });
});
