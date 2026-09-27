import type { Role } from "./roles";

export const PERMISSIONS = [
  "refunds.view",
  "refunds.request",
  "refunds.approve",
  "kyc.view",
  "kyc.review",
  "kyc.decide",
  "audit.view",
  "pii.reveal_account_number",
  "pii.reveal_id_number",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** The single source of truth for what each role may do. */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPPORT: ["refunds.view", "refunds.request", "kyc.view"],
  FINANCE_APPROVER: [
    "refunds.view",
    "refunds.approve",
    "pii.reveal_account_number",
  ],
  COMPLIANCE_REVIEWER: ["kyc.view", "kyc.review", "pii.reveal_id_number"],
  COMPLIANCE_LEAD: [
    "kyc.view",
    "kyc.review",
    "kyc.decide",
    "audit.view",
    "pii.reveal_account_number",
    "pii.reveal_id_number",
  ],
  ADMIN: ["audit.view"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
