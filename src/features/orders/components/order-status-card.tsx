"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";
import { actorKey } from "../admin-history";
import { changeOrderStatus } from "../server/admin-actions";
import { orderMoves, type Fulfilment, type OrderStatus, type WritableStatus } from "../status";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { OrderStatusBadge } from "./status-badge";

type ActorKind = "guest" | "customer" | "electrician" | "admin" | "system";

type Notice = {
  readonly key: "stale" | "saveFailed";
  /** A stale notice outlives the one status change its own refresh brings. */
  readonly keep: boolean;
};

// "حالة الطلب" (spec 0014 AC-5): the badge, the next step as the one yellow button, the other
// moves in "خيارات أخرى", and the cancel dialog. Every control is disabled while a move runs, and
// the action plus any refresh sit in one transition, so the pending state lasts until the new
// status is on screen; focus then moves to the badge. Final states show no control.
export function OrderStatusCard({
  orderId,
  number,
  fulfilment,
  status,
  deliveredAt,
  cancelledAt,
  cancelledBy,
  cancelReason,
}: {
  readonly orderId: string;
  readonly number: string;
  readonly fulfilment: Fulfilment;
  readonly status: OrderStatus;
  readonly deliveredAt: Date | null;
  readonly cancelledAt: Date | null;
  readonly cancelledBy: ActorKind | null;
  readonly cancelReason: string | null;
}) {
  const t = useTranslations("AdminOrders");
  const router = useRouter();
  const badge = useRef<HTMLSpanElement>(null);
  const focusOnChange = useRef(false);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [shownStatus, setShownStatus] = useState(status);

  // A new status clears any message (a stale one survives the refresh it asked for).
  if (status !== shownStatus) {
    setShownStatus(status);
    setNotice((current) => (current?.keep ? { ...current, keep: false } : null));
  }

  useEffect(() => {
    if (!focusOnChange.current) return;
    focusOnChange.current = false;
    badge.current?.focus();
  }, [status]);

  const move = (to: WritableStatus) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await changeOrderStatus({ orderId, from: status, to });
        if (result.ok) {
          focusOnChange.current = true;
        } else if (result.error === "stale") {
          setNotice({ key: "stale", keep: true });
          startTransition(() => router.refresh());
        } else {
          setNotice({ key: "saveFailed", keep: false });
        }
      } catch {
        setNotice({ key: "saveFailed", keep: false });
      }
    });
  };

  const moves = orderMoves(fulfilment, status);
  const others = [
    ...moves.forward.map((to) => ({ to, label: t("moveTo", { status: t(`status.${to}`) }) })),
    ...(moves.back
      ? [{ to: moves.back, label: t("moveBack", { status: t(`status.${moves.back}`) }) }]
      : []),
  ];

  return (
    <Card data-testid="order-status-card" aria-busy={pending || undefined}>
      <h2 className="type-title-s">{t("statusCard")}</h2>
      <OrderStatusBadge
        status={status}
        ref={badge}
        tabIndex={-1}
        className="w-fit"
        data-testid="order-status-badge"
      />

      {status === "delivered" && deliveredAt ? (
        <p>
          {t.rich("deliveredLine", {
            at: formatDateTime(deliveredAt),
            time: (chunks) => <time dateTime={deliveredAt.toISOString()}>{chunks}</time>,
          })}
        </p>
      ) : null}
      {status === "cancelled" && cancelledAt ? (
        <div className="flex flex-col gap-1" data-testid="order-cancelled-info">
          <p>
            {t.rich("cancelledLine", {
              at: formatDateTime(cancelledAt),
              actor: t(actorKey(cancelledBy ?? "admin")),
              time: (chunks) => <time dateTime={cancelledAt.toISOString()}>{chunks}</time>,
            })}
          </p>
          {cancelReason ? (
            <p className="break-words whitespace-pre-line">
              {t("reasonLine", { reason: cancelReason })}
            </p>
          ) : null}
        </div>
      ) : null}

      {moves.next || others.length ? (
        <div className="flex flex-wrap gap-2">
          {moves.next ? (
            <Button
              onClick={() => moves.next && move(moves.next)}
              disabled={pending}
              className="flex-1"
              data-testid="order-next"
            >
              {t(`status.${moves.next}`)}
            </Button>
          ) : null}
          {others.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="flex-1" />}
                disabled={pending}
                data-testid="order-more"
              >
                {t("moreMoves")}
                <ChevronDownIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {others.map(({ to, label }) => (
                  <DropdownMenuItem
                    key={to}
                    onClick={() => move(to)}
                    disabled={pending}
                    data-testid={`order-move-${to}`}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}
      {moves.canCancel ? (
        <CancelOrderDialog
          orderId={orderId}
          number={number}
          status={status}
          disabled={pending}
          onDone={() => {
            focusOnChange.current = true;
          }}
        />
      ) : null}

      {notice ? (
        <Alert data-testid="order-status-problem">
          <AlertDescription>{t(notice.key)}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}
