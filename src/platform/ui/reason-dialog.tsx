"use client";

import { useActionState, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

import { TextareaField } from "./form-fields";
import { toast } from "./toast";

/** What a form server action returns so the shared UI can report it. */
export type ActionResult = { ok: boolean; message: string } | null;

type Props = {
  /** Server action that receives the reason as `reason` plus `fields`. */
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  /** Hidden form values sent with the reason. */
  fields: Record<string, string>;
  trigger: ReactNode;
  triggerVariant?: "default" | "outline" | "destructive";
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Extra form fields shown above the reason. */
  children?: ReactNode;
};

/**
 * Confirmation dialog for actions that need a written reason. Shows the
 * result as a toast; stays open with the error if the action fails.
 */
export function ReasonDialog({
  action,
  fields,
  trigger,
  triggerVariant = "default",
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  reasonLabel = "Reason",
  reasonPlaceholder = "Explain your decision. This is saved to the audit log.",
  children,
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await action(prev, formData);
      if (result?.ok) {
        toast.success(result.message);
        setOpen(false);
        setReason("");
      } else if (result) {
        toast.error(result.message);
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size="sm" />}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <FieldGroup>
            {children}
            <TextareaField
              id={`${id}-reason`}
              name="reason"
              label={reasonLabel}
              placeholder={reasonPlaceholder}
              required
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoFocus
              error={state && !state.ok ? state.message : undefined}
            />
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" variant={confirmVariant} disabled={pending}>
              {pending ? "Working…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
