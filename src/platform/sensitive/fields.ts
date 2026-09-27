import type { Permission } from "@/platform/permissions/policy";

export type SensitiveFieldDefinition = {
  label: string;
  /** Roles with this permission may reveal the value, with a reason. Everyone else only sees the mask. */
  revealPermission: Permission;
};

/**
 * Every sensitive field, keyed by the property name tools use for it.
 * Any property with one of these names is masked in audit before/after snapshots.
 */
export const SENSITIVE_FIELDS = {
  accountNumber: {
    label: "Account number",
    revealPermission: "pii.reveal_account_number",
  },
  idNumber: {
    label: "ID number",
    revealPermission: "pii.reveal_id_number",
  },
} as const satisfies Record<string, SensitiveFieldDefinition>;

export type SensitiveField = keyof typeof SENSITIVE_FIELDS;

export function isSensitiveField(name: string): name is SensitiveField {
  return Object.hasOwn(SENSITIVE_FIELDS, name);
}

const VISIBLE_SUFFIX = 4;

/** `GB29NWBK60161331926819` → `••••6819`. Short values are fully masked. */
export function maskValue(value: string): string {
  const visible =
    value.length > VISIBLE_SUFFIX * 2 ? value.slice(-VISIBLE_SUFFIX) : "";
  return `••••${visible}`;
}

/** Deep copy with every sensitive property masked. Safe for anything persisted or logged. */
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      isSensitiveField(key) && inner != null
        ? maskValue(String(inner))
        : redactSensitive(inner),
    ]),
  );
}
