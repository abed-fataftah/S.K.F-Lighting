import { useTranslations } from "next-intl";
import { Ltr } from "@/components/ltr";
import { Card } from "@/components/ui/card";
import type { OrderStatus } from "@/features/orders/status";
import { formatDayKey, shopDateKey } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import {
  paymentFormMode,
  paymentLimit,
  paymentRowsView,
  paymentSummaryRows,
  type PaymentRow,
  type PaymentRowView,
} from "../ledger";
import { PaymentForm } from "./payment-form";
import { PaymentNotices, PaymentNoticeSlot } from "./payment-notices";
import { ReversePaymentDialog } from "./reverse-payment-dialog";

// "الدفعات" on the dashboard order page (spec 0023 AC-1, AC-2, AC-5, AC-6; named apart from the
// storefront's `payment-card.tsx`): every payment and refund oldest first, a reversed row struck
// with its reason, the summary, then the form the order's state calls for. Owner only: cheque
// details and notes show nowhere else. Each render makes fresh ids, so a refresh after a write
// remounts the form and the dialogs empty.
export function OrderPaymentsCard({
  orderId,
  paymentId,
  status,
  total,
  amountPaid,
  placedAt,
  rows,
}: {
  readonly orderId: string;
  /** Made by the page for this render (AC-4): the next payment's id. */
  readonly paymentId: string;
  readonly status: OrderStatus;
  readonly total: number;
  readonly amountPaid: number;
  readonly placedAt: Date;
  readonly rows: readonly PaymentRow[];
}) {
  const t = useTranslations("AdminPayments");
  const listed = paymentRowsView(rows);
  const mode = paymentFormMode(status, total, amountPaid);
  const today = shopDateKey(new Date());

  return (
    <Card data-testid="order-payments">
      <h2 className="type-title-s">{t("title")}</h2>
      <PaymentNotices>
        {listed.length === 0 ? (
          <p className="text-muted" data-testid="payments-empty">
            {t("empty")}
          </p>
        ) : (
          <ul aria-label={t("listLabel")} className="flex flex-col" data-testid="payments-list">
            {listed.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 border-b border-border py-2.5 last:border-b-0"
                data-testid="payment-row"
                data-kind={row.kind}
                data-reversed={row.reversal ? "true" : undefined}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RowText row={row} />
                  {row.reversal ? null : (
                    <ReversePaymentDialog
                      orderId={orderId}
                      paymentId={row.id}
                      reversalId={crypto.randomUUID()}
                      expectedAmountPaid={amountPaid}
                      label={t("reverseLabel", {
                        amount: formatPrice(row.amount),
                        date: formatDayKey(row.receivedOn),
                      })}
                      summary={<RowText row={row} />}
                    />
                  )}
                </div>
                {row.note ? (
                  <span
                    className="type-small break-words text-muted"
                    data-testid="payment-row-note"
                  >
                    {row.note}
                  </span>
                ) : null}
                {row.reversal ? (
                  <span
                    className="type-small break-words text-muted"
                    data-testid="payment-reversal"
                  >
                    {t("reversedLine", {
                      date: formatDayKey(row.reversal.receivedOn),
                      reason: row.reversal.reason,
                    })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <dl className="flex flex-col gap-2 border-t border-ink pt-3">
          {paymentSummaryRows(status, total, amountPaid).map((summary) => (
            <div
              key={summary.key}
              className={
                summary.key === "remaining" || summary.key === "owedBack"
                  ? "flex justify-between gap-3 type-title-s"
                  : "flex justify-between gap-3"
              }
            >
              <dt>{t(summary.key)}</dt>
              <dd data-testid={`payments-${summary.key}`}>
                <Ltr>{formatPrice(summary.amount)}</Ltr>
              </dd>
            </div>
          ))}
        </dl>

        <PaymentNoticeSlot />

        {mode === "payment" || mode === "refund" ? (
          <PaymentForm
            key={paymentId}
            orderId={orderId}
            paymentId={paymentId}
            kind={mode}
            expectedAmountPaid={amountPaid}
            limit={paymentLimit(mode, total, amountPaid)}
            today={today}
            minDay={shopDateKey(placedAt)}
          />
        ) : mode === "settled" ? (
          <p className="text-muted" data-testid="payments-settled">
            {t("settled")}
          </p>
        ) : null}
      </PaymentNotices>
    </Card>
  );
}

/** One row as the list shows it: the day, how it was paid, and the amount (AC-1). */
function RowText({ row }: { readonly row: PaymentRowView }) {
  const t = useTranslations("AdminPayments");
  const amount = <Ltr>{formatPrice(row.kind === "refund" ? -row.amount : row.amount)}</Ltr>;
  const method =
    row.method === "cheque" && row.chequeNumber && row.chequeBank && row.chequeDueDate
      ? t.rich("chequeLine", {
          number: row.chequeNumber,
          bank: row.chequeBank,
          dueDate: formatDayKey(row.chequeDueDate),
          bdi: (chunks) => <bdi dir="ltr">{chunks}</bdi>,
        })
      : t("methodCash");

  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <span>
        {formatDayKey(row.receivedOn)} · {row.kind === "refund" ? t("refundPrefix") : null}
        {method}
      </span>
      <span className="font-bold" data-testid="payment-row-amount">
        {row.reversal ? (
          <s>
            <span className="sr-only">{t("reversedHidden")}</span>
            {amount}
          </s>
        ) : (
          amount
        )}
      </span>
    </span>
  );
}
