"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { fieldOrder } from "../schemas";
import { setNewPassword } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner } from "./form-parts";
import { useAccountForm } from "./use-account-form";

const FORM = "set-password";

// /account/reset-password (spec 0017 AC-8): the new password after a reset link. Saving ends every
// other session of the account and goes to /account.
export function SetPasswordForm() {
  const t = useTranslations("Account");
  const { pending, formRef, bannerRef, fieldErrors, bannerError, submit } = useAccountForm(
    setNewPassword,
    {
      form: FORM,
      order: fieldOrder.setPassword,
      errorFields: {
        weak_password: ["password", "password_weak"],
        same_password: ["password", "password_same"],
      },
    },
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <AccountField
          form={FORM}
          name="password"
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          errors={fieldErrors}
        />
        <AccountField
          form={FORM}
          name="confirm"
          label={t("confirmNewPassword")}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          required
          errors={fieldErrors}
        />
      </FieldGroup>
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
        data-testid="set-password-submit"
      >
        {pending ? t("saving") : t("savePassword")}
      </Button>
    </form>
  );
}
