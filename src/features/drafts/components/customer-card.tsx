"use client";

import { useTranslations } from "next-intl";
import { RadioCard } from "@/components/radio-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { ADDRESS_LIMITS, CITY_LIMITS, NAME_LIMITS, NOTES_MAX } from "@/features/checkout/schemas";
import type { FieldErrors } from "@/lib/form-errors";
import { formatPrice } from "@/lib/money";
import { useFieldErrorText } from "@/lib/use-field-error-text";
import type { DraftCustomerFields } from "../send-check";
import type { DraftZone } from "./quick-order";

// "بيانات الزبون" (spec 0020 AC-10): the checkout fields with the checkout labels. Each field
// saves through the page's queue: the choices at once, the text 800 ms after typing and on leave.
// The full checkout rules run only on send; their errors show here with checkout's messages.

export type CustomerField = keyof DraftCustomerFields;

/** The checkout schema's name for each field, which is how its errors are keyed. */
export const customerErrorKey: Readonly<Record<CustomerField, string>> = {
  customerName: "name",
  customerPhone: "phone",
  fulfilment: "fulfilment",
  deliveryZoneId: "zoneId",
  city: "city",
  address: "address",
  notes: "notes",
};

export const customerFieldId = (errorKey: string) => `customer-${errorKey}`;
const errorId = (errorKey: string) => `customer-${errorKey}-error`;

export function CustomerCard({
  customer,
  zones,
  errors,
  canFillMine,
  onChange,
  onLeave,
  onFillMine,
}: {
  readonly customer: DraftCustomerFields;
  readonly zones: readonly DraftZone[];
  readonly errors: FieldErrors;
  /** The profile has a phone, so "الطلب لي" can copy it. */
  readonly canFillMine: boolean;
  readonly onChange: (field: CustomerField, value: string | null, when: "now" | "later") => void;
  readonly onLeave: (field: CustomerField) => void;
  readonly onFillMine: () => void;
}) {
  const t = useTranslations("Checkout");
  const tq = useTranslations("QuickOrder");
  const errorText = useFieldErrorText();

  const errorFor = (field: CustomerField) => {
    const key = customerErrorKey[field];
    return <FieldError id={errorId(key)}>{errorText(errors[key])}</FieldError>;
  };
  const aria = (field: CustomerField, help?: string) => {
    const key = customerErrorKey[field];
    return errors[key]
      ? { "aria-invalid": true as const, "aria-describedby": errorId(key) }
      : { "aria-describedby": help };
  };
  const text = (field: CustomerField) => ({
    id: customerFieldId(customerErrorKey[field]),
    value: customer[field] ?? "",
    onChange: (event: { currentTarget: { value: string } }) =>
      onChange(field, event.currentTarget.value, "later"),
    onBlur: () => onLeave(field),
  });

  const delivery = customer.fulfilment === "delivery";

  return (
    <Card data-testid="customer-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-lead">{tq("customer")}</h2>
        <Button
          type="button"
          variant="outline"
          onClick={onFillMine}
          disabled={!canFillMine}
          data-testid="fill-mine"
        >
          {tq("forMe")}
        </Button>
      </div>

      <Field>
        <FieldLabel htmlFor={customerFieldId("name")}>{t("name")}</FieldLabel>
        <Input
          {...text("customerName")}
          autoComplete="off"
          maxLength={NAME_LIMITS.max * 2}
          {...aria("customerName")}
        />
        {errorFor("customerName")}
      </Field>
      <Field>
        <FieldLabel htmlFor={customerFieldId("phone")}>{t("phone")}</FieldLabel>
        <Input
          {...text("customerPhone")}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          dir="ltr"
          {...aria("customerPhone", "customer-phone-help")}
        />
        <FieldDescription id="customer-phone-help">{t("phoneHelp")}</FieldDescription>
        {errorFor("customerPhone")}
      </Field>

      <div className="flex flex-col gap-2">
        <h3 id="customer-method" className="font-bold">
          {t("method")}
        </h3>
        <RadioGroup
          id={customerFieldId("fulfilment")}
          aria-labelledby="customer-method"
          value={customer.fulfilment ?? ""}
          onValueChange={(value) => onChange("fulfilment", String(value), "now")}
          className="gap-2"
          {...aria("fulfilment")}
        >
          <RadioCard value="pickup" title={t("pickup")} description={t("free")} />
          <RadioCard value="delivery" title={t("delivery")} description={t("deliveryText")} />
        </RadioGroup>
        {errorFor("fulfilment")}
      </div>

      {delivery ? (
        <>
          <Field>
            <FieldLabel htmlFor={customerFieldId("zoneId")}>{t("zone")}</FieldLabel>
            <NativeSelect
              id={customerFieldId("zoneId")}
              value={customer.deliveryZoneId ?? ""}
              onChange={(event) =>
                onChange("deliveryZoneId", event.currentTarget.value || null, "now")
              }
              {...aria("deliveryZoneId")}
            >
              <NativeSelectOption value="" disabled>
                {tq("chooseZone")}
              </NativeSelectOption>
              {zones.map((zone) =>
                zone.active ? (
                  <NativeSelectOption key={zone.id} value={zone.id}>
                    {`${zone.name} · ${formatPrice(zone.fee)}`}
                  </NativeSelectOption>
                ) : (
                  <NativeSelectOption key={zone.id} value={zone.id} disabled>
                    {tq("zoneInactive", { zone: zone.name })}
                  </NativeSelectOption>
                ),
              )}
            </NativeSelect>
            {errorFor("deliveryZoneId")}
          </Field>
          <Field>
            <FieldLabel htmlFor={customerFieldId("city")}>{t("city")}</FieldLabel>
            <Input
              {...text("city")}
              autoComplete="off"
              maxLength={CITY_LIMITS.max * 2}
              {...aria("city")}
            />
            {errorFor("city")}
          </Field>
          <Field>
            <FieldLabel htmlFor={customerFieldId("address")}>{t("address")}</FieldLabel>
            <Textarea
              {...text("address")}
              maxLength={ADDRESS_LIMITS.max * 2}
              className="min-h-22"
              {...aria("address", "customer-address-help")}
            />
            <FieldDescription id="customer-address-help">{t("addressHelp")}</FieldDescription>
            {errorFor("address")}
          </Field>
        </>
      ) : null}

      <Field>
        <FieldLabel htmlFor={customerFieldId("notes")}>{t("notes")}</FieldLabel>
        <Textarea {...text("notes")} maxLength={NOTES_MAX * 2} {...aria("notes")} />
        {errorFor("notes")}
      </Field>
    </Card>
  );
}
