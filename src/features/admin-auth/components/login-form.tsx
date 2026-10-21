"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { signInAdmin, type SignInState } from "../server/actions";

const fieldOrder = ["email", "password"] as const;
const errorId = (field: string) => `admin-login-${field}-error`;

// Dashboard sign in (spec 0004 AC-1; the look of docs/design/pages/sign-in.md). A wrong password
// and a correct password on an account that is not the owner's show the same message.
export function LoginForm({ next }: { readonly next?: string }) {
  const t = useTranslations("AdminAuth");
  const errorText = useFieldErrorText();
  const [state, dispatch, pending] = useActionState(signInAdmin, null as SignInState);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldErrors = state?.error === "invalid" ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state?.error !== "invalid" || !state.fieldErrors) return;
    const first = fieldOrder.find((field) => state.fieldErrors?.[field]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name=${first}]`)?.focus();
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };

  const invalid = (field: string) =>
    fieldErrors[field] ? { "aria-invalid": true as const, "aria-describedby": errorId(field) } : {};
  const banner = state && state.error !== "invalid" ? t(`errors.${state.error}`) : null;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="admin-login-email">{t("email")}</FieldLabel>
          <Input
            id="admin-login-email"
            name="email"
            type="email"
            autoComplete="username"
            dir="ltr"
            required
            {...invalid("email")}
          />
          <FieldError id={errorId("email")}>{errorText(fieldErrors.email)}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="admin-login-password">{t("password")}</FieldLabel>
          <Input
            id="admin-login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            required
            {...invalid("password")}
          />
          <FieldError id={errorId("password")}>{errorText(fieldErrors.password)}</FieldError>
        </Field>
      </FieldGroup>
      {banner ? (
        <Alert id="admin-login-banner">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        aria-describedby={banner ? "admin-login-banner" : undefined}
        data-testid="admin-login-submit"
      >
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
