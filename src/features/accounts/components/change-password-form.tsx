"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { fieldOrder } from "../schemas";
import { changePassword } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner, FormNotice } from "./form-parts";
import { useAccountForm } from "./use-account-form";

const FORM = "change-password";

// "تغيير كلمة المرور" on /account (spec 0017 AC-10). The fields empty after every answer.
export function ChangePasswordForm() {
  const t = useTranslations("Account");
  const { state, pending, formRef, bannerRef, fieldErrors, bannerError, submit } = useAccountForm(
    changePassword,
    {
      form: FORM,
      order: fieldOrder.changePassword,
      errorFields: {
        wrong_current: ["current", "password_wrong_current"],
        weak_password: ["password", "password_weak"],
        same_password: ["password", "password_same"],
      },
    },
  );

  const password = (name: string, label: string, autoComplete: string) => (
    <AccountField
      form={FORM}
      name={name}
      label={label}
      type="password"
      autoComplete={autoComplete}
      dir="ltr"
      required
      errors={fieldErrors}
    />
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        {password("current", t("currentPassword"), "current-password")}
        {password("password", t("newPassword"), "new-password")}
        {password("confirm", t("confirmNewPassword"), "new-password")}
      </FieldGroup>
      {bannerError ? (
        <FormBanner id={`${FORM}-banner`} ref={bannerRef}>
          {t(`errors.${bannerError}`)}
        </FormBanner>
      ) : null}
      {state?.ok ? <FormNotice id={`${FORM}-done`}>{t("passwordChanged")}</FormNotice> : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="change-password-submit"
      >
        {pending ? t("saving") : t("changePassword")}
      </Button>
    </form>
  );
}
