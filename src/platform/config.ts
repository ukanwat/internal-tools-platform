const DEFAULT_APPROVAL_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** How long an approved request may stay PROCESSING before it counts as failed. */
export function approvalProcessingTimeoutMs(): number {
  return positiveInt(
    process.env.APPROVAL_PROCESSING_TIMEOUT_MS,
    DEFAULT_APPROVAL_PROCESSING_TIMEOUT_MS,
  );
}
