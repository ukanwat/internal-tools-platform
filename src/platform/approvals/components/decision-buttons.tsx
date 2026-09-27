import { CheckIcon, XIcon } from "lucide-react";

import { ReasonDialog } from "@/platform/ui/reason-dialog";

import { decideApproval } from "../actions";

export function DecisionButtons({
  requestId,
  summary,
}: {
  requestId: string;
  summary: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonDialog
        action={decideApproval}
        fields={{ requestId, decision: "approve" }}
        trigger={
          <>
            <CheckIcon />
            Approve
          </>
        }
        title="Approve request"
        description={`${summary}. Approving runs it straight away.`}
        confirmLabel="Approve"
      />
      <ReasonDialog
        action={decideApproval}
        fields={{ requestId, decision: "reject" }}
        trigger={
          <>
            <XIcon />
            Reject
          </>
        }
        triggerVariant="outline"
        title="Reject request"
        description={`${summary}. The requester will see your reason.`}
        confirmLabel="Reject"
        confirmVariant="destructive"
      />
    </div>
  );
}
