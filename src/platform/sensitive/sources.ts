import type { CurrentUser } from "@/platform/auth/types";
import { kycCaseSensitiveSource } from "@/tools/kyc/sensitive-source";

import type { SensitiveField } from "./fields";

/**
 * How the platform loads a record's raw sensitive value when someone reveals it.
 * `load` must return null when `actor` may not access the record.
 */
export type SensitiveSource = {
  entityType: string;
  load: (
    entityId: string,
    field: SensitiveField,
    actor: CurrentUser,
  ) => Promise<string | null>;
};

export type SensitiveSourceRegistry = {
  get(entityType: string): SensitiveSource | undefined;
};

export function createSensitiveSourceRegistry(
  sources: readonly SensitiveSource[],
): SensitiveSourceRegistry {
  const byType = new Map<string, SensitiveSource>();
  for (const source of sources) {
    if (byType.has(source.entityType)) {
      throw new Error(`Duplicate sensitive source: ${source.entityType}`);
    }
    byType.set(source.entityType, source);
  }
  return { get: (entityType) => byType.get(entityType) };
}

/** Tools add a source for each record type that holds sensitive fields. */
export const sensitiveSources = createSensitiveSourceRegistry([
  kycCaseSensitiveSource,
]);
