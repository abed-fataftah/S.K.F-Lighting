"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Ltr } from "@/components/ltr";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogActions,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cancelProblem } from "../customer-cancel";
import { CANCEL_REASON_MAX } from "../schemas";
import { cancelOrderByCustomer } from "../server/customer-actions";
import type { OrderStatus } from "../status";

const subscribeNever = () => () => {};

/** True after mount; false on the server, so its HTML never holds a button that cannot work. */
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/** The order page's header badge (`#order-status`, focusable on every order page). */
const focusStatusBadge = () => document.getElementById("order-status")?.focus();

type Problem = {
  readonly key: ReturnType<typeof cancelProblem>;
  /** A changed notice outlives the one status change its own refresh brings. */
  readonly keep: boolean;
};

// "إلغاء الطلب" on the customer's order page (spec 0016 AC-2, AC-3, AC-5, AC-6). The page renders
// it only while the cancel rule allows it, so a cancel or a refresh that moves the order on
// unmounts it; focus then goes to the header badge. On success the browser opens WhatsApp once
// with W6, from the URL captured before the action ran.
export function CustomerCancel({
  orderId,
  number,
  status,
  notifyUrl,
}: {
  readonly orderId: string;
  readonly number: string;
  readonly status: OrderStatus;
  /** W6: "ألغيت الطلب رقم ... من الموقع" to the shop's WhatsApp. */
  readonly notifyUrl: string;
}) {
  const t = useTranslations("OrderPage");
  const router = useRouter();
  const mounted = useMounted();
  const reasonId = useId();
  const focusOnUnmount = useRef(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [shownStatus, setShownStatus] = useState(status);
  const [pending, startTransition] = useTransition();

  if (status !== shownStatus) {
    setShownStatus(status);
    setProblem((current) => (current?.keep ? { ...current, keep: false } : null));
  }

  useEffect(
    () => () => {
      if (focusOnUnmount.current) focusStatusBadge();
    },
    [],
  );

  if (!mounted) return null;

  const change = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setProblem(null);
  };

  const confirm = () => {
    // Read before the await: the revalidated page unmounts this component with the response.
    const handOff = notifyUrl;
    setProblem(null);
    startTransition(async () => {
      try {
        const result = await cancelOrderByCustomer({ orderId, from: status, reason });
        if (result.ok) {
          focusOnUnmount.current = true;
          setOpen(false);
          focusStatusBadge();
          window.location.assign(handOff);
          return;
        }
        const key = cancelProblem(result.error);
        setProblem({ key, keep: key === "cancelChanged" });
        if (key === "cancelChanged") {
          focusOnUnmount.current = true;
          startTransition(() => router.refresh());
        }
      } catch {
        setProblem({ key: "cancelFailed", keep: false });
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={change}>
      <AlertDialogTrigger
        render={<Button variant="outline" size="lg" className="w-full" />}
        data-testid="customer-cancel"
      >
        {t("cancel")}
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="customer-cancel-dialog" aria-busy={pending || undefined}>
        <AlertDialogTitle>
          {t.rich("cancelTitle", { number, ltr: (chunks) => <Ltr>{chunks}</Ltr> })}
        </AlertDialogTitle>
        <AlertDialogDescription>{t("cancelBody")}</AlertDialogDescription>
        <Field>
          <FieldLabel htmlFor={reasonId}>{t("cancelReason")}</FieldLabel>
          <Textarea
            id={reasonId}
            value={reason}
            maxLength={CANCEL_REASON_MAX}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            data-testid="customer-cancel-reason"
          />
        </Field>
        {problem ? (
          <Alert data-testid="customer-cancel-problem">
            <AlertDescription>{t(problem.key)}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogActions>
          <Button onClick={confirm} disabled={pending} data-testid="customer-cancel-confirm">
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
