import { Inbox, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { StateCard } from "@/components/state-card";
import { ButtonLink } from "@/components/ui/button";
import { hasOrderFilters, parseOrderFilters } from "@/features/orders/admin-filters";
import { OrderFiltersBar } from "@/features/orders/components/order-filters-bar";
import { OrderSearch } from "@/features/orders/components/order-search";
import { OrdersTable } from "@/features/orders/components/orders-table";
import { listAdminOrders } from "@/features/orders/server/admin-queries";
import { formatNumber, shopDateKey } from "@/lib/format";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("AdminOrders");
  return { title: t("metaTitle") };
}

// The orders list (spec 0004 AC-13, spec 0014; docs/design/pages/admin-orders.md without the
// payment column, which comes with feature 24). Search, filters in the address, newest first,
// 50 a page; unseen orders carry the yellow dot.
export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const { filters, days } = parseOrderFilters(await searchParams, shopDateKey(new Date()));
  const [t, { rows, hasNext }] = await Promise.all([
    getTranslations("AdminOrders"),
    listAdminOrders(filters, days),
  ]);
  if (rows.length === 0 && filters.page > 1) redirect(routes.admin.ordersWith(filters, 1));
  const page = filters.page;

  return (
    <>
      <h1 className="type-display-s">{t("title")}</h1>
      <OrderSearch>
        <OrderFiltersBar filters={filters} days={days} />
        {rows.length === 0 ? (
          hasOrderFilters(filters) ? (
            <StateCard
              icon={SearchX}
              title={t("filteredEmpty")}
              actions={
                <ButtonLink variant="outline" render={<Link href={routes.admin.orders} />}>
                  {t("clearFilters")}
                </ButtonLink>
              }
              data-testid="orders-filtered-empty"
            />
          ) : (
            <StateCard icon={Inbox} title={t("emptyTitle")} text={t("emptyText")} />
          )
        ) : (
          <>
            <OrdersTable rows={rows} label={t("tableLabel")} />
            <p className="type-small text-muted">{t("newNote")}</p>
          </>
        )}
        {page > 1 || hasNext ? (
          <nav aria-label={t("pages")} className="flex flex-wrap items-center gap-3">
            {page > 1 ? (
              <ButtonLink
                variant="outline"
                render={<Link href={routes.admin.ordersWith(filters, page - 1)} />}
              >
                {t("previous")}
              </ButtonLink>
            ) : null}
            <span className="text-muted">{t("page", { shown: formatNumber(page) })}</span>
            {hasNext ? (
              <ButtonLink
                variant="outline"
                render={<Link href={routes.admin.ordersWith(filters, page + 1)} />}
              >
                {t("next")}
              </ButtonLink>
            ) : null}
          </nav>
        ) : null}
      </OrderSearch>
    </>
  );
}
