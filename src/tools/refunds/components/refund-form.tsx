"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { TextareaField, TextField } from "@/platform/ui/form-fields";
import type { ActionResult } from "@/platform/ui/reason-dialog";
import { toast } from "@/platform/ui/toast";

import { requestRefundAction } from "../actions";

type Props = {
  orderId: string;
  currency: string;
  remainingLabel: string;
  thresholdLabel: string;
};

export function RefundForm({
  orderId,
  currency,
  remainingLabel,
  thresholdLabel,
}: Props) {
  const id = useId();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await requestRefundAction(prev, formData);
      if (result?.ok) {
        toast.success(result.message);
        setAmount("");
        setReason("");
      } else if (result) {
        toast.error(result.message);
      }
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <FieldGroup>
        <TextField
          id={`${id}-amount`}
          name="amount"
          label={`Amount (${currency})`}
          inputMode="decimal"
          placeholder="0.00"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          description={`Up to ${remainingLabel}. Refunds over ${thresholdLabel} go to finance for approval; smaller ones are paid straight away.`}
        />
        <TextareaField
          id={`${id}-reason`}
          name="reason"
          label="Reason"
          placeholder="Why is the customer being refunded? This is saved to the audit log."
          required
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={state && !state.ok ? state.message : undefined}
        />
      </FieldGroup>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : "Refund"}
        </Button>
      </div>
    </form>
  );
}
