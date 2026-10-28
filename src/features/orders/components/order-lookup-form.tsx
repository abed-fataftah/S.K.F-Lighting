"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldError as FieldErrorValue } from "@/lib/form-errors";
import { orderLookupFieldOrder } from "../schemas";
import { lookupOrder, type LookupState } from "../server/lookup-actions";

const fieldId = (field: string) => `lookup-${field}`;
const errorId = (field: string) => `lookup-${field}-error`;

// The four codes the lookup schema raises (spec 0015 AC-5); any other falls back to `required`.
const LOOKUP_ERRORS = ["number_required", "number_format", "required", "phone_mobile"] as const;
type LookupErrorKey = (typeof LOOKUP_ERRORS)[number];
const lookupErrorKey = (error: FieldErrorValue): LookupErrorKey =>
  LOOKUP_ERRORS.find((code) => code === error.code) ?? "required";

// The guest lookup form (spec 0015 AC-1, AC-5, AC-6; docs/design/pages/order.md). The form posts
// straight to the Server Action, so it works before JavaScript loads; a match redirects to the
// order page, a miss comes back with the typed values to show again.
export function OrderLookupForm({ initialNumber }: { readonly initialNumber: string }) {
  const t = useTranslations("OrderLookup");
  const [state, dispatch, pending] = useActionState(lookupOrder, null as LookupState);
  const formRef = useRef<HTMLFormElement>(null);
  // React resets the form after its action, back to each field's `defaultValue`: a failure
  // carries the typed values, so they stay (AC-5).
  const values = state?.values ?? { number: initialNumber, phone: "" };

  const fieldErrors = state?.error === "invalid" ? (state.fieldErrors ?? {}) : {};
  const banner =
    state?.error === "not_found" ? t("notFound") : state?.error === "limited" ? t("limited") : null;

  // Focus the first invalid field after a refused submit; the box announces itself.
  useEffect(() => {
    if (state?.error !== "invalid") return;
    const first = orderLookupFieldOrder.find((field) => state.fieldErrors?.[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#${fieldId(first)}`)?.focus();
  }, [state]);

  const invalid = (field: string) =>
    fieldErrors[field] ? { "aria-invalid": true as const, "aria-describedby": errorId(field) } : {};
  const errorFor = (field: string) => {
    const error = fieldErrors[field];
    return (
      <FieldError id={errorId(field)}>
        {error ? t.rich(`errors.${lookupErrorKey(error)}`, { ltr: (c) => <Ltr>{c}</Ltr> }) : null}
      </FieldError>
    );
  };

  return (
    <form ref={formRef} action={dispatch} noValidate className="flex flex-col gap-3">
      {banner ? (
        <Alert className="border-danger bg-white text-danger" data-testid="lookup-error">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={fieldId("number")}>{t("number")}</FieldLabel>
            <Input
              id={fieldId("number")}
              name="number"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              placeholder="26-00123"
              defaultValue={values.number}
              required
              {...invalid("number")}
            />
            {errorFor("number")}
          </Field>
          <Field>
            <FieldLabel htmlFor={fieldId("phone")}>{t("phone")}</FieldLabel>
            <Input
              id={fieldId("phone")}
              name="phone"
              type="tel"
              dir="ltr"
              autoComplete="tel"
              defaultValue={values.phone}
              required
              {...invalid("phone")}
            />
            {errorFor("phone")}
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" disabled={pending} data-testid="lookup-submit">
          {pending ? t("submitting") : t("submit")}
        </Button>
        <FieldDescription className="text-center">{t("limitNote")}</FieldDescription>
      </Card>
    </form>
  );
}
