import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { CheckboxInput } from "./checkbox-input";
import { SelectInput } from "./form-fields";

export type FilterField = {
  /** Query-string parameter name. */
  name: string;
  label: string;
  /** Label for the "no filter" option. */
  anyLabel: string;
  options: { value: string; label: string }[];
  value?: string;
};

export type FilterToggle = {
  /** Query-string parameter name; sent as `name=1` when checked. */
  name: string;
  label: string;
  checked: boolean;
};

export type FilterSearch = {
  /** Query-string parameter name. */
  name: string;
  label: string;
  placeholder?: string;
  value?: string;
};

type Props = {
  basePath: string;
  search?: FilterSearch;
  fields?: FilterField[];
  toggles?: FilterToggle[];
};

/**
 * Plain GET form so filters live in the URL.
 * Render it with a `key` derived from the current filters so Clear resets it.
 */
export function FilterBar({
  basePath,
  search,
  fields = [],
  toggles = [],
}: Props) {
  return (
    <form
      method="get"
      action={basePath}
      className="bg-card grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      {search && (
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor={`filter-${search.name}`}>{search.label}</Label>
          <Input
            id={`filter-${search.name}`}
            name={search.name}
            type="search"
            placeholder={search.placeholder}
            defaultValue={search.value ?? ""}
          />
        </div>
      )}
      {fields.map((field) => (
        <div key={field.name} className="flex min-w-48 flex-col gap-2">
          <Label htmlFor={`filter-${field.name}`}>{field.label}</Label>
          <SelectInput
            id={`filter-${field.name}`}
            name={field.name}
            defaultValue={field.value ?? ""}
            options={[{ value: "", label: field.anyLabel }, ...field.options]}
          />
        </div>
      ))}
      {toggles.map((toggle) => (
        <CheckboxInput
          key={toggle.name}
          id={`filter-${toggle.name}`}
          name={toggle.name}
          label={toggle.label}
          defaultChecked={toggle.checked}
          className="lg:h-8"
        />
      ))}
      <div className="flex items-center gap-2 sm:col-span-2 lg:ml-auto">
        <Button type="submit">Apply filters</Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={basePath} />}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
