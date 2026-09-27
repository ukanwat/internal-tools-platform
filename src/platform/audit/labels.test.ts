import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/platform/permissions/policy";

import { describeAction, describeEntityType } from "./labels";

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
