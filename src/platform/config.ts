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

const DEFAULT_REFUND_APPROVAL_THRESHOLD_USD = 500;

/**
 * Refunds above this amount, in US cents, need finance approval; refunds at or
 * under it are paid straight away. Set in whole or fractional dollars.
 */
export function refundApprovalThresholdMinor(): number {
  const value = process.env.REFUND_APPROVAL_THRESHOLD_USD?.trim();
  const dollars =
    value && /^\d+(\.\d{1,2})?$/.test(value)
      ? Number(value)
      : DEFAULT_REFUND_APPROVAL_THRESHOLD_USD;
  return Math.round(dollars * 100);
}

/** Where uploaded attachments are stored on local disk. */
export function attachmentsStorageDir(): string {
  return process.env.ATTACHMENTS_STORAGE_DIR || ".data/attachments";
}
