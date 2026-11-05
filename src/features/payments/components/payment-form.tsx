"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { formatPrice, toShekelsInput } from "@/lib/money";
import type { PaymentMethod, RecordKind } from "../ledger";
import {
  CHEQUE_BANK_MAX,
  CHEQUE_NUMBER_MAX,
  fieldMessageKey,
  PAYMENT_FIELDS,
  PAYMENT_NOTE_MAX,
  paymentFieldErrors,
  paymentNotice,
  paymentSchema,
  type PaymentField,
  type PaymentFieldErrors,
} from "../schemas";
import { recordPayment } from "../server/actions";
import { useShowNotice } from "./payment-notices";

type Values = {
  readonly amount: string;
  readonly method: PaymentMethod;
  readonly chequeNumber: string;
  readonly chequeBank: string;
  readonly chequeDueDate: string;
  readonly receivedOn: string;
  readonly note: string;
};

const fieldId = (field: PaymentField) => `payment-${field}`;
const errorId = (field: PaymentField) => `payment-${field}-error`;

// "تسجيل دفعة" or "تسجيل استرجاع" on the dashboard order page (spec 0023 AC-3, AC-4, AC-7). The
// page renders it with `key={paymentId}`, so a refresh after a write brings a fresh id and an empty
// form; after a refusal that writes nothing and does not refresh, the same id is reused. Every
// field is checked with the shared schema before anything is sent.
export function PaymentForm({
  orderId,
  paymentId,
  kind,
  expectedAmountPaid,
  limit,
  today,
  minDay,
}: {
  readonly orderId: string;
  readonly paymentId: string;
  readonly kind: RecordKind;
  readonly expectedAmountPaid: number;
  /** What remains for a payment, what was paid for a refund (AC-3), as the page read it. */
  readonly limit: number;
  /** The shop's today, the latest allowed date. */
  readonly today: string;
  /** The order's shop day, the earliest allowed date. */
  readonly minDay: string;
}) {
  const t = useTranslations("AdminPayments");
  const router = useRouter();
  const showNotice = useShowNotice();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>({
    amount: toShekelsInput(limit),
    method: "cash",
    chequeNumber: "",
    chequeBank: "",
    chequeDueDate: "",
    receivedOn: today,
    note: "",
  });
  const [errors, setErrors] = useState<PaymentFieldErrors>({});
  // The limit a `too_much` names: the one read under the lock when the server refused.
  const [shownLimit, setShownLimit] = useState(limit);
  const cheque = values.method === "cheque";

  const set = (field: keyof Values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (field !== "method" && errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const showErrors = (found: PaymentFieldErrors) => {
    setErrors(found);
    const first = PAYMENT_FIELDS.find((field) => found[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const input = {
      paymentId,
      orderId,
      kind,
      expectedAmountPaid,
      amount: values.amount,
      method: values.method,
      receivedOn: values.receivedOn,
      note: values.note,
      // Cash sends no cheque fields, whatever they held before the switch.
      ...(cheque
        ? {
            chequeNumber: values.chequeNumber,
            chequeBank: values.chequeBank,
            chequeDueDate: values.chequeDueDate,
          }
        : {}),
    };
    const checked = paymentSchema({ today, minDay, limit }).safeParse(input);
    if (!checked.success) {
      setShownLimit(limit);
      showErrors(paymentFieldErrors(checked.error));
      return;
    }
    setErrors({});
    showNotice(null);
    startTransition(async () => {
      try {
        const result = await recordPayment(input);
        if (result.ok) {
          showNotice({ kind: "done", key: kind === "payment" ? "recorded" : "refunded" });
          startTransition(() => router.refresh());
          return;
        }
        if (result.error === "forbidden") {
          startTransition(() => router.refresh());
          return;
        }
        if (result.error === "too_much") {
          setShownLimit(result.limit);
          showErrors({ amount: "too_much" });
          return;
        }
        const fieldErrors = result.error === "invalid" ? result.fieldErrors : {};
        if (Object.keys(fieldErrors).length > 0) showErrors(fieldErrors);
        const notice = paymentNotice(result.error, Object.keys(fieldErrors).length > 0);
        if (notice) showNotice({ kind: "refused", key: notice.key });
        if (notice?.refresh) startTransition(() => router.refresh());
      } catch {
        showNotice({ kind: "refused", key: "failed" });
      }
    });
  };

  const message = (field: PaymentField) => {
    const code = errors[field];
    if (!code) return null;
    return t.rich(`errors.${fieldMessageKey(field, code, kind)}`, {
      limit: formatPrice(shownLimit),
      ltr: (chunks) => <Ltr>{chunks}</Ltr>,
    });
  };

  const described = (field: PaymentField) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": errorId(field) } : {};

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="payment-form-title"
      aria-busy={pending || undefined}
      className="flex flex-col gap-3"
      data-testid="payment-form"
    >
      <h3 id="payment-form-title" className="type-lead">
        {kind === "payment" ? t("formPayment") : t("formRefund")}
      </h3>
      <div className="flex flex-wrap gap-3">
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor={fieldId("amount")}>{t("amount")}</FieldLabel>
          <Input
            id={fieldId("amount")}
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={values.amount}
            onChange={(event) => set("amount", event.target.value)}
            disabled={pending}
            data-testid="payment-amount"
            {...described("amount")}
          />
          <FieldError id={errorId("amount")} announce={false}>
            {message("amount")}
          </FieldError>
        </Field>
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor="payment-method">{t("method")}</FieldLabel>
          <NativeSelect
            id="payment-method"
            value={values.method}
            onChange={(event) => set("method", event.target.value)}
            disabled={pending}
            data-testid="payment-method"
          >
            <NativeSelectOption value="cash">{t("methodCash")}</NativeSelectOption>
            <NativeSelectOption value="cheque">{t("methodCheque")}</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      {cheque ? (
        <div className="flex flex-wrap gap-3" data-testid="payment-cheque-fields">
          <Field className="min-w-0 flex-[1_1_9rem]">
            <FieldLabel htmlFor={fieldId("chequeNumber")}>{t("chequeNumber")}</FieldLabel>
            <Input
              id={fieldId("chequeNumber")}
              inputMode="numeric"
              autoComplete="off"
              dir="ltr"
              maxLength={CHEQUE_NUMBER_MAX}
              value={values.chequeNumber}
              onChange={(event) => set("chequeNumber", event.target.value)}
              disabled={pending}
              required
              data-testid="payment-cheque-number"
              {...described("chequeNumber")}
            />
            <FieldError id={errorId("chequeNumber")} announce={false}>
              {message("chequeNumber")}
            </FieldError>
          </Field>
          <Field className="min-w-0 flex-[1_1_9rem]">
            <FieldLabel htmlFor={fieldId("chequeBank")}>{t("chequeBank")}</FieldLabel>
            <Input
              id={fieldId("chequeBank")}
              autoComplete="off"
              maxLength={CHEQUE_BANK_MAX}
              value={values.chequeBank}
              onChange={(event) => set("chequeBank", event.target.value)}
              disabled={pending}
              required
              data-testid="payment-cheque-bank"
              {...described("chequeBank")}
            />
            <FieldError id={errorId("chequeBank")} announce={false}>
              {message("chequeBank")}
            </FieldError>
          </Field>
          <Field className="min-w-0 flex-[1_1_9rem]">
            <FieldLabel htmlFor={fieldId("chequeDueDate")}>{t("chequeDueDate")}</FieldLabel>
            <Input
              id={fieldId("chequeDueDate")}
              type="date"
              value={values.chequeDueDate}
              onChange={(event) => set("chequeDueDate", event.target.value)}
              disabled={pending}
              required
              data-testid="payment-cheque-date"
              {...described("chequeDueDate")}
            />
            <FieldError id={errorId("chequeDueDate")} announce={false}>
              {message("chequeDueDate")}
            </FieldError>
          </Field>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Field className="min-w-0 flex-[1_1_9rem]">
          <FieldLabel htmlFor={fieldId("receivedOn")}>{t("date")}</FieldLabel>
          <Input
            id={fieldId("receivedOn")}
            type="date"
            min={minDay}
            max={today}
            value={values.receivedOn}
            onChange={(event) => set("receivedOn", event.target.value)}
            disabled={pending}
            data-testid="payment-date"
            {...described("receivedOn")}
          />
          <FieldError id={errorId("receivedOn")} announce={false}>
            {message("receivedOn")}
          </FieldError>
        </Field>
        <Field className="min-w-0 flex-[2_1_12rem]">
          <FieldLabel htmlFor={fieldId("note")}>{t("note")}</FieldLabel>
          <Input
            id={fieldId("note")}
            autoComplete="off"
            maxLength={PAYMENT_NOTE_MAX}
            value={values.note}
            onChange={(event) => set("note", event.target.value)}
            disabled={pending}
            data-testid="payment-note"
            {...described("note")}
          />
          <FieldError id={errorId("note")} announce={false}>
            {message("note")}
          </FieldError>
        </Field>
      </div>
      <Button
        type="submit"
        className="w-fit"
        disabled={pending}
        focusableWhenDisabled
        aria-busy={pending || undefined}
        data-testid="payment-submit"
      >
        {pending ? t("saving") : kind === "payment" ? t("submitPayment") : t("submitRefund")}
      </Button>
    </form>
  );
}
