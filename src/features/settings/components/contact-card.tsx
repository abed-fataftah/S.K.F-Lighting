"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { ADDRESS_LIMITS } from "@/features/checkout/schemas";
import { fieldErrorsOf, type FieldErrors } from "@/lib/form-errors";
import { shopContactSchema } from "../schemas";
import { saveShopContact } from "../server/actions";
import type { SettingsContact } from "../server/settings-db";
import { focusFirstError, SettingsField } from "./settings-field";

const FIELDS = ["whatsappNumber", "contactPhone", "address"] as const;
type Values = Record<(typeof FIELDS)[number], string>;
const fieldId = (field: string) => `contact-${field}`;

// "بيانات التواصل" (spec 0025 AC-1, AC-2): saves on its own. The WhatsApp field shows the number in
// use now, the saved one or the env fallback, so the owner always sees what customers reach.
export function ContactCard({
  contact,
  numberInUse,
}: {
  readonly contact: SettingsContact;
  readonly numberInUse: string;
}) {
  const t = useTranslations("AdminSettings");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Values>({
    whatsappNumber: numberInUse,
    contactPhone: contact.contactPhone ?? "",
    address: contact.address ?? "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, startTransition] = useTransition();

  const showErrors = (found: FieldErrors) => {
    setErrors(found);
    focusFirstError(formRef.current, FIELDS, found, fieldId);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setStatus("idle");
    const parsed = shopContactSchema.safeParse(values);
    if (!parsed.success) return showErrors(fieldErrorsOf(parsed.error));
    setErrors({});
    startTransition(async () => {
      const result = await saveShopContact(values);
      if (result.ok) {
        setValues({
          whatsappNumber: result.data.whatsappNumber ?? "",
          contactPhone: result.data.contactPhone ?? "",
          address: result.data.address ?? "",
        });
        setStatus("saved");
      } else if (result.error === "invalid") showErrors(result.fieldErrors);
      else if (result.error === "forbidden") router.refresh();
      else setStatus("failed");
    });
  };

  const field = (name: keyof Values) => ({
    id: fieldId(name),
    name,
    value: values[name],
    error: errors[name],
    onChange: (event: { currentTarget: HTMLInputElement }) => {
      const { value } = event.currentTarget;
      setValues((current) => ({ ...current, [name]: value }));
      setStatus("idle");
    },
  });

  return (
    <Card>
      <h2 className="type-title-s">{t("contactTitle")}</h2>
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
        <FieldGroup className="flex-row flex-wrap">
          <SettingsField
            {...field("whatsappNumber")}
            label={t("whatsapp")}
            hint={t("whatsappHelp")}
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            required
            className="grow basis-64"
            data-testid="settings-whatsapp"
          />
          <SettingsField
            {...field("contactPhone")}
            label={
              <>
                {t("phone")} <span className="font-normal text-muted">{t("optional")}</span>
              </>
            }
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            className="grow basis-64"
          />
          <SettingsField
            {...field("address")}
            label={
              <>
                {t("address")} <span className="font-normal text-muted">{t("optional")}</span>
              </>
            }
            maxLength={ADDRESS_LIMITS.max * 2}
            autoComplete="off"
            className="basis-full"
          />
        </FieldGroup>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={pending}
            focusableWhenDisabled
            aria-busy={pending || undefined}
            data-testid="settings-contact-save"
          >
            {pending ? t("saving") : t("saveContact")}
          </Button>
          <p role="status" className="flex items-center gap-1.5 font-bold">
            {status === "saved" ? (
              <>
                <CircleCheck aria-hidden className="size-5 text-whatsapp" />
                {t("contactSaved")}
              </>
            ) : null}
          </p>
          {status === "failed" ? (
            <p role="alert" className="font-bold text-danger">
              {t("failed")}
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
