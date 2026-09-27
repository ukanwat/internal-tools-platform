import type { Permission } from "@/platform/permissions/policy";
import { ROLE_LABELS, type Role } from "@/platform/permissions/roles";

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
  "flags.view": "View feature flags",
  "flags.change_staging": "Change a staging feature flag",
  "flags.reduce_production": "Turn off or scale back a production feature flag",
  "flags.request_production": "Request a production feature flag change",
  "flags.approve_production": "Approve a production feature flag change",
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
  "flags.change": "Changed a feature flag",
  "flags.turn_off": "Turned off a feature flag",
  "refunds.create": "Refund requested",
  "refunds.paid": "Refund paid",
  "refunds.payment_failed": "Refund payment failed",
  "attachments.upload": "Uploaded a file",
  "attachments.download": "Downloaded a file",
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
  FeatureFlagState: "Feature flag",
};

export function describeEntityType(type: string): string {
  if (Object.hasOwn(ENTITY_TYPES, type)) return ENTITY_TYPES[type];
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

const REQUEST_STATUSES: Record<string, string> = {
  PENDING: "pending",
  PROCESSING: "being processed",
  OUTCOME_UNKNOWN: "waiting for its outcome",
  COMPLETED: "completed",
  REJECTED: "rejected",
};

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function formatDuration(seconds: number) {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
}

const REASONS: [RegExp, (...groups: string[]) => string][] = [
  [
    /^Role (\w+) lacks permission ([\w.]+)$/,
    (role, permission) =>
      `${Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role as Role] : role} users aren't allowed to ${lowerFirst(describeAction(permission))}.`,
  ],
  [
    /^Not signed in; ([\w.]+) requires a session$/,
    (permission) =>
      `Someone who wasn't signed in tried to ${lowerFirst(describeAction(permission))}.`,
  ],
  [
    /^Not signed in; downloads require a session$/,
    () => "Someone who wasn't signed in tried to download a file.",
  ],
  [
    /^\w+ policy does not allow uploads on this record$/,
    () => "This person isn't allowed to add files to this record.",
  ],
  [
    /^\w+ policy does not allow viewing this record's files$/,
    () => "This person isn't allowed to see this record's files.",
  ],
  [
    /^Stored file does not match its checksum$/,
    () => "The stored file changed after upload, so it wasn't served.",
  ],
  [
    /^Stored file is missing$/,
    () => "The stored file is missing, so it couldn't be served.",
  ],
  [
    /^Cannot decide your own request$/,
    () => "People can't approve or reject their own requests.",
  ],
  [
    /^Request is (\w+), not PENDING$/,
    (status) =>
      `The request was already ${REQUEST_STATUSES[status] ?? lowerFirst(status)}, so it couldn't be decided.`,
  ],
  [
    /^Request was decided concurrently$/,
    () => "Someone else decided this request at the same moment.",
  ],
  [
    /^Unknown approval type (.+)$/,
    (type) => `No tool handles "${type}" requests any more.`,
  ],
  [
    /^Timed out after (\d+)s in processing$/,
    (seconds) =>
      `Processing took longer than ${formatDuration(Number(seconds))}, so the outcome is unknown.`,
  ],
];

/** Rewrites the platform's own reason codes in plain English; people's own words pass through. */
export function describeReason(reason: string): string {
  for (const [pattern, describe] of REASONS) {
    const match = pattern.exec(reason);
    if (match) return describe(...match.slice(1));
  }
  return reason;
}
