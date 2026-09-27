import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type FilterField = {
  /** Query-string parameter name. */
  name: string;
  label: string;
  /** Label for the "no filter" option. */
  anyLabel: string;
  options: { value: string; label: string }[];
  value?: string;
};

type Props = {
  basePath: string;
  fields: FilterField[];
};

const selectClassName =
  "h-8 rounded-lg border border-input bg-background px-2 text-sm";

/**
 * Plain GET form so filters live in the URL and work without JS.
 * Render it with a `key` derived from the current filters so Clear resets it.
 */
export function FilterBar({ basePath, fields }: Props) {
  return (
    <form
      method="get"
      action={basePath}
      className="flex flex-wrap items-end gap-4"
    >
      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <Label htmlFor={`filter-${field.name}`}>{field.label}</Label>
          <select
            id={`filter-${field.name}`}
            name={field.name}
            defaultValue={field.value ?? ""}
            className={selectClassName}
          >
            <option value="">{field.anyLabel}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
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
