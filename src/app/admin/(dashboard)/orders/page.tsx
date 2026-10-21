import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ltr } from "@/components/ltr";
import { StateCard } from "@/components/state-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseAdminPage } from "@/features/orders/admin-list";
import { listAdminOrders } from "@/features/orders/server/admin-queries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatPrice } from "@/lib/money";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminOrders");
  return { title: t("metaTitle") };
}

// The orders list (spec 0004 AC-13; docs/design/pages/admin-orders.md, without the filters and
// the status and payment columns, which come with feature 15). Newest first, 50 a page.
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const page = parseAdminPage((await searchParams).page);
  const [t, { rows, hasNext }] = await Promise.all([
    getTranslations("AdminOrders"),
    listAdminOrders(page),
  ]);

  return (
    <>
      <h1 className="type-display-s">{t("title")}</h1>
      {rows.length === 0 ? (
        <StateCard icon={Inbox} title={t("emptyTitle")} text={t("emptyText")} />
      ) : (
        <Table aria-label={t("tableLabel")} data-testid="admin-orders">
          <TableHeader>
            <TableRow>
              <TableHead>{t("number")}</TableHead>
              <TableHead>{t("customer")}</TableHead>
              <TableHead>{t("phone")}</TableHead>
              <TableHead>{t("method")}</TableHead>
              <TableHead>{t("total")}</TableHead>
              <TableHead>{t("date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <TableRow key={order.number} data-testid={`order-row-${order.number}`}>
                <TableCell className="whitespace-nowrap">
                  <span className="flex items-center gap-2">
                    {/* Opening the order marks it seen, so a prefetch must not open it. */}
                    <Link
                      href={routes.admin.order(order.number)}
                      prefetch={false}
                      className="inline-flex min-h-11 items-center font-extrabold underline"
                    >
                      <Ltr>{order.number}</Ltr>
                    </Link>
                    {order.isNew ? <Badge variant="new">{t("new")}</Badge> : null}
                  </span>
                </TableCell>
                <TableCell>{order.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Ltr>{order.phone}</Ltr>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {order.fulfilment === "delivery" ? t("delivery") : t("pickup")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Ltr>{formatPrice(order.total)}</Ltr>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <time dateTime={order.placedAt.toISOString()}>
                    {formatDateTime(order.placedAt)}
                  </time>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {page > 1 || hasNext ? (
        <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-3">
          {page > 1 ? (
            <ButtonLink
              variant="outline"
              render={<Link href={routes.admin.ordersPage(page - 1)} />}
            >
              {t("previous")}
            </ButtonLink>
          ) : null}
          <span className="text-muted">{t("page", { shown: formatNumber(page) })}</span>
          {hasNext ? (
            <ButtonLink
              variant="outline"
              render={<Link href={routes.admin.ordersPage(page + 1)} />}
            >
              {t("next")}
            </ButtonLink>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
