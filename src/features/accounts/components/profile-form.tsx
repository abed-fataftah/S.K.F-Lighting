"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NAME_LIMITS } from "@/features/checkout/schemas";
import { fieldOrder } from "../schemas";
import { updateProfile } from "../server/actions";
import { AccountField } from "./account-field";
import { FormBanner, FormNotice } from "./form-parts";
import { useAccountForm } from "./use-account-form";

const FORM = "profile";

// "بياناتي" on /account (spec 0017 AC-9): the email is shown, name and phone are edited with the
// checkout rules. Saved orders keep the details they were placed with.
export function ProfileForm({
  email,
  name,
  phone,
}: {
  readonly email: string;
  readonly name: string;
  readonly phone: string;
}) {
  const t = useTranslations("Account");
  const { state, pending, formRef, bannerRef, fieldErrors, bannerError, submit } = useAccountForm(
    updateProfile,
    { form: FORM, order: fieldOrder.profile },
  );

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${FORM}-email`}>{t("email")}</FieldLabel>
          <Input id={`${FORM}-email`} type="email" dir="ltr" value={email} readOnly />
        </Field>
        <AccountField
          form={FORM}
          name="name"
          label={t("name")}
          autoComplete="name"
          defaultValue={name}
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
          defaultValue={phone}
          required
          errors={fieldErrors}
        />
      </FieldGroup>
      {bannerError ? (
        <FormBanner id={`${FORM}-banner`} ref={bannerRef}>
          {t(`errors.${bannerError}`)}
        </FormBanner>
      ) : null}
      {state?.ok ? <FormNotice id={`${FORM}-saved`}>{t("detailsSaved")}</FormNotice> : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="profile-submit"
      >
        {pending ? t("saving") : t("saveChanges")}
      </Button>
    </form>
  );
}
