import Image from "next/image";
import { useTranslations } from "next-intl";
import { ImagePlaceholder } from "@/components/image-placeholder";
import { Ltr } from "@/components/ltr";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { orderSummaryView, type OrderSummaryProps } from "../order-summary-view";

// The "ملخص الطلب" card (spec 0013 AC-5 to AC-8): what was ordered, where it goes, and what it
// costs, all from the saved order. Plain props, no query, so the order page (feature 16) passes
// the same shape from its own read.
export function OrderSummary(order: OrderSummaryProps) {
  const t = useTranslations("OrderSummary");
  const view = orderSummaryView(order, {
    t: (key, values) => t(key, values),
    formatPrice,
    formatNumber,
  });

  return (
    <Card data-testid="order-summary">
      <h2 className="type-lead">{t("title")}</h2>

      <ul className="flex flex-col gap-3">
        {order.lines.map((line, index) => {
          const row = view.rows[index];
          return (
            <li key={index} className="flex items-center gap-3" data-testid="summary-line">
              {line.imageKey ? (
                // Decorative: the product name sits beside it.
                <Image
                  src={line.imageKey}
                  alt=""
                  width={52}
                  height={52}
                  sizes="52px"
                  className="size-(--size-tile-order) shrink-0 rounded-tile bg-product-1 object-cover"
                />
              ) : (
                <ImagePlaceholder
                  tone={((index % 4) + 1) as 1 | 2 | 3 | 4}
                  className="size-(--size-tile-order) shrink-0 rounded-tile [&_svg]:size-6"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-bold">{row.name}</span>
                <span className="type-small text-muted">{row.options}</span>
              </div>
              <span className="shrink-0 font-bold">
                <Ltr>{row.total}</Ltr>
              </span>
            </li>
          );
        })}
      </ul>

      <section
        className="flex flex-col gap-1 border-t border-border pt-3"
        data-testid="summary-receive"
      >
        <h3 className="font-bold">{t("receive")}</h3>
        <p>{view.receive.line}</p>
        {view.receive.where ? <p className="type-small text-muted">{view.receive.where}</p> : null}
      </section>

      {view.notes ? (
        <section
          className="flex flex-col gap-1 border-t border-border pt-3"
          data-testid="summary-notes"
        >
          <h3 className="font-bold">{t("notes")}</h3>
          <p className="whitespace-pre-line">{view.notes}</p>
        </section>
      ) : null}

      <dl className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex justify-between gap-3">
          <dt>{t("subtotal")}</dt>
          <dd data-testid="summary-subtotal">
            <Ltr>{view.totals.subtotal}</Ltr>
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t("fee")}</dt>
          <dd data-testid="summary-fee">
            {view.totals.feeIsAmount ? <Ltr>{view.totals.fee}</Ltr> : view.totals.fee}
          </dd>
        </div>
        <div className="flex justify-between gap-3 type-title-s">
          <dt>{t("total")}</dt>
          <dd data-testid="summary-total">
            <Ltr>{view.totals.total}</Ltr>
          </dd>
        </div>
      </dl>
    </Card>
  );
}
