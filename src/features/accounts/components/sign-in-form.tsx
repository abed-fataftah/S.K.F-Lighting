"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { fieldOrder } from "../schemas";
import { signInCustomer } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner } from "./form-parts";
import type { SwitchTab } from "./sign-in-tabs";
import { useAccountForm } from "./use-account-form";

const FORM = "login";

// Sign in (spec 0017 AC-5; docs/design/pages/sign-in.md). A wrong password and an unknown email
// show the same message.
export function SignInForm({
  next,
  email,
  onEmailChange,
  onSwitch,
}: {
  readonly next?: string;
  readonly email: string;
  readonly onEmailChange: (email: string) => void;
  readonly onSwitch: SwitchTab;
}) {
  const t = useTranslations("Account");
  const { pending, formRef, bannerRef, fieldErrors, bannerError, submit } = useAccountForm(
    signInCustomer,
    { form: FORM, order: fieldOrder.login },
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <AccountField
          form={FORM}
          name="password"
          label={t("password")}
          type="password"
          autoComplete="current-password"
          dir="ltr"
          required
          errors={fieldErrors}
        />
      </FieldGroup>
      <Button
        type="button"
        variant="link"
        className="self-start"
        onClick={() => onSwitch("reset")}
        data-testid="login-forgot"
      >
        {t("forgot")}
      </Button>
      {bannerError ? (
        <FormBanner id={`${FORM}-banner`} ref={bannerRef}>
          {t(`errors.${bannerError}`)}
        </FormBanner>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="login-submit"
      >
        {pending ? t("signingIn") : t("signIn")}
      </Button>
    </form>
  );
}
