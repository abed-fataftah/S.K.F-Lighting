import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/ltr";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminContactMessage } from "@/features/orders/admin-contact-message";
import { OrderHistory } from "@/features/orders/components/order-history";
import { OrderStatusCard } from "@/features/orders/components/order-status-card";
import { OrderStatusBadge } from "@/features/orders/components/status-badge";
import { getAdminOrder } from "@/features/orders/server/admin-queries";
import { formatDateTime, formatNumber, formatPhone } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";
import { whatsappUrl } from "@/lib/whatsapp";

export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[number]">): Promise<Metadata> {
  const { number } = await params;
  const t = await getTranslations("AdminOrders");
  return { title: t("orderMeta", { number: decodeURIComponent(number) }) };
}

// One order (spec 0004 AC-13, spec 0014; docs/design/pages/admin-order-details.md without payments
// and price edits, which come with features 23 and 24): its status card, customer, and history.
// Opening it marks it seen (spec 0014 AC-14).
export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[number]">) {
  const { number } = await params;
  const [t, order] = await Promise.all([
    getTranslations("AdminOrders"),
    getAdminOrder(decodeURIComponent(number)),
  ]);
  if (!order) notFound();
  const delivery = order.fulfilment === "delivery";
  const contact = whatsappUrl(
    order.phoneE164,
    adminContactMessage(
      { name: order.name, number: order.number, statusLabel: t(`status.${order.status}`) },
      (key, values) => t(key, values),
    ),
  );

  const details: readonly (readonly [string, React.ReactNode])[] = [
    [t("name"), order.name],
    [t("phone"), <Ltr key="phone">{formatPhone(order.phoneE164)}</Ltr>],
    [t("method"), delivery ? t("delivery") : t("pickup")],
    ...(delivery
      ? ([
          [t("zone"), order.zoneName],
          [t("city"), order.city],
          [t("address"), order.address],
        ] as const)
      : []),
    ...(order.notes ? ([[t("notes"), order.notes]] as const) : []),
    [
      t("placedAt"),
      <time key="placed" dateTime={order.placedAt.toISOString()}>
        {formatDateTime(order.placedAt)}
      </time>,
    ],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 type-display-s">
          {t("orderTitle")} <Ltr>{order.number}</Ltr>
          <OrderStatusBadge status={order.status} data-testid="order-header-status" />
        </h1>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            variant="whatsapp"
            href={contact}
            target="_blank"
            rel="noopener"
            data-testid="order-contact"
          >
            {t("contact")}
          </ButtonLink>
          <ButtonLink variant="outline" render={<Link href={routes.admin.orders} />}>
            {t("backToOrders")}
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[2_1_var(--admin-detail-main)] flex-col gap-3">
          <h2 className="type-title-s">{t("products")}</h2>
          <Table aria-label={t("linesLabel")} data-testid="admin-order-lines">
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead>{t("option")}</TableHead>
                <TableHead>{t("quantity")}</TableHead>
                <TableHead>{t("unitPrice")}</TableHead>
                <TableHead>{t("lineTotal")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-bold">{line.name}</span>
                      <span className="type-small text-muted">
                        {t("code")} <Ltr>{line.code}</Ltr>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    {[line.sizeLabel, line.colourName].filter(Boolean).join(" · ")}
                  </TableCell>
                  <TableCell>{formatNumber(line.quantity)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Ltr>{formatPrice(line.unitPrice)}</Ltr>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Ltr>{formatPrice(line.lineTotal)}</Ltr>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Card>
            <dl className="flex flex-col gap-2">
              <div className="flex justify-between gap-3">
                <dt>{t("subtotal")}</dt>
                <dd>
                  <Ltr>{formatPrice(order.subtotal)}</Ltr>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t("deliveryFee")}</dt>
                <dd>{delivery ? <Ltr>{formatPrice(order.deliveryFee)}</Ltr> : t("pickupFee")}</dd>
              </div>
              <div className="flex justify-between gap-3 type-title-s">
                <dt>{t("total")}</dt>
                <dd data-testid="admin-order-total">
                  <Ltr>{formatPrice(order.total)}</Ltr>
                </dd>
              </div>
            </dl>
          </Card>
        </section>

        <div className="flex min-w-0 flex-[1_1_var(--admin-detail-side)] flex-col gap-4">
          <OrderStatusCard
            orderId={order.id}
            number={order.number}
            fulfilment={order.fulfilment}
            status={order.status}
            deliveredAt={order.deliveredAt}
            cancelledAt={order.cancelledAt}
            cancelledBy={order.cancelledBy}
            cancelReason={order.cancelReason}
          />
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="type-title-s">{t("customerCard")}</h2>
              {/* Only a linked account that is not the owner's own (spec 0019 AC-14). */}
              {order.placedByUserId &&
              order.placedByAccountRole &&
              order.placedByAccountRole !== "admin" ? (
                <ButtonLink
                  variant="outline"
                  size="sm"
                  render={<Link href={routes.admin.customer(order.placedByUserId)} />}
                  data-testid="order-view-customer"
                >
                  {t("viewCustomer")}
                </ButtonLink>
              ) : null}
            </div>
            <dl className="flex flex-col gap-2">
              {details.map(([label, value]) => (
                <div key={label} className="flex flex-col">
                  <dt className="type-small text-muted">{label}</dt>
                  <dd className="break-words whitespace-pre-line">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <OrderHistory events={order.events} />
        </div>
      </div>
    </>
  );
}
