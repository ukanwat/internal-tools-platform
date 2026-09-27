import { CheckIcon, XIcon } from "lucide-react";

import { ReasonDialog } from "@/platform/ui";

import { submitKycDecision } from "../actions";

export function KycDecisionButtons({
  caseId,
  customerName,
  leadApprovalRequired,
  canApprove,
}: {
  caseId: string;
  customerName: string;
  leadApprovalRequired: boolean;
  /** False while the vendor's check results can't be loaded. */
  canApprove: boolean;
}) {
  const followUp = leadApprovalRequired
    ? "This case needs a compliance lead's approval, so it will be sent to them. You can't approve it yourself."
    : "This decides the case straight away.";
  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && (
        <ReasonDialog
          action={submitKycDecision}
          fields={{ caseId, decision: "approve" }}
          trigger={
            <>
              <CheckIcon />
              Approve
            </>
          }
          title={`Approve ${customerName}`}
          description={followUp}
          confirmLabel={leadApprovalRequired ? "Send for approval" : "Approve"}
        />
      )}
      <ReasonDialog
        action={submitKycDecision}
        fields={{ caseId, decision: "reject" }}
        trigger={
          <>
            <XIcon />
            Reject
          </>
        }
        triggerVariant="outline"
        title={`Reject ${customerName}`}
        description={followUp}
        confirmLabel={leadApprovalRequired ? "Send for approval" : "Reject"}
        confirmVariant="destructive"
      />
    </div>
  );
}
