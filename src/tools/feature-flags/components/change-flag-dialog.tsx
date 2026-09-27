"use client";

import { PencilIcon } from "lucide-react";
import { useId, useState } from "react";

import type { FlagEnvironment } from "@/generated/prisma/enums";
import { CheckboxInput } from "@/platform/ui/checkbox-input";
import { TextField } from "@/platform/ui/form-fields";
import { ReasonDialog } from "@/platform/ui/reason-dialog";

import { changeFlagAction } from "../actions";
import {
  classifyFlagChange,
  ENVIRONMENT_LABELS,
  parseRolloutPercent,
  type FlagSetting,
} from "../rules";

const HINTS = {
  unchanged: "Change the setting above to continue.",
  apply: "This applies straight away.",
  approval:
    "Turning on or raising the rollout in production needs an eng manager other than you to approve.",
} as const;

function ChangeFields({
  environment,
  current,
}: {
  environment: FlagEnvironment;
  current: FlagSetting;
}) {
  const id = useId();
  const [enabled, setEnabled] = useState(current.enabled);
  const [rollout, setRollout] = useState(String(current.rolloutPercent));
  const parsed = parseRolloutPercent(rollout);
  const kind =
    parsed === null
      ? null
      : classifyFlagChange(environment, current, {
          enabled,
          rolloutPercent: parsed,
        });

  return (
    <>
      <CheckboxInput
        id={`${id}-enabled`}
        name="enabled"
        label="Flag is on"
        defaultChecked={current.enabled}
        onCheckedChange={setEnabled}
      />
      <TextField
        id={`${id}-rollout`}
        name="rolloutPercent"
        label="Rollout (%)"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        required
        value={rollout}
        onChange={(event) => setRollout(event.target.value)}
        description={kind ? HINTS[kind] : "Enter a whole number from 0 to 100."}
      />
    </>
  );
}

export function ChangeFlagDialog({
  stateId,
  version,
  flagKey,
  environment,
  current,
}: {
  stateId: string;
  version: number;
  flagKey: string;
  environment: FlagEnvironment;
  current: FlagSetting;
}) {
  return (
    <ReasonDialog
      action={changeFlagAction}
      fields={{ stateId, version: String(version) }}
      trigger={
        <>
          <PencilIcon />
          Change
        </>
      }
      triggerVariant="outline"
      title={`Change ${flagKey} in ${ENVIRONMENT_LABELS[environment].toLowerCase()}`}
      confirmLabel="Submit"
      reasonPlaceholder="Why are you making this change? This is saved to the audit log."
    >
      <ChangeFields environment={environment} current={current} />
    </ReasonDialog>
  );
}
