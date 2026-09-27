import type { Permission } from "@/platform/permissions/policy";

/** Plain-English labels for permission checks; denials are logged under the permission. */
const PERMISSION_ACTIONS: Record<Permission, string> = {
  "refunds.view": "View refunds",
  "refunds.request": "Request a refund",
  "refunds.approve": "Approve a refund",
  "kyc.view": "View KYC cases",
  "kyc.review": "Review a KYC case",
  "kyc.decide": "Decide a KYC case",
  "audit.view": "View the audit log",
  "pii.reveal_account_number": "Reveal an account number",
  "pii.reveal_id_number": "Reveal an ID number",
};

const ACTIONS: Record<string, string> = {
  ...PERMISSION_ACTIONS,
  "auth.sign_in": "Signed in",
  "auth.sign_out": "Signed out",
  "approvals.request": "Requested approval",
  "approvals.approve": "Approved a request",
  "approvals.reject": "Rejected a request",
  "approvals.complete": "Request completed",
  "approvals.fail": "Request processing failed",
  "approvals.outcome_unknown": "Request outcome unknown",
  "sensitive.reveal": "Revealed sensitive data",
};

/** Actions hidden from the audit log unless asked for. */
export const SIGN_IN_ACTIONS = ["auth.sign_in", "auth.sign_out"];

export function describeAction(action: string): string {
  if (Object.hasOwn(ACTIONS, action)) return ACTIONS[action];
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ENTITY_TYPES: Record<string, string> = {
  ApprovalRequest: "Approval request",
  User: "Person",
};

export function describeEntityType(type: string): string {
  if (Object.hasOwn(ENTITY_TYPES, type)) return ENTITY_TYPES[type];
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}
