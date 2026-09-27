import type { Role } from "@/generated/prisma/enums";
import { AuditOutcome } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/platform/permissions/roles";
import { AUDIT_OUTCOME_LABELS, FilterBar } from "@/platform/ui";

type Props = {
  basePath: string;
  actors: { id: string; name: string; role: Role }[];
  actions: string[];
  selected: { actorId?: string; action?: string; outcome?: string };
};

export function AuditFilters({ basePath, actors, actions, selected }: Props) {
  return (
    <FilterBar
      basePath={basePath}
      fields={[
        {
          name: "actor",
          label: "Person",
          anyLabel: "Anyone",
          value: selected.actorId,
          options: actors.map((actor) => ({
            value: actor.id,
            label: `${actor.name} (${ROLE_LABELS[actor.role]})`,
          })),
        },
        {
          name: "action",
          label: "Action",
          anyLabel: "Any action",
          value: selected.action,
          options: actions.map((action) => ({ value: action, label: action })),
        },
        {
          name: "outcome",
          label: "Outcome",
          anyLabel: "Any outcome",
          value: selected.outcome,
          options: Object.values(AuditOutcome).map((outcome) => ({
            value: outcome,
            label: AUDIT_OUTCOME_LABELS[outcome],
          })),
        },
      ]}
    />
  );
}
