import { describe, expect, it } from "vitest";

import { Role } from "@/generated/prisma/enums";

import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "./policy";
import { ROLE_LABELS } from "./roles";

describe("role policy", () => {
  it("covers every role", () => {
    for (const role of Object.values(Role)) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      expect(ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it("only grants known permissions", () => {
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      for (const p of perms) expect(PERMISSIONS).toContain(p);
    }
  });

  it("separates requesting and approving refunds", () => {
    expect(hasPermission("SUPPORT", "refunds.request")).toBe(true);
    expect(hasPermission("SUPPORT", "refunds.approve")).toBe(false);
    expect(hasPermission("FINANCE_APPROVER", "refunds.approve")).toBe(true);
    expect(hasPermission("FINANCE_APPROVER", "refunds.request")).toBe(false);
  });

  it("limits audit log access to compliance lead and admin", () => {
    const withAudit = Object.values(Role).filter((r) =>
      hasPermission(r, "audit.view"),
    );
    expect(withAudit.sort()).toEqual(["ADMIN", "COMPLIANCE_LEAD"]);
  });

  it("keeps KYC away from everyone but compliance", () => {
    for (const permission of [
      "kyc.view",
      "kyc.review",
      "pii.reveal_id_number",
    ] as const) {
      const roles = Object.values(Role).filter((r) =>
        hasPermission(r, permission),
      );
      expect(roles.sort()).toEqual(["COMPLIANCE_LEAD", "COMPLIANCE_REVIEWER"]);
    }
  });

  it("only lets the compliance lead sign off KYC decisions", () => {
    const deciders = Object.values(Role).filter((r) =>
      hasPermission(r, "kyc.decide"),
    );
    expect(deciders).toEqual(["COMPLIANCE_LEAD"]);
  });
});
