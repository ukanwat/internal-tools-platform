import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

/** Coloured badge for a record's status. Pick tones by meaning, not by look. */
export function StatusBadge({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <Badge className={TONE_CLASSES[tone]} data-tone={tone}>
      {children}
    </Badge>
  );
}
