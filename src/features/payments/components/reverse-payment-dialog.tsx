"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  paymentFieldErrors,
  paymentNotice,
  REVERSAL_REASON_MAX,
  reversalSchema,
  type PaymentNotice,
} from "../schemas";
import { reversePayment } from "../server/actions";
import { NOTICE_ID, useShowNotice } from "./payment-notices";

// "عكس" on one ledger row (spec 0023 AC-6, AC-7): a dialog naming the row with a required reason.
// The card renders it with `key={reversalId}`, so the refresh after a write, or after a refusal
// that refreshes, closes it and drops the reason; those notices show in the card. A refusal that
// keeps the dialog open shows inside it.
export function ReversePaymentDialog({
  orderId,
  paymentId,
  reversalId,
  expectedAmountPaid,
  label,
  summary,
}: {
  readonly orderId: string;
  readonly paymentId: string;
  readonly reversalId: string;
  readonly expectedAmountPaid: number;
  /** "عكس الدفعة {amount} بتاريخ {date}" for the button. */
  readonly label: string;
  /** The row as the list shows it: day, method text, and amount. */
  readonly summary: React.ReactNode;
}) {
  const t = useTranslations("AdminPayments");
  const router = useRouter();
  const showNotice = useShowNotice();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<"required" | "too_long" | null>(null);
  const [problem, setProblem] = useState<PaymentNotice["key"] | null>(null);
  const [pending, startTransition] = useTransition();
  // Closed because the card now shows a notice: focus goes there, not back to "عكس" (AC-6).
  const toNotice = useRef(false);

  const closeToNotice = () => {
    toNotice.current = true;
    setOpen(false);
    startTransition(() => router.refresh());
  };

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setProblem(null);
      setReasonError(null);
    }
  };

  const markReason = (code: "required" | "too_long") => {
    setReasonError(code);
    document.getElementById(reasonId)?.focus();
  };

  const confirm = () => {
    const input = { reversalId, orderId, paymentId, expectedAmountPaid, reason };
    const checked = reversalSchema.safeParse(input);
    if (!checked.success) {
      const code = paymentFieldErrors(checked.error).reason;
      markReason(code === "too_long" ? "too_long" : "required");
      return;
    }
    setReasonError(null);
    setProblem(null);
    startTransition(async () => {
      try {
        const result = await reversePayment(input);
        if (result.ok) {
          showNotice({ kind: "done", key: "reversed" });
          closeToNotice();
          return;
        }
        if (result.error === "forbidden") {
          startTransition(() => router.refresh());
          return;
        }
        const reasonCode = result.error === "invalid" ? result.fieldErrors.reason : undefined;
        if (reasonCode) {
          markReason(reasonCode === "too_long" ? "too_long" : "required");
          return;
        }
        const notice = paymentNotice(result.error, false);
        if (!notice) return;
        if (!notice.refresh) {
          setProblem(notice.key);
          return;
        }
        showNotice({ kind: "refused", key: notice.key });
        closeToNotice();
      } catch {
        setProblem("failed");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogTrigger
        render={<Button variant="outline" />}
        aria-label={label}
        data-testid="payment-reverse"
      >
        {t("reverse")}
      </AlertDialogTrigger>
      <AlertDialogContent
        finalFocus={() => (toNotice.current ? document.getElementById(NOTICE_ID) : true)}
        data-testid="payment-reverse-dialog"
      >
        <AlertDialogTitle>{t("reverseTitle")}</AlertDialogTitle>
        <div data-testid="payment-reverse-summary">{summary}</div>
        <Field>
          <FieldLabel htmlFor={reasonId}>{t("reason")}</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={REVERSAL_REASON_MAX}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError(null);
            }}
            disabled={pending}
            required
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? `${reasonId}-error` : undefined}
            data-testid="payment-reverse-reason"
          />
          <FieldError id={`${reasonId}-error`} announce={false}>
            {reasonError === "too_long"
              ? t("errors.tooLong")
              : reasonError
                ? t("errors.reasonRequired")
                : null}
          </FieldError>
        </Field>
        {problem ? (
          <Alert data-testid="payment-reverse-problem">
            <AlertDescription>{t(`errors.${problem}`)}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogActions>
          <Button onClick={confirm} disabled={pending} data-testid="payment-reverse-confirm">
            {t("reverseConfirm")}
          </Button>
          <AlertDialogClose render={<Button variant="outline" />} disabled={pending}>
            {t("reverseKeep")}
          </AlertDialogClose>
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
}
