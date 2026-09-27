import type { FeatureFlagState } from "@/generated/prisma/client";

export const FLAG_ENTITY_TYPE = "FeatureFlagState";

export const flagEntity = (stateId: string) => ({
  type: FLAG_ENTITY_TYPE,
  id: stateId,
});

export function flagSnapshot(state: FeatureFlagState, flagKey: string) {
  return {
    flagKey,
    environment: state.environment,
    enabled: state.enabled,
    rolloutPercent: state.rolloutPercent,
    version: state.version,
  };
}
