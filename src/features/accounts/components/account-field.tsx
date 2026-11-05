"use client";

import type { ComponentProps, ReactNode } from "react";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/form-errors";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { errorId, fieldId } from "./use-account-form";

/** One labelled input of an account form, with its error under it (spec 0017 AC-3). */
export function AccountField({
  form,
  name,
  label,
  errors,
  description,
  ...input
}: Omit<ComponentProps<typeof Input>, "id" | "name"> & {
  readonly form: string;
  readonly name: string;
  readonly label: string;
  readonly errors: FieldErrors;
  readonly description?: ReactNode;
}) {
  const errorText = useFieldErrorText();
  const error = errors[name];
  const helpId = `${fieldId(form, name)}-help`;
  const describedBy = error ? errorId(form, name) : description ? helpId : undefined;
  return (
    <Field>
      <FieldLabel htmlFor={fieldId(form, name)}>{label}</FieldLabel>
      <Input
        id={fieldId(form, name)}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {description ? <FieldDescription id={helpId}>{description}</FieldDescription> : null}
      <FieldError id={errorId(form, name)}>{errorText(error)}</FieldError>
    </Field>
  );
}
