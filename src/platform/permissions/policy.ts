import type { Role } from "./roles";

export const PERMISSIONS = [
  "refunds.view",
  "refunds.request",
  "refunds.approve",
  "kyc.view",
  "kyc.review",
  "kyc.decide",
  "audit.view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** The single source of truth for what each role may do. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPPORT: ["refunds.view", "refunds.request", "kyc.view"],
  FINANCE_APPROVER: ["refunds.view", "refunds.approve"],
  COMPLIANCE_REVIEWER: ["kyc.view", "kyc.review"],
  COMPLIANCE_LEAD: ["kyc.view", "kyc.review", "kyc.decide", "audit.view"],
  ADMIN: ["audit.view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
