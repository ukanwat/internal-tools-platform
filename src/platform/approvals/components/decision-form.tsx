"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { decideApproval } from "../actions";

export function DecisionForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(decideApproval, null);
  const reasonId = `reason-${requestId}`;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <Label htmlFor={reasonId}>Reason</Label>
      <textarea
        id={reasonId}
        name="reason"
        required
        rows={2}
        className="border-input bg-background rounded-lg border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="approve"
          size="sm"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
      {state && (
        <p
          role="status"
          className={
            state.ok ? "text-sm text-emerald-700" : "text-destructive text-sm"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
