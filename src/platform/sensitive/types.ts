import type { SensitiveField } from "./fields";

export type SensitiveEntity = { type: string; id: string };

/** What the browser gets: never the raw value. */
export type SensitiveView = {
  field: SensitiveField;
  label: string;
  entity: SensitiveEntity;
  masked: string | null;
  canReveal: boolean;
};
