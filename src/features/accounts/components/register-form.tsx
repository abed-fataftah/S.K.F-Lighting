"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { NAME_LIMITS } from "@/features/checkout/schemas";
import { fieldOrder } from "../schemas";
import { registerCustomer } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner, Honeypot } from "./form-parts";
import type { SwitchTab } from "./sign-in-tabs";
import { useAccountForm } from "./use-account-form";

const FORM = "register";

// Register (spec 0017 AC-2, AC-3; docs/design/pages/sign-in.md). A taken email offers the other
// two forms with the typed email carried over in component state, never in the address.
export function RegisterForm({
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
    registerCustomer,
    {
      form: FORM,
      order: fieldOrder.register,
      errorFields: { weak_password: ["password", "password_weak"] },
    },
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Honeypot form={FORM} />
      <FieldGroup>
        <AccountField
          form={FORM}
          name="name"
          label={t("name")}
          autoComplete="name"
          maxLength={NAME_LIMITS.max * 2}
          required
          errors={fieldErrors}
        />
        <AccountField
          form={FORM}
          name="phone"
          label={t("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          required
          errors={fieldErrors}
        />
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
          autoComplete="new-password"
          dir="ltr"
          required
          errors={fieldErrors}
        />
      </FieldGroup>
      {bannerError ? (
        <FormBanner id={`${FORM}-banner`} ref={bannerRef}>
          <p>{t(`errors.${bannerError}`)}</p>
          {bannerError === "email_taken" ? (
            <span className="flex flex-wrap gap-x-4">
              <Button type="button" variant="link" onClick={() => onSwitch("login")}>
                {t("tabLogin")}
              </Button>
              <Button type="button" variant="link" onClick={() => onSwitch("reset")}>
                {t("forgot")}
              </Button>
            </span>
          ) : null}
        </FormBanner>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="register-submit"
      >
        {pending ? t("registering") : t("register")}
      </Button>
    </form>
  );
}
