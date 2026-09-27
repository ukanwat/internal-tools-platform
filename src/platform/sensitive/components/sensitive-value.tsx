"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";

import { revealSensitiveField } from "../actions";
import type { SensitiveView } from "../types";

/** Shows the mask; lets permitted users reveal the value with a reason (audited). */
export function SensitiveValue({ view }: { view: SensitiveView }) {
  const [state, action, pending] = useActionState(revealSensitiveField, null);
  const [open, setOpen] = useState(false);

  if (view.masked == null)
    return <span className="text-muted-foreground">—</span>;
  if (state?.ok) return <span className="font-mono">{state.value}</span>;

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <span className="font-mono" aria-label={`${view.label} (masked)`}>
          {view.masked}
        </span>
        {view.canReveal && !open && (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            Reveal
          </Button>
        )}
      </span>
      {open && (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="field" value={view.field} />
          <input type="hidden" name="entityType" value={view.entity.type} />
          <input type="hidden" name="entityId" value={view.entity.id} />
          <input
            name="reason"
            required
            aria-label={`Reason for viewing ${view.label.toLowerCase()}`}
            placeholder="Why do you need to see this?"
            className="border-input bg-background h-7 rounded-md border px-2 text-sm"
          />
          <Button type="submit" size="xs" disabled={pending}>
            Show
          </Button>
        </form>
      )}
      {state && !state.ok && (
        <span role="alert" className="text-destructive text-xs">
          {state.error}
        </span>
      )}
    </span>
  );
}
