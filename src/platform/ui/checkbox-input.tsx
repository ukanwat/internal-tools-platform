"use client";

import { cn } from "cn";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** A shadcn checkbox that submits `name=1` with a plain form when checked. */
export function CheckboxInput({
  id,
  name,
  label,
  defaultChecked,
  onCheckedChange,
  className,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox
        id={id}
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        onCheckedChange={(checked) => onCheckedChange?.(checked)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
