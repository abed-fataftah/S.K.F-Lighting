"use client";

import type { ComponentProps, ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldError as FieldErrorValue } from "@/lib/form-errors";
import { useFieldErrorText } from "@/lib/use-field-error-text";

export const errorDomId = (id: string) => `${id}-error`;
const hintDomId = (id: string) => `${id}-hint`;

/** One labelled input of a settings card, with its hint and its error under it (design.md section 7). */
export function SettingsField({
  id,
  label,
  hint,
  error,
  className,
  ...input
}: Omit<ComponentProps<typeof Input>, "id"> & {
  readonly id: string;
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: FieldErrorValue;
}) {
  const errorText = useFieldErrorText();
  const describedBy = [hint ? hintDomId(id) : null, error ? errorDomId(id) : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint ? <FieldDescription id={hintDomId(id)}>{hint}</FieldDescription> : null}
      <FieldError id={errorDomId(id)}>{errorText(error)}</FieldError>
    </Field>
  );
}

/** The first field in `order` with an error gets focus, so the owner lands on what to fix. */
export function focusFirstError(
  root: HTMLElement | null,
  order: readonly string[],
  errors: Readonly<Record<string, unknown>>,
  idOf: (field: string) => string,
) {
  const first = order.find((field) => errors[field]);
  if (first) root?.querySelector<HTMLElement>(`#${CSS.escape(idOf(first))}`)?.focus();
}
