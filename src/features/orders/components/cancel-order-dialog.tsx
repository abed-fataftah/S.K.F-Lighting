"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Ltr } from "@/components/ltr";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/money";
import { CANCEL_REASON_MAX } from "../schemas";
import { cancelOrderByAdmin } from "../server/admin-actions";
import type { OrderStatus } from "../status";

// "إلغاء الطلب" (spec 0014 AC-4): a confirm dialog with an optional reason. Both buttons are
// disabled while the action runs; on success it closes and the page shows the cancelled state;
// on an error it stays open with the status card's message for that error. With money recorded on
// the order it warns that a refund is owed after the cancel (spec 0023 AC-9).
export function CancelOrderDialog({
  orderId,
  number,
  status,
  amountPaid,
  disabled,
  onDone,
}: {
  readonly orderId: string;
  readonly number: string;
  readonly status: OrderStatus;
  /** Money already recorded, from the page render: a moment old is fine for a warning. */
  readonly amountPaid: number;
  readonly disabled: boolean;
  /** Called after a successful cancel, so the card can move focus to its badge. */
  readonly onDone: () => void;
}) {
  const t = useTranslations("AdminOrders");
  const tp = useTranslations("AdminPayments");
  const router = useRouter();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<"stale" | "saveFailed" | null>(null);
  const [pending, startTransition] = useTransition();

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setProblem(null);
  };

  const confirm = () => {
    startTransition(async () => {
      try {
        const result = await cancelOrderByAdmin({ orderId, from: status, reason });
        if (result.ok) {
          setOpen(false);
          setReason("");
          onDone();
        } else if (result.error === "stale") {
          setProblem("stale");
          startTransition(() => router.refresh());
        } else {
          setProblem("saveFailed");
        }
      } catch {
        setProblem("saveFailed");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogTrigger
        render={<Button variant="outline" className="w-full" />}
        disabled={disabled}
        data-testid="order-cancel"
      >
        {t("cancel")}
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="order-cancel-dialog">
        <AlertDialogTitle>
          {t.rich("cancelTitle", { number, ltr: (chunks) => <Ltr>{chunks}</Ltr> })}
        </AlertDialogTitle>
        <Field>
          <FieldLabel htmlFor={reasonId}>{t("cancelReason")}</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            data-testid="order-cancel-reason"
          />
        </Field>
        {amountPaid > 0 ? (
          <p data-testid="order-cancel-paid-warning">
            {tp.rich("cancelWarning", {
              amount: formatPrice(amountPaid),
              ltr: (chunks) => <Ltr>{chunks}</Ltr>,
            })}
          </p>
        ) : null}
        {problem ? (
          <Alert data-testid="order-cancel-problem">
            <AlertDescription>{t(problem)}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogActions>
          <Button onClick={confirm} disabled={pending} data-testid="order-cancel-confirm">
            {t("cancelConfirm")}
          </Button>
          <AlertDialogClose render={<Button variant="outline" />} disabled={pending}>
            {t("cancelKeep")}
          </AlertDialogClose>
        </AlertDialogActions>
      </AlertDialogContent>
    </AlertDialog>
  );
}
