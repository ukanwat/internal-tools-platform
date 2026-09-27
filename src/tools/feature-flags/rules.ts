import type { FlagEnvironment } from "@/generated/prisma/enums";
import type { Permission } from "@/platform/permissions/policy";

export type FlagSetting = { enabled: boolean; rolloutPercent: number };

/**
 * - `unchanged`: nothing to do.
 * - `apply`: takes effect straight away.
 * - `approval`: needs an eng manager other than the requester.
 */
export type FlagChangeKind = "unchanged" | "apply" | "approval";

export const ENVIRONMENT_LABELS: Record<FlagEnvironment, string> = {
  STAGING: "Staging",
  PRODUCTION: "Production",
};

/**
 * Staging changes always apply straight away. In production, anything that
 * exposes more traffic (turning on, raising the rollout) needs approval;
 * turning off or scaling back applies straight away so it can be used as a
 * kill switch.
 */
export function classifyFlagChange(
  environment: FlagEnvironment,
  from: FlagSetting,
  to: FlagSetting,
): FlagChangeKind {
  if (
    from.enabled === to.enabled &&
    from.rolloutPercent === to.rolloutPercent
  ) {
    return "unchanged";
  }
  if (environment === "STAGING") return "apply";
  const turningOn = to.enabled && !from.enabled;
  const raisingRollout = to.rolloutPercent > from.rolloutPercent;
  return turningOn || raisingRollout ? "approval" : "apply";
}

/** The permission needed to make a change of this kind. */
export function flagChangePermission(
  environment: FlagEnvironment,
  kind: Exclude<FlagChangeKind, "unchanged">,
): Permission {
  if (environment === "STAGING") return "flags.change_staging";
  return kind === "approval"
    ? "flags.request_production"
    : "flags.reduce_production";
}

export function parseRolloutPercent(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value.trim());
  return parsed <= 100 ? parsed : null;
}

export function describeSetting({ enabled, rolloutPercent }: FlagSetting) {
  return enabled ? `on at ${rolloutPercent}%` : `off (${rolloutPercent}%)`;
}
