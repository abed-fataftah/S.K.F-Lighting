// W5, the new order message (spec 0004 AC-12), built from the saved order, never the cart.
// Pure: the labels come in as a translator over `OrderMessage.*` in ar.json, the values are
// formatted here, and nothing adds a hidden direction mark (spec 0005 AC-6).
import { formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { whatsappUrl } from "@/lib/whatsapp";
import { routes } from "@/lib/routes";

/** Above this many characters of encoded wa.me URL, the product lines are left out. */
export const MAX_WHATSAPP_URL = 1800;

export type OrderMessageKey =
  | "title"
  | "name"
  | "phone"
  | "pickup"
  | "delivery"
  | "quantity"
  | "fee"
  | "notes"
  | "total"
  | "link";

export type OrderMessageTranslate = (
  key: OrderMessageKey,
  values?: Readonly<Record<string, string>>,
) => string;

export type MessageOrder = {
  readonly orderNumber: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly fulfilment: "pickup" | "delivery";
  readonly deliveryZoneName: string | null;
  readonly city: string | null;
  readonly address: string | null;
  readonly deliveryFee: number;
  readonly notes: string | null;
  readonly total: number;
  readonly lines: readonly {
    readonly productName: string;
    readonly sizeLabel: string | null;
    readonly colourName: string | null;
    readonly quantity: number;
    readonly lineTotal: number;
  }[];
};

export type OrderMessageContext = {
  readonly siteUrl: string;
  readonly whatsappNumber: string;
  readonly t: OrderMessageTranslate;
};

function messageLines(
  order: MessageOrder,
  { siteUrl, t }: OrderMessageContext,
  withLines: boolean,
) {
  const delivery = order.fulfilment === "delivery";
  const productLines = order.lines.map((line) =>
    [
      line.productName,
      line.sizeLabel,
      line.colourName,
      t("quantity", { quantity: formatNumber(line.quantity) }),
      formatPrice(line.lineTotal),
    ]
      .filter((part): part is string => Boolean(part))
      .join(" | "),
  );

  return [
    t("title", { number: order.orderNumber }),
    t("name", { name: order.customerName }),
    t("phone", { phone: order.customerPhone }),
    delivery
      ? t("delivery", {
          zone: order.deliveryZoneName ?? "",
          city: order.city ?? "",
          address: order.address ?? "",
        })
      : t("pickup"),
    ...(withLines ? productLines : []),
    ...(delivery ? [t("fee", { fee: formatPrice(order.deliveryFee) })] : []),
    ...(order.notes ? [t("notes", { notes: order.notes })] : []),
    t("total", { total: formatPrice(order.total) }),
    t("link", { url: `${siteUrl}${routes.order(order.orderNumber)}` }),
  ];
}

/** The W5 text; the short form (no product lines) when the full wa.me URL would pass 1,800 characters. */
export function buildNewOrderMessage(order: MessageOrder, context: OrderMessageContext): string {
  const full = messageLines(order, context, true).join("\n");
  if (whatsappUrl(context.whatsappNumber, full).length <= MAX_WHATSAPP_URL) return full;
  return messageLines(order, context, false).join("\n");
}
