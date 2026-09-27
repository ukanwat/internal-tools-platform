import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/platform/permissions/roles";

type Props = {
  basePath: string;
  actors: { id: string; name: string; role: Role }[];
  actions: string[];
  selected: { actorId?: string; action?: string; outcome?: string };
};

const selectClassName =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm";

/** Plain GET form so filters live in the URL and work without JS. */
export function AuditFilters({ basePath, actors, actions, selected }: Props) {
  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-4"
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-actor">Person</Label>
        <select
          id="filter-actor"
          name="actor"
          defaultValue={selected.actorId ?? ""}
          className={selectClassName}
        >
          <option value="">Anyone</option>
          {actors.map((actor) => (
            <option key={actor.id} value={actor.id}>
              {actor.name} ({ROLE_LABELS[actor.role]})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-action">Action</Label>
        <select
          id="filter-action"
          name="action"
          defaultValue={selected.action ?? ""}
          className={selectClassName}
        >
          <option value="">Any action</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="filter-outcome">Outcome</Label>
        <select
          id="filter-outcome"
          name="outcome"
          defaultValue={selected.outcome ?? ""}
          className={selectClassName}
        >
          <option value="">Any outcome</option>
          <option value="SUCCESS">Success</option>
          <option value="DENIED">Denied</option>
        </select>
      </div>
      <Button type="submit" size="sm">
        Apply
      </Button>
      <Link
        href={basePath}
        className="text-muted-foreground text-sm underline-offset-4 hover:underline"
      >
        Clear
      </Link>
    </form>
  );
}
