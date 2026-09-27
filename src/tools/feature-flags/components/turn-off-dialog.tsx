import { PowerOffIcon } from "lucide-react";

import type { FlagEnvironment } from "@/generated/prisma/enums";
import { ReasonDialog } from "@/platform/ui/reason-dialog";

import { turnOffFlagAction } from "../actions";
import { ENVIRONMENT_LABELS } from "../rules";

export function TurnOffDialog({
  stateId,
  flagKey,
  environment,
}: {
  stateId: string;
  flagKey: string;
  environment: FlagEnvironment;
}) {
  return (
    <ReasonDialog
      action={turnOffFlagAction}
      fields={{ stateId }}
      trigger={
        <>
          <PowerOffIcon />
          Turn off
        </>
      }
      triggerVariant="destructive"
      title={`Turn off ${flagKey} in ${ENVIRONMENT_LABELS[environment].toLowerCase()}`}
      description="Takes effect straight away with no approval. Pending requests for this flag can no longer be applied."
      confirmLabel="Turn off now"
      confirmVariant="destructive"
      reasonPlaceholder="e.g. INC-123: checkout errors spiking"
    />
  );
}
