"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldChrome = {
  label: ReactNode;
  description?: ReactNode;
  error?: string;
};

function FieldFrame({
  id,
  label,
  description,
  error,
  children,
}: FieldChrome & { id: string; children: ReactNode }) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function TextField({
  id,
  label,
  description,
  error,
  ...props
}: FieldChrome & ComponentProps<typeof Input> & { id: string }) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <Input id={id} aria-invalid={error ? true : undefined} {...props} />
    </FieldFrame>
  );
}

export function TextareaField({
  id,
  label,
  description,
  error,
  ...props
}: FieldChrome & ComponentProps<typeof Textarea> & { id: string }) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <Textarea id={id} aria-invalid={error ? true : undefined} {...props} />
    </FieldFrame>
  );
}

export type SelectOption = { value: string; label: string };

export function SelectField({
  id,
  name,
  label,
  description,
  error,
  options,
  placeholder,
  defaultValue,
}: FieldChrome & {
  id: string;
  name: string;
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <FieldFrame id={id} label={label} description={description} error={error}>
      <SelectInput
        id={id}
        name={name}
        options={options}
        placeholder={placeholder}
        defaultValue={defaultValue}
        invalid={Boolean(error)}
      />
    </FieldFrame>
  );
}

/** A shadcn select that submits its value with a plain form. */
export function SelectInput({
  id,
  name,
  options,
  placeholder,
  defaultValue,
  invalid,
  className,
}: {
  id: string;
  name: string;
  options: SelectOption[];
  placeholder?: string;
  defaultValue?: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <Select
      name={name}
      items={options}
      defaultValue={defaultValue ?? options[0]?.value ?? null}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid ? true : undefined}
        className={className ?? "w-full"}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
