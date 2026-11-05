"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { fieldOrder } from "../schemas";
import { requestPasswordReset } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner, FormNotice, Honeypot } from "./form-parts";
import type { SwitchTab } from "./sign-in-tabs";
import { useAccountForm } from "./use-account-form";

const FORM = "reset";

// The reset request (spec 0017 AC-7, AC-8; docs/design/pages/sign-in.md). It always answers
// "sent", whether or not the email has an account. An expired link's message stays until the
// form is sent.
export function ResetRequestForm({
  email,
  onEmailChange,
  onSwitch,
  linkExpired,
  onSent,
}: {
  readonly email: string;
  readonly onEmailChange: (email: string) => void;
  readonly onSwitch: SwitchTab;
  readonly linkExpired: boolean;
  /** Called after each send, which ends the expired link message. */
  readonly onSent: () => void;
}) {
  const t = useTranslations("Account");
  const { state, pending, formRef, bannerRef, fieldErrors, submit } = useAccountForm(
    requestPasswordReset,
    { form: FORM, order: fieldOrder.reset },
  );
  const sent = state?.ok === true;
  useEffect(() => {
    if (state) onSent();
  }, [state, onSent]);

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Honeypot form={FORM} />
      <p className="text-muted">{t("resetText")}</p>
      {linkExpired ? (
        <FormBanner id={`${FORM}-expired`} ref={bannerRef}>
          {t("linkExpired")}
        </FormBanner>
      ) : null}
      <FieldGroup>
        <AccountField
          form={FORM}
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          dir="ltr"
          required
          value={email}
          onChange={(event) => onEmailChange(event.currentTarget.value)}
          errors={fieldErrors}
        />
      </FieldGroup>
      {sent ? <FormNotice id={`${FORM}-sent`}>{t("resetSent")}</FormNotice> : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="reset-submit"
      >
        {pending ? t("sending") : t("sendReset")}
      </Button>
      <Button
        type="button"
        variant="link"
        className="self-start"
        onClick={() => onSwitch("login")}
        data-testid="reset-back"
      >
        {t("backToLogin")}
      </Button>
    </form>
  );
}
