"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { routes } from "@/lib/routes";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import { verifyTotp, type VerifyState } from "../server/actions";

// The 6 digit code (spec 0004 AC-1), for signing in and for finishing setup. A correct code lifts
// the session to `aal2` and the action redirects to `next`.
export function TotpForm({
  factorId,
  next,
}: {
  readonly factorId: string;
  readonly next?: string;
}) {
  const t = useTranslations("AdminAuth");
  const errorText = useFieldErrorText();
  const [state, dispatch, pending] = useActionState(verifyTotp, null as VerifyState);
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldError = state?.error === "invalid" ? state.fieldErrors?.code : undefined;
  const banner = state && state.error !== "invalid" ? t(`errors.${state.error}`) : null;

  // A wrong code is cleared and focused, ready for the next one from the app.
  useEffect(() => {
    if (!state) return;
    if (inputRef.current && state.error === "invalid_code") inputRef.current.value = "";
    inputRef.current?.focus();
  }, [state]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    startTransition(() => dispatch(form));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="factorId" value={factorId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field>
        <FieldLabel htmlFor="admin-totp-code">{t("code")}</FieldLabel>
        <Input
          ref={inputRef}
          id="admin-totp-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          maxLength={12}
          required
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? "admin-totp-code-error" : "admin-totp-code-help"}
        />
        <FieldDescription id="admin-totp-code-help">{t("codeHelp")}</FieldDescription>
        <FieldError id="admin-totp-code-error">{errorText(fieldError)}</FieldError>
      </Field>
      {banner ? (
        <Alert id="admin-totp-banner">
          <AlertDescription>{banner}</AlertDescription>
        </Alert>
      ) : null}
      {state?.error === "forbidden" ? (
        <Link
          href={routes.admin.login}
          className="inline-flex min-h-11 items-center self-start font-bold underline"
        >
          {t("toLogin")}
        </Link>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        aria-describedby={banner ? "admin-totp-banner" : undefined}
        data-testid="admin-totp-submit"
      >
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}
