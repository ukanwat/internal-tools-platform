const DEFAULT_APPROVAL_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
/** Largest delay setTimeout supports (~24.8 days). */
const MAX_TIMER_MS = 2 ** 31 - 1;

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, MAX_TIMER_MS)
    : fallback;
}

/** How long an approved request may stay PROCESSING before it counts as failed. */
export function approvalProcessingTimeoutMs(): number {
  return positiveInt(
    process.env.APPROVAL_PROCESSING_TIMEOUT_MS,
    DEFAULT_APPROVAL_PROCESSING_TIMEOUT_MS,
  );
}

/** Where uploaded attachments are stored on local disk. */
export function attachmentsStorageDir(): string {
  return process.env.ATTACHMENTS_STORAGE_DIR || ".data/attachments";
}

const DEFAULT_KYC_VENDOR_DASHBOARD_URL = "https://kyc-vendor.example.com";

/** Base URL of the KYC vendor's dashboard, where reviewers open ID documents. */
export function kycVendorDashboardUrl(): string {
  const value = process.env.KYC_VENDOR_DASHBOARD_URL;
  if (!value) return DEFAULT_KYC_VENDOR_DASHBOARD_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return DEFAULT_KYC_VENDOR_DASHBOARD_URL;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_KYC_VENDOR_DASHBOARD_URL;
  }
}

const KYC_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
const DEFAULT_KYC_LEAD_APPROVAL_RISK_LEVELS = ["HIGH"] as const;

/**
 * Risk levels whose KYC decisions need a compliance lead's sign-off. A
 * comma-separated list; HIGH always needs sign-off, whatever the setting.
 */
export function kycLeadApprovalRiskLevels(): readonly (typeof KYC_RISK_LEVELS)[number][] {
  const configured = (process.env.KYC_LEAD_APPROVAL_RISK_LEVELS ?? "")
    .split(",")
    .map((level) => level.trim().toUpperCase());
  return KYC_RISK_LEVELS.filter(
    (level) =>
      DEFAULT_KYC_LEAD_APPROVAL_RISK_LEVELS.some((d) => d === level) ||
      configured.includes(level),
  );
}
