// The display strings of the "ملخص الطلب" card (spec 0013 AC-5 to AC-8), from the saved order
// only. Pure: the labels come in as a translator over `OrderSummary.*` in ar.json and the
// formatters come in too, shaped like `buildNewOrderMessage`. The card only renders the result.

export type OrderSummaryKey = "pickup" | "delivery" | "deliveryWhere" | "free" | "quantity";

export type OrderSummaryTranslate = (
  key: OrderSummaryKey,
  values?: Readonly<Record<string, string>>,
) => string;

export type OrderSummaryLine = {
  readonly productName: string;
  readonly sizeLabel: string | null;
  readonly colourName: string | null;
  readonly quantity: number;
  readonly lineTotal: number;
  /** `catalog_unit_price × quantity` (spec 0022 AC-9); struck through when above the line total. */
  readonly catalogLineTotal?: number;
  readonly imageKey: string | null;
};

export type OrderSummaryProps = {
  readonly lines: readonly OrderSummaryLine[];
  readonly fulfilment: "pickup" | "delivery";
  readonly deliveryZoneName: string | null;
  readonly city: string | null;
  readonly address: string | null;
  /** The shop's current address for pickup, already trimmed, `null` when blank. */
  readonly pickupAddress: string | null;
  readonly notes: string | null;
  readonly subtotal: number;
  readonly deliveryFee: number;
  readonly total: number;
  /** The order page's price deal (spec 0022 AC-9); the checkout confirmation passes neither. */
  readonly catalogSubtotal?: number;
  readonly priceDiscount?: number;
};

export type OrderSummaryContext = {
  readonly t: OrderSummaryTranslate;
  readonly formatPrice: (agorot: number) => string;
  readonly formatNumber: (n: number) => string;
};

export type OrderSummaryView = {
  readonly rows: readonly {
    readonly name: string;
    readonly options: string;
    readonly total: string;
    /** The catalog line total, struck through before `total`; null without a cut. */
    readonly before: string | null;
  }[];
  readonly receive: { readonly line: string; readonly where: string | null };
  readonly notes: string | null;
  readonly totals: {
    /** "قبل الخصم" and "خصم المتجر" (a minus amount), only when the discount is above 0. */
    readonly deal: { readonly before: string; readonly discount: string } | null;
    readonly subtotal: string;
    /** "بدون رسوم" for pickup, else the saved fee. */
    readonly fee: string;
    readonly feeIsAmount: boolean;
    readonly total: string;
  };
};

export function orderSummaryView(
  order: OrderSummaryProps,
  { t, formatPrice, formatNumber }: OrderSummaryContext,
): OrderSummaryView {
  const delivery = order.fulfilment === "delivery";
  return {
    rows: order.lines.map((line) => ({
      name: line.productName,
      options: [
        line.sizeLabel,
        line.colourName,
        t("quantity", { quantity: formatNumber(line.quantity) }),
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
      total: formatPrice(line.lineTotal),
      before:
        line.catalogLineTotal !== undefined && line.catalogLineTotal > line.lineTotal
          ? formatPrice(line.catalogLineTotal)
          : null,
    })),
    receive: delivery
      ? {
          line: t("delivery", { zone: order.deliveryZoneName ?? "" }),
          // The customer's order page passes neither (spec 0015 AC-10): the zone line alone.
          where:
            order.city === null && order.address === null
              ? null
              : t("deliveryWhere", { city: order.city ?? "", address: order.address ?? "" }),
        }
      : { line: t("pickup"), where: order.pickupAddress },
    notes: order.notes,
    totals: {
      deal:
        order.priceDiscount && order.priceDiscount > 0
          ? {
              before: formatPrice(order.catalogSubtotal ?? order.subtotal + order.priceDiscount),
              discount: formatPrice(-order.priceDiscount),
            }
          : null,
      subtotal: formatPrice(order.subtotal),
      fee: delivery ? formatPrice(order.deliveryFee) : t("free"),
      feeIsAmount: delivery,
      total: formatPrice(order.total),
    },
  };
}
